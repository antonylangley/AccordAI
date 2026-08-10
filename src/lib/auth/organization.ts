import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServerAuthClient } from "@/lib/auth/supabase-server";
import { getSupabaseServerClient } from "@/lib/db/accord-store";

export type OrganizationRole = "owner" | "admin" | "member" | "viewer";
export type OrganizationMemberStatus = "active" | "invited" | "suspended";

export type AccordOrganizationContext = {
  authenticated: boolean;
  authConfigured: boolean;
  userId?: string;
  userEmail?: string;
  companySlug: string;
  companyName: string;
  role: OrganizationRole | "demo";
  onboardingRequired: boolean;
};

export type AccordOrganizationMember = {
  id: string;
  email: string;
  role: OrganizationRole;
  status: OrganizationMemberStatus;
  isCurrentUser: boolean;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type OrganizationMemberResult = {
  ok: boolean;
  message: string;
  emailSent?: boolean;
};

export type OrganizationUpdateResult = {
  ok: boolean;
  message: string;
};

const demoOrganization: AccordOrganizationContext = {
  authenticated: false,
  authConfigured: false,
  companySlug: "test-company",
  companyName: "Test Company",
  role: "demo",
  onboardingRequired: false
};

export async function getAccordOrganizationContext({
  autoCreate = false
}: {
  autoCreate?: boolean;
} = {}): Promise<AccordOrganizationContext> {
  const authClient = createSupabaseServerAuthClient();
  if (!authClient) return demoOrganization;

  const {
    data: { user }
  } = await authClient.auth.getUser();

  if (!user) {
    return {
      ...demoOrganization,
      authConfigured: true
    };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      ...demoOrganization,
      authConfigured: true,
      authenticated: true,
      userId: user.id,
      userEmail: user.email || undefined,
      onboardingRequired: true
    };
  }

  const existing = await getFirstMembership(user);
  if (existing) {
    return existing;
  }

  if (!autoCreate) {
    return {
      ...demoOrganization,
      authConfigured: true,
      authenticated: true,
      userId: user.id,
      userEmail: user.email || undefined,
      onboardingRequired: true
    };
  }

  return ensureDefaultOrganization(user);
}

export async function ensureUserOrganization(user: User): Promise<AccordOrganizationContext> {
  const existing = await getFirstMembership(user);
  if (existing) return existing;

  return ensureDefaultOrganization(user);
}

export async function getOrganizationMembers(
  companySlug: string,
  currentUserId?: string
): Promise<AccordOrganizationMember[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  await reconcileAcceptedInvitations(supabase, companySlug);

  const { data, error } = await supabase
    .from("accord_company_members")
    .select("id,user_id,email,role,status,created_at,updated_at")
    .eq("company_slug", companySlug)
    .order("status", { ascending: true })
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !Array.isArray(data)) return [];

  return data.map((member) => {
    const userId = typeof member.user_id === "string" ? member.user_id : undefined;

    return {
      id: typeof member.id === "string" ? member.id : `${companySlug}-${member.email || "member"}`,
      email: typeof member.email === "string" && member.email ? member.email : "No email on file",
      role: normalizeMemberRole(member.role),
      status: normalizeMemberStatus(member.status),
      isCurrentUser: Boolean(userId && currentUserId && userId === currentUserId),
      userId,
      createdAt: typeof member.created_at === "string" ? member.created_at : undefined,
      updatedAt: typeof member.updated_at === "string" ? member.updated_at : undefined
    };
  });
}

export async function addOrganizationMemberFromForm(formData: FormData): Promise<OrganizationMemberResult> {
  const email = normalizeEmail(formData.get("email"));
  const role = normalizeMemberRole(formData.get("role"));

  return addOrganizationMember({ email, role });
}

export async function resendOrganizationInviteFromForm(formData: FormData): Promise<OrganizationMemberResult> {
  const memberId = typeof formData.get("memberId") === "string" ? String(formData.get("memberId")) : "";

  return resendOrganizationInvite({ memberId });
}

