import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { ProviderCard } from "@/components/ui/provider-card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  addOrganizationMemberFromForm,
  canManageOrganization,
  getAccordOrganizationContext,
  getOrganizationMembers,
  resendOrganizationInviteFromForm,
  updateOrganizationNameFromForm,
  type AccordOrganizationMember
} from "@/lib/auth/organization";
import { privacyControls, providers } from "@/lib/mock-data";

type SettingsPageProps = {
  searchParams?: {
    member?: string | string[];
    workspace?: string | string[];
  };
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const organization = await getAccordOrganizationContext({ autoCreate: true });
  const members = await getOrganizationMembers(organization.companySlug, organization.userId);
  const canManageMembers = canManageOrganization(organization.role);
  const memberStatus = Array.isArray(searchParams?.member) ? searchParams?.member[0] : searchParams?.member;
  const workspaceStatus = Array.isArray(searchParams?.workspace)
    ? searchParams?.workspace[0]
    : searchParams?.workspace;

  return (
    <div className="app-geist space-y-6">
      <PageHeader
        eyebrow={organization.companyName}
        title="Settings"
        description="Manage the workspace, access, provider connections, and privacy defaults."
      />

      <SettingsPanel title="Appearance">
        <SettingsRow label="Interface theme" hint="Applies to the Accord dashboard on this device">
          <ThemeToggle />
        </SettingsRow>
      </SettingsPanel>

      <SettingsPanel title="Organization" description="Account ownership and members for this Accord workspace.">
        <div className="grid gap-4 p-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-lg border border-accord-border bg-white p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-accord-muted">Workspace</p>
            <form action={updateWorkspaceAction} className="mt-3 space-y-3">
              <label className="grid gap-1.5 text-xs font-semibold text-accord-text">
                Company name
                <input
                  name="companyName"
                  defaultValue={organization.companyName}
                  required
                  minLength={2}
                  maxLength={80}
                  disabled={!canManageMembers}
                  className="h-10 rounded-md border border-accord-border bg-accord-panel px-3 text-sm font-normal text-accord-text outline-none transition-colors placeholder:text-accord-muted/70 focus:border-accord-faint disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
              <button
                type="submit"
                disabled={!canManageMembers}
                className="rounded-md bg-accord-navy px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-accord-text disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Save workspace
              </button>
            </form>

            {workspaceStatus ? <WorkspaceNotice status={workspaceStatus} /> : null}

            <dl className="mt-5 space-y-3 text-[13px]">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-accord-muted">Company slug</dt>
                <dd className="font-mono text-xs uppercase tracking-[0.04em] text-accord-text">
                  {organization.companySlug}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-accord-muted">Signed in as</dt>
                <dd className="truncate text-right font-medium text-accord-text">
                  {organization.userEmail || "Demo user"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-accord-muted">Access</dt>
                <dd>
                  <StatusPill value={organization.role} />
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-accord-border bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-accord-border px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-accord-text">Members</h3>
                <p className="mt-0.5 text-xs text-accord-muted">
                  Invite teammates by email. They join this workspace after accepting the Supabase Auth invite.
                </p>
              </div>
              <span className="rounded-full bg-accord-mist px-2.5 py-1 text-xs font-semibold text-accord-faint">
                {members.length}
              </span>
            </div>

            {memberStatus ? <MemberNotice status={memberStatus} /> : null}

            <form action={addMemberAction} className="grid gap-3 border-b border-accord-border p-4 md:grid-cols-[1fr_150px_auto]">
              <label className="grid gap-1.5 text-xs font-semibold text-accord-text">
                Work email
                <input
                  name="email"
                  type="email"
                  required
                  disabled={!canManageMembers}
                  placeholder="teammate@company.com"
                  className="h-10 rounded-md border border-accord-border bg-accord-panel px-3 text-sm font-normal text-accord-text outline-none transition-colors placeholder:text-accord-muted/70 focus:border-accord-faint disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-accord-text">
                Role
                <select
                  name="role"
                  defaultValue="member"
                  disabled={!canManageMembers}
                  className="h-10 rounded-md border border-accord-border bg-accord-panel px-3 text-sm font-normal text-accord-text outline-none transition-colors focus:border-accord-faint disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={!canManageMembers}
                className="self-end rounded-md bg-accord-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accord-text disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Send invite
              </button>
            </form>

            {!canManageMembers ? (
              <p className="border-b border-accord-border px-4 py-3 text-xs text-accord-muted">
                Only organization owners and admins can add members.
              </p>
            ) : null}

            <div className="divide-y divide-accord-border">
              {members.length ? (
                members.map((member) => (
                  <MemberRow key={member.id} member={member} canManageMembers={canManageMembers} />
                ))
              ) : (
                <p className="px-4 py-5 text-sm text-accord-muted">No organization members have been created yet.</p>
              )}
            </div>
          </div>
        </div>
      </SettingsPanel>

      <SettingsPanel
        title="Providers"
        action={
          <Link
            href="/api-tokens"
            className="inline-flex h-8 items-center rounded-md border border-accord-border bg-accord-panel px-3 text-[13px] font-medium text-accord-text transition-colors hover:border-accord-faint"
          >
            Manage API tokens
          </Link>
        }
      >
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {providers.map((provider) => (
            <ProviderCard key={provider.name} provider={provider} />
          ))}
        </div>
      </SettingsPanel>

      <SettingsPanel
        title="Privacy and retention"
        description="Governance without broad employee content retention. Raw content stays protected by default."
      >
        <div className="divide-y divide-accord-border/60 px-4">
          {privacyControls.map((control) => (
            <div key={control} className="flex items-center gap-2 py-2.5 text-[13px] text-accord-text">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              {control}
            </div>
          ))}
        </div>
      </SettingsPanel>

      <SettingsPanel title="Review access">
        <p className="px-4 py-3.5 text-[13px] leading-5 text-accord-muted">
          Reviewers see redacted previews by default. Raw-content access is disabled unless an approved exception
          workflow is configured.
        </p>
      </SettingsPanel>

      <SettingsPanel title="Integrations">
        <p className="px-4 py-3.5 text-[13px] leading-5 text-accord-muted">
          Identity, SIEM, ticketing, and data-loss prevention systems can be connected as the backend integration layer
          matures.
        </p>
      </SettingsPanel>
    </div>
  );
}

async function addMemberAction(formData: FormData) {
  "use server";

  const result = await addOrganizationMemberFromForm(formData);
  revalidatePath("/settings");
  redirect(`/settings?member=${result.ok ? (result.emailSent ? "invited" : "added") : "error"}`);
}

async function resendMemberInviteAction(formData: FormData) {
  "use server";

  const result = await resendOrganizationInviteFromForm(formData);
  revalidatePath("/settings");
  redirect(`/settings?member=${result.ok ? (result.emailSent ? "resent" : "added") : "error"}`);
}

async function updateWorkspaceAction(formData: FormData) {
  "use server";

  const result = await updateOrganizationNameFromForm(formData);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/policies");
  redirect(`/settings?workspace=${result.ok ? "saved" : "error"}`);
}

function MemberRow({
  member,
  canManageMembers
}: {
  member: AccordOrganizationMember;
  canManageMembers: boolean;
}) {
  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-accord-text">{member.email}</p>
          {member.isCurrentUser ? <span className="text-xs font-medium text-accord-faint">You</span> : null}
        </div>
        <p className="mt-0.5 text-xs text-accord-muted">
          {member.status === "invited"
            ? "Invite sent; waiting for sign-in"
            : member.status === "suspended"
              ? "Suspended"
          : "Active workspace member"}
        </p>
      </div>
      {member.status === "invited" && canManageMembers ? (
        <form action={resendMemberInviteAction}>
          <input type="hidden" name="memberId" value={member.id} />
          <button
            type="submit"
            className="rounded-full border border-accord-border bg-accord-panel px-3 py-1 text-xs font-semibold text-accord-text transition-colors hover:border-accord-faint hover:text-accord-faint"
          >
            Resend
          </button>
        </form>
      ) : null}
      <StatusPill value={member.role} />
      <StatusPill value={member.status} tone={member.status === "active" ? "green" : "purple"} />
    </div>
  );
}

