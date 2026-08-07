import "server-only";

import type { User } from "@supabase/supabase-js";
import { createSupabaseServerAuthClient } from "@/lib/auth/supabase-server";
import { getSupabaseServerClient } from "@/lib/db/accord-store";

export type AccordOrganizationContext = {
  authenticated: boolean;
  authConfigured: boolean;
  userId?: string;
  userEmail?: string;
  companySlug: string;
  companyName: string;
  role: "owner" | "admin" | "member" | "viewer" | "demo";
  onboardingRequired: boolean;
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

async function getFirstMembership(user: User): Promise<AccordOrganizationContext | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("accord_company_members")
    .select("company_slug,role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
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
  const companyName = organizationNameFromUser(user);
  const companySlug = slugify(`${companyName}-${user.id.slice(0, 8)}`) || "test-company";

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

function normalizeRole(value: unknown): AccordOrganizationContext["role"] {
  return value === "owner" || value === "admin" || value === "member" || value === "viewer" ? value : "member";
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