export async function updateOrganizationNameFromForm(formData: FormData): Promise<OrganizationUpdateResult> {
  return updateOrganizationName(normalizeCompanyName(formData.get("companyName")));
}

export async function updateOrganizationName(companyName: string): Promise<OrganizationUpdateResult> {
  const organization = await getAccordOrganizationContext({ autoCreate: true });
  if (!organization.authenticated) {
    return { ok: false, message: "Sign in before updating the workspace." };
  }

  if (!canManageOrganization(organization.role)) {
    return { ok: false, message: "Only owners and admins can update workspace settings." };
  }

  const normalizedName = normalizeCompanyName(companyName);
  if (normalizedName.length < 2) {
    return { ok: false, message: "Enter a workspace name." };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, message: "Supabase is not configured for organization management." };
  }

  const { error } = await supabase
    .from("accord_companies")
    .update({
      name: normalizedName,
      updated_at: new Date().toISOString()
    })
    .eq("slug", organization.companySlug);

  if (error) return { ok: false, message: "Could not update the workspace name." };
  return { ok: true, message: "Workspace name saved." };
}

export async function addOrganizationMember({
  email,
  role
}: {
  email: string;
  role: OrganizationRole;
}): Promise<OrganizationMemberResult> {
  const organization = await getAccordOrganizationContext({ autoCreate: true });
  if (!organization.authenticated) {
    return { ok: false, message: "Sign in before adding organization members." };
  }

  if (!canManageOrganization(organization.role)) {
    return { ok: false, message: "Only owners and admins can add organization members." };
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { ok: false, message: "Enter a valid work email." };
  }

  if (organization.userEmail && normalizeEmail(organization.userEmail) === normalizedEmail) {
    return { ok: false, message: "You are already a member of this organization." };
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, message: "Supabase is not configured for organization management." };
  }

  const now = new Date().toISOString();
  const existingAuthUser = await findAuthUserByEmail(supabase, normalizedEmail);
  const { data: existingInvitation } = await supabase
    .from("accord_company_members")
    .select("id")
    .eq("company_slug", organization.companySlug)
    .eq("email", normalizedEmail)
    .is("user_id", null)
    .maybeSingle();

  if (existingInvitation?.id && (!existingAuthUser?.id || !hasAcceptedAuthInvite(existingAuthUser))) {
    const { error } = await supabase
      .from("accord_company_members")
      .update({
        role,
        status: "invited",
        updated_at: now
      })
      .eq("id", existingInvitation.id);

    if (error) return { ok: false, message: "Could not update that invitation." };

    const emailResult = await sendOrganizationInviteEmail({ supabase, organization, email: normalizedEmail, role });
    if (!emailResult.ok) return inviteEmailFailedResult(emailResult.message);

    return { ok: true, emailSent: true, message: "Invite email resent." };
  }

  if (existingAuthUser?.id && hasAcceptedAuthInvite(existingAuthUser)) {
    const { data: existingMember } = await supabase
      .from("accord_company_members")
      .select("id")
      .eq("company_slug", organization.companySlug)
      .eq("user_id", existingAuthUser.id)
      .maybeSingle();

    if (existingMember?.id) {
      const { error } = await supabase
        .from("accord_company_members")
        .update({
          email: normalizedEmail,
          role,
          status: "active",
          updated_at: now
        })
        .eq("id", existingMember.id);

      if (error) return { ok: false, message: "Could not update that member." };

      if (existingInvitation?.id) {
        await supabase
          .from("accord_company_members")
          .delete()
          .eq("company_slug", organization.companySlug)
          .eq("email", normalizedEmail)
          .is("user_id", null);
      }

      return {
        ok: true,
        emailSent: false,
        message: "Existing account updated. No invite email was needed."
      };
    }

    if (existingInvitation?.id) {
      const { error } = await supabase
        .from("accord_company_members")
        .update({
          user_id: existingAuthUser.id,
          email: normalizedEmail,
          role,
          status: "active",
          updated_at: now
        })
        .eq("id", existingInvitation.id);

      if (error) return { ok: false, message: "Could not activate that invitation." };
      return {
        ok: true,
        emailSent: false,
        message: "Existing account added. No invite email was needed."
      };
    }

    const { error } = await supabase.from("accord_company_members").insert({
      company_slug: organization.companySlug,
      user_id: existingAuthUser.id,
      email: normalizedEmail,
      role,
      status: "active",
      updated_at: now
    });

    if (error) return { ok: false, message: "Could not add that member." };
    return {
      ok: true,
      emailSent: false,
      message: "Existing account added. No invite email was needed."
    };
  }

  const { error } = await supabase.from("accord_company_members").insert({
    company_slug: organization.companySlug,
    user_id: null,
    email: normalizedEmail,
    role,
    status: "invited",
    updated_at: now
  });

  if (error) return { ok: false, message: "Could not create that invitation." };

  const emailResult = await sendOrganizationInviteEmail({ supabase, organization, email: normalizedEmail, role });
  if (!emailResult.ok) return inviteEmailFailedResult(emailResult.message);

  return {
    ok: true,
    emailSent: true,
    message: "Invite email sent. They will join this organization after accepting it."
  };
}