function MemberNotice({ status }: { status: string }) {
  const isGood = status === "added" || status === "invited" || status === "resent";
  const message =
    status === "invited"
      ? "Invite email sent. The teammate joins this workspace when they accept it."
      : status === "resent"
        ? "Invite email resent. If it still does not arrive, check Supabase Auth logs and Resend delivery logs."
      : status === "added"
        ? "Organization member saved. Existing accounts are added directly, so no new invite email is sent."
        : "Could not save that member or send the invite email. Check the email and your Supabase Auth settings.";

  return (
    <div
      className={[
        "mx-4 mt-4 rounded-lg border px-3 py-2 text-sm",
        isGood
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
      ].join(" ")}
    >
      {message}
    </div>
  );
}

function WorkspaceNotice({ status }: { status: string }) {
  const isSaved = status === "saved";

  return (
    <div
      className={[
        "mt-3 rounded-lg border px-3 py-2 text-sm",
        isSaved
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
      ].join(" ")}
    >
      {isSaved ? "Workspace name saved." : "Could not save the workspace name. Check your access and try again."}
    </div>
  );
}

function StatusPill({ value, tone = "slate" }: { value: string; tone?: "green" | "purple" | "slate" }) {
  const toneClasses =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "purple"
        ? "bg-accord-mist text-accord-faint"
        : "bg-slate-100 text-slate-600";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${toneClasses}`}>
      {value}
    </span>
  );
}

function SettingsPanel({
  title,
  description,
  action,
  children
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-accord-border bg-accord-panel">
      <div className="flex items-center justify-between gap-4 border-b border-accord-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-accord-text">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-accord-muted">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function SettingsRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div>
        <p className="text-[13px] font-medium text-accord-text">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-accord-muted">{hint}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