export async function resendOrganizationInvite({ memberId }: { memberId: string }): Promise<OrganizationMemberResult> {
  const organization = await getAccordOrganizationContext({ autoCreate: true });
  if (!organization.authenticated) {
    return { ok: false, message: "Sign in before resending invitations." };
  }

  if (!canManageOrganization(organization.role)) {
    return { ok: false, message: "Only owners and admins can resend invitations." };
  }

  if (!memberId) return { ok: false, message: "Choose an invitation to resend." };

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, message: "Supabase is not configured for organization management." };
  }

  const { data: invitation, error } = await supabase
    .from("accord_company_members")
    .select("id,email,role,status,user_id")
    .eq("id", memberId)
    .eq("company_slug", organization.companySlug)
    .maybeSingle();

  if (error || !invitation) return { ok: false, message: "Could not find that invitation." };

  const email = normalizeEmail(invitation.email);
  if (!email) return { ok: false, message: "That invitation does not have an email address." };

  if (invitation.status !== "invited" || invitation.user_id) {
    return { ok: false, message: "That member is already active. They can sign in instead." };
  }

  const role = normalizeMemberRole(invitation.role);
  const existingAuthUser = await findAuthUserByEmail(supabase, email);
  if (existingAuthUser?.id && hasAcceptedAuthInvite(existingAuthUser)) {
    const { error: activateError } = await supabase
      .from("accord_company_members")
      .update({
        user_id: existingAuthUser.id,
        status: "active",
        updated_at: new Date().toISOString()
      })
      .eq("id", invitation.id)
      .is("user_id", null);

    if (activateError) return { ok: false, message: "Could not activate that accepted invitation." };
    return { ok: true, emailSent: false, message: "Invite was already accepted. The member is active now." };
  }

  const emailResult = await sendOrganizationInviteEmail({ supabase, organization, email, role });
  if (!emailResult.ok) return inviteEmailFailedResult(emailResult.message);

  await supabase
    .from("accord_company_members")
    .update({
      status: "invited",
      updated_at: new Date().toISOString()
    })
    .eq("id", invitation.id);

  return { ok: true, emailSent: true, message: "Invite email resent." };
}

export function canManageOrganization(role: AccordOrganizationContext["role"]) {
  return role === "owner" || role === "admin";
}

async function getFirstMembership(user: User): Promise<AccordOrganizationContext | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("accord_company_members")
    .select("company_slug,role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data || typeof data.company_slug !== "string") return null;

  const { data: company } = await supabase
    .from("accord_companies")
    .select("name")
    .eq("slug", data.company_slug)
    .maybeSingle();

  return {
    authenticated: true,
    authConfigured: true,
    userId: user.id,
    userEmail: user.email || undefined,
    companySlug: data.company_slug,
    companyName: typeof company?.name === "string" ? company.name : titleFromSlug(data.company_slug),
    role: normalizeRole(data.role),
    onboardingRequired: false
  };
}

async function ensureDefaultOrganization(user: User): Promise<AccordOrganizationContext> {
  const supabase = getSupabaseServerClient();
  const email = user.email || "";

  if (!supabase) {
    return {
      ...demoOrganization,
      authConfigured: true,
      authenticated: true,
      userId: user.id,
      userEmail: email || undefined,
      onboardingRequired: true
    };
  }

  const claimedInvitation = await claimPendingMembership(user);
  if (claimedInvitation) return claimedInvitation;

  const companyName = organizationNameFromUser(user);
  const companySlug = slugify(`${companyName}-${user.id.slice(0, 8)}`) || "test-company";
  const now = new Date().toISOString();
  const companyResult = await supabase.from("accord_companies").upsert(
    {
      slug: companySlug,
      name: companyName,
      created_by: user.id,
      updated_at: now
    },
    { onConflict: "slug" }
  );

  if (companyResult.error) {
    return {
      ...demoOrganization,
      authConfigured: true,
      authenticated: true,
      userId: user.id,
      userEmail: email || undefined,
      onboardingRequired: true
    };
  }

  const memberResult = await supabase.from("accord_company_members").upsert(
    {
      company_slug: companySlug,
      user_id: user.id,
      email: email || null,
      role: "owner",
      status: "active",
      updated_at: now
    },
    { onConflict: "company_slug,user_id" }
  );

  if (memberResult.error) {
    return {
      ...demoOrganization,
      authConfigured: true,
      authenticated: true,
      userId: user.id,
      userEmail: email || undefined,
      onboardingRequired: true
    };
  }

  return {
    authenticated: true,
    authConfigured: true,
    userId: user.id,
    userEmail: email || undefined,
    companySlug,
    companyName,
    role: "owner",
    onboardingRequired: false
  };
}

async function claimPendingMembership(user: User): Promise<AccordOrganizationContext | null> {
  const supabase = getSupabaseServerClient();
  const email = normalizeEmail(user.email);
  if (!supabase || !email) return null;

  const { data: invitation, error } = await supabase
    .from("accord_company_members")
    .select("id,company_slug,role")
    .eq("email", email)
    .eq("status", "invited")
    .is("user_id", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !invitation?.id || typeof invitation.company_slug !== "string") return null;

  const { error: updateError } = await supabase
    .from("accord_company_members")
    .update({
      user_id: user.id,
      status: "active",
      updated_at: new Date().toISOString()
    })
    .eq("id", invitation.id);

  if (updateError) return null;

  const { data: company } = await supabase
    .from("accord_companies")
    .select("name")
    .eq("slug", invitation.company_slug)
    .maybeSingle();

  return {
    authenticated: true,
    authConfigured: true,
    userId: user.id,
    userEmail: user.email || undefined,
    companySlug: invitation.company_slug,
    companyName: typeof company?.name === "string" ? company.name : titleFromSlug(invitation.company_slug),
    role: normalizeMemberRole(invitation.role),
    onboardingRequired: false
  };
}

async function findAuthUserByEmail(supabase: SupabaseClient, email: string): Promise<User | null> {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (error || !Array.isArray(data?.users)) return null;

  return data.users.find((candidate) => normalizeEmail(candidate.email) === email) || null;
}

async function reconcileAcceptedInvitations(supabase: SupabaseClient, companySlug: string) {
  const { data: invitations, error } = await supabase
    .from("accord_company_members")
    .select("id,email")
    .eq("company_slug", companySlug)
    .eq("status", "invited")
    .is("user_id", null);

  if (error || !Array.isArray(invitations) || invitations.length === 0) return;

  const pendingByEmail = new Map<string, string>();
  for (const invitation of invitations) {
    const id = typeof invitation.id === "string" ? invitation.id : "";
    const email = normalizeEmail(invitation.email);
    if (id && email) pendingByEmail.set(email, id);
  }

  if (pendingByEmail.size === 0) return;

  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (authError || !Array.isArray(authUsers?.users)) return;

  const now = new Date().toISOString();
  await Promise.all(
    authUsers.users.map(async (user) => {
      const email = normalizeEmail(user.email);
      const invitationId = pendingByEmail.get(email);
      if (!invitationId || !hasAcceptedAuthInvite(user)) return;

      await supabase
        .from("accord_company_members")
        .update({
          user_id: user.id,
          status: "active",
          updated_at: now
        })
        .eq("id", invitationId)
        .is("user_id", null);
    })
  );
}

function hasAcceptedAuthInvite(user: User) {
  const authUser = user as User & {
    confirmed_at?: string | null;
    email_confirmed_at?: string | null;
    last_sign_in_at?: string | null;
  };

  return Boolean(authUser.confirmed_at || authUser.email_confirmed_at || authUser.last_sign_in_at);
}

async function sendOrganizationInviteEmail({
  supabase,
  organization,
  email,
  role
}: {
  supabase: SupabaseClient;
  organization: AccordOrganizationContext;
  email: string;
  role: OrganizationRole;
}) {
  const baseUrl = appBaseUrl();
  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: buildAuthCallbackUrl("/settings"),
    data: {
      accord_invite: true,
      company_name: organization.companyName,
      organization_name: organization.companyName,
      company_slug: organization.companySlug,
      invited_role: role,
      invited_as: role,
      accord_logo_url: `${baseUrl}/email/accord-logo.png`,
      accord_wordmark_url: `${baseUrl}/email/accord-logo-wordmark.png`
    }
  });

  if (error) {
    const inviteError = error as typeof error & { code?: string; status?: number };
    console.error("Accord invite email failed", {
      code: inviteError.code,
      status: inviteError.status,
      name: error.name,
      message: error.message
    });

    return { ok: false, message: error.message };
  }

  return { ok: true, message: "Invite email sent." };
}

function inviteEmailFailedResult(message?: string): OrganizationMemberResult {
  const normalizedMessage = message || "Unknown Supabase invite email error.";
  const alreadyRegistered = /already.*registered|already.*exists|user.*exists/i.test(normalizedMessage);

  return {
    ok: false,
    emailSent: false,
    message: alreadyRegistered
      ? "That email already has a confirmed Supabase Auth user. Ask them to sign in with that email, then Accord will attach them to the workspace."
      : "Invitation was saved, but Supabase could not hand the email to SMTP. Check Supabase Auth logs and Resend logs for the delivery error."
  };
}

function buildAuthCallbackUrl(returnTo: string) {
  const callbackUrl = new URL("/auth/callback", appBaseUrl());
  callbackUrl.searchParams.set("returnTo", returnTo);
  return callbackUrl.toString();
}

function appBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.SITE_URL || "";
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "";
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

function organizationNameFromUser(user: User) {
  const metadata = user.user_metadata || {};
  const fullName = typeof metadata.full_name === "string" ? metadata.full_name : "";
  const email = user.email || "";
  const domain = email.includes("@") ? email.split("@")[1] : "";
  const companyDomain = domain && !/^(gmail|googlemail|outlook|hotmail|icloud|yahoo|aol)\./.test(domain);

  if (companyDomain) {
    const name = domain.split(".")[0];
    return `${titleFromSlug(name)} Workspace`;
  }

  if (fullName.trim()) return `${fullName.trim().split(/\s+/)[0]}'s Workspace`;
  if (email) return `${email.split("@")[0]}'s Workspace`;
  return "Accord Workspace";
}

function normalizeRole(value: unknown): OrganizationRole {
  return normalizeMemberRole(value);
}

function normalizeMemberRole(value: unknown): OrganizationRole {
  return value === "owner" || value === "admin" || value === "member" || value === "viewer" ? value : "member";
}

function normalizeMemberStatus(value: unknown): OrganizationMemberStatus {
  return value === "active" || value === "invited" || value === "suspended" ? value : "invited";
}

function normalizeEmail(value: FormDataEntryValue | string | null | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeCompanyName(value: FormDataEntryValue | string | null | undefined) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 80) : "";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function titleFromSlug(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
