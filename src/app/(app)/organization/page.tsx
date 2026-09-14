import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Activity, Clock3, ShieldAlert, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  addOrganizationMemberFromForm,
  canManageOrganization,
  getAccordOrganizationContext,
  getOrganizationPeople,
  resendOrganizationInviteFromForm,
  updateOrganizationNameFromForm,
  type AccordOrganizationPerson
} from "@/lib/auth/organization";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type OrganizationPageProps = {
  searchParams?: {
    member?: string | string[];
    workspace?: string | string[];
  };
};

export default async function OrganizationPage({ searchParams }: OrganizationPageProps) {
  const organization = await getAccordOrganizationContext({ autoCreate: true });
  const canManage = canManageOrganization(organization.role);
  const people = canManage
    ? await getOrganizationPeople(organization.companySlug, organization.userId)
    : [];
  const memberStatus = firstParam(searchParams?.member);
  const workspaceStatus = firstParam(searchParams?.workspace);
  const activePeople = people.filter((person) => person.status === "active");
  const auditedPeople = activePeople.filter((person) => person.auditCount > 0);
  const organizationAverage = auditedPeople.length
    ? Math.round(auditedPeople.reduce((sum, person) => sum + person.averageRiskScore, 0) / auditedPeople.length)
    : 0;
  const latestAuditAt = auditedPeople
    .map((person) => person.lastAuditAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);

  return (
    <div className="app-geist space-y-6">
      <PageHeader
        eyebrow={organization.companyName}
        title="Organization"
        description="Understand employee AI usage, compare risk, and manage workspace access."
      />

      {!canManage ? (
        <section className="rounded-lg border border-accord-border bg-accord-panel px-5 py-6">
          <h2 className="text-sm font-semibold text-accord-text">Admin access required</h2>
          <p className="mt-1 text-sm leading-6 text-accord-muted">
            Organization-level employee risk and membership details are available to workspace owners and admins.
          </p>
        </section>
      ) : (
        <>
          <section className="grid divide-y divide-accord-border rounded-lg border border-accord-border bg-accord-panel sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
            <Metric icon={UsersRound} label="Active members" value={String(activePeople.length)} detail={`${people.length} total seats`} />
            <Metric icon={ShieldAlert} label="Average risk" value={String(organizationAverage)} detail="Across members with audits" />
            <Metric icon={Activity} label="Audit events" value={auditedPeople.reduce((sum, person) => sum + person.auditCount, 0).toLocaleString("en-US")} detail={`${auditedPeople.length} members reporting`} />
            <Metric icon={Clock3} label="Latest audit" value={latestAuditAt ? formatRelativeTime(latestAuditAt) : "No activity"} detail={latestAuditAt ? formatTimestamp(latestAuditAt) : "Waiting for Guard events"} />
          </section>

          <section className="overflow-hidden rounded-lg border border-accord-border bg-accord-panel">
            <div className="flex flex-col gap-2 border-b border-accord-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-accord-text">Employee risk leaderboard</h2>
                <p className="mt-0.5 text-xs text-accord-muted">Ranked by average Guard risk score, then highest observed score.</p>
              </div>
              <span className="w-fit rounded-full bg-accord-surface px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                {people.length} people
              </span>
            </div>

            <div className="hidden grid-cols-[52px_minmax(220px,1.35fr)_minmax(120px,0.7fr)_110px_110px_150px_90px] gap-3 border-b border-accord-border bg-accord-surface/60 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-600 dark:text-slate-300 xl:grid">
              <span>Rank</span>
              <span>Employee</span>
              <span>Metadata</span>
              <span>Average</span>
              <span>Highest</span>
              <span>Most recent audit</span>
              <span>Events</span>
            </div>

            <div className="divide-y divide-accord-border/70">
              {people.length ? people.map((person, index) => <PersonRow key={person.id} person={person} rank={index + 1} />) : (
                <p className="px-4 py-8 text-center text-sm text-accord-muted">No organization members have been created yet.</p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-accord-border bg-accord-panel">
            <div className="border-b border-accord-border px-4 py-3">
              <h2 className="text-sm font-semibold text-accord-text">Manage organization</h2>
              <p className="mt-0.5 text-xs text-accord-muted">The same workspace and invitation workflow available in Settings.</p>
            </div>

            <div className="grid gap-4 p-4 xl:grid-cols-[0.72fr_1.28fr]">
              <div className="rounded-lg border border-accord-border bg-accord-surface/35 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-600 dark:text-slate-300">Workspace</p>
                <form action={updateWorkspaceAction} className="mt-3 space-y-3">
                  <label className="grid gap-1.5 text-xs font-semibold text-accord-text">
                    Company name
                    <input name="companyName" defaultValue={organization.companyName} required minLength={2} maxLength={80} className={inputClass} />
                  </label>
                  <button type="submit" className={primaryButtonClass}>Save workspace</button>
                </form>
                {workspaceStatus ? <Notice kind={workspaceStatus === "saved" ? "success" : "error"} text={workspaceStatus === "saved" ? "Workspace name saved." : "Could not save the workspace name."} /> : null}
                <dl className="mt-5 space-y-2.5 text-xs">
                  <MetaRow label="Workspace ID" value={organization.companySlug} mono />
                  <MetaRow label="Your access" value={organization.role} />
                </dl>
              </div>

              <div className="overflow-hidden rounded-lg border border-accord-border">
                <div className="border-b border-accord-border px-4 py-3">
                  <h3 className="text-sm font-semibold text-accord-text">Invite teammates</h3>
                  <p className="mt-0.5 text-xs text-accord-muted">New teammates join after accepting their Supabase Auth invitation.</p>
                </div>
                {memberStatus ? <MemberNotice status={memberStatus} /> : null}
                <form action={addMemberAction} className="grid gap-3 p-4 md:grid-cols-[1fr_150px_auto]">
                  <label className="grid gap-1.5 text-xs font-semibold text-accord-text">
                    Work email
                    <input name="email" type="email" required autoComplete="email" placeholder="teammate@company.com" className={inputClass} />
                  </label>
                  <label className="grid gap-1.5 text-xs font-semibold text-accord-text">
                    Role
                    <select name="role" defaultValue="member" className={inputClass}>
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </label>
                  <button type="submit" className={cn(primaryButtonClass, "self-end py-2.5")}>Send invite</button>
                </form>

                <div className="divide-y divide-accord-border border-t border-accord-border">
                  {people.map((person) => (
                    <div key={person.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar person={person} size="small" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-accord-text">{person.displayName}</p>
                          <p className="truncate text-xs text-accord-muted">{person.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {person.status === "invited" ? (
                          <form action={resendMemberInviteAction}>
                            <input type="hidden" name="memberId" value={person.id} />
                            <button type="submit" className="rounded-full border border-accord-border px-3 py-1 text-xs font-semibold text-accord-text hover:bg-accord-surface">Resend</button>
                          </form>
                        ) : null}
                        <Pill value={person.role} />
                        <Pill value={person.status} tone={person.status === "active" ? "green" : "purple"} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

async function addMemberAction(formData: FormData) {
  "use server";
  const result = await addOrganizationMemberFromForm(formData);
  revalidatePath("/organization");
  revalidatePath("/settings");
  redirect(`/organization?member=${result.ok ? (result.emailSent ? "invited" : "added") : "error"}`);
}

async function resendMemberInviteAction(formData: FormData) {
  "use server";
  const result = await resendOrganizationInviteFromForm(formData);
  revalidatePath("/organization");
  revalidatePath("/settings");
  redirect(`/organization?member=${result.ok ? (result.emailSent ? "resent" : "added") : "error"}`);
}

async function updateWorkspaceAction(formData: FormData) {
  "use server";
  const result = await updateOrganizationNameFromForm(formData);
  revalidatePath("/organization");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect(`/organization?workspace=${result.ok ? "saved" : "error"}`);
}

function PersonRow({ person, rank }: { person: AccordOrganizationPerson; rank: number }) {
  return (
    <article className="grid gap-4 px-4 py-4 xl:grid-cols-[52px_minmax(220px,1.35fr)_minmax(120px,0.7fr)_110px_110px_150px_90px] xl:items-center">
      <p className="font-mono text-sm font-semibold text-slate-600 dark:text-slate-300">#{rank}</p>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar person={person} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-accord-text">{person.displayName}</p>
            {person.isCurrentUser ? <span className="text-xs font-semibold text-accord-primary">You</span> : null}
          </div>
          <p className="truncate text-xs text-accord-muted">{person.email}</p>
        </div>
      </div>
      <div className="text-xs leading-5 text-accord-muted">
        <p>{person.department || "No department"}</p>
        <p>{person.surface ? `${labelize(person.surface)} surface` : person.status === "invited" ? "Invite pending" : "No Guard activity"}</p>
      </div>
      <Score value={person.averageRiskScore} level={person.riskLevel} label="Average risk" />
      <Score value={person.highestRiskScore} level={person.auditCount ? riskLevel(person.highestRiskScore) : "low"} label="Highest risk" />
      <div>
        <p className="text-sm font-medium text-accord-text">{person.lastAuditAt ? formatRelativeTime(person.lastAuditAt) : "No audits"}</p>
        <p className="mt-0.5 text-[11px] text-accord-muted">{person.lastAuditAt ? formatTimestamp(person.lastAuditAt) : person.status}</p>
      </div>
      <div>
        <p className="text-sm font-semibold text-accord-text">{person.auditCount.toLocaleString("en-US")}</p>
        <p className="text-[11px] text-accord-muted">events</p>
      </div>
    </article>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof UsersRound; label: string; value: string; detail: string }) {
  return (
    <article className="px-4 py-4">
      <div className="flex items-center gap-2 text-xs font-medium text-accord-muted"><Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}</div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-accord-text">{value}</p>
      <p className="mt-1 text-xs text-accord-muted">{detail}</p>
    </article>
  );
}

function Avatar({ person, size = "default" }: { person: AccordOrganizationPerson; size?: "default" | "small" }) {
  const classes = size === "small" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  if (person.avatarUrl) {
    // Auth providers can return arbitrary trusted profile hosts, so this cannot use a static Next Image allowlist.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={person.avatarUrl} alt="" referrerPolicy="no-referrer" className={cn(classes, "shrink-0 rounded-full border border-accord-border object-cover")} />;
  }
  return <div aria-hidden="true" className={cn(classes, "flex shrink-0 items-center justify-center rounded-full bg-accord-night font-semibold text-white")}>{initials(person.displayName)}</div>;
}

function Score({ value, level, label }: { value: number; level: "low" | "medium" | "high" | "critical"; label: string }) {
  const tone = level === "critical" ? "text-rose-700 bg-rose-50" : level === "high" ? "text-orange-700 bg-orange-50" : level === "medium" ? "text-amber-700 bg-amber-50" : "text-emerald-700 bg-emerald-50";
  return <div><span className={cn("inline-flex min-w-12 justify-center rounded-md px-2 py-1 font-mono text-sm font-semibold", tone)}>{value}</span><span className="sr-only"> {label}</span></div>;
}

function Pill({ value, tone = "slate" }: { value: string; tone?: "green" | "purple" | "slate" }) {
  const colors = tone === "green" ? "bg-emerald-50 text-emerald-700" : tone === "purple" ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-700";
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold capitalize", colors)}>{value}</span>;
}

function Notice({ kind, text }: { kind: "success" | "error"; text: string }) {
  return <p className={cn("mt-3 rounded-md border px-3 py-2 text-xs", kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800")}>{text}</p>;
}

function MemberNotice({ status }: { status: string }) {
  const success = status === "added" || status === "invited" || status === "resent";
  const text = status === "invited" ? "Invite email sent." : status === "resent" ? "Invite email resent." : status === "added" ? "Organization member saved." : "Could not save that member or send the invitation.";
  return <div className="px-4"><Notice kind={success ? "success" : "error"} text={text} /></div>;
}

function MetaRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-accord-muted">{label}</dt><dd className={cn("truncate font-semibold capitalize text-accord-text", mono && "font-mono text-[11px] uppercase")}>{value}</dd></div>;
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function riskLevel(score: number) {
  if (score >= 80) return "critical" as const;
  if (score >= 60) return "high" as const;
  if (score >= 35) return "medium" as const;
  return "low" as const;
}

function labelize(value: string) {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "A";
}

function formatRelativeTime(value: string) {
  const elapsed = Date.now() - Date.parse(value);
  if (!Number.isFinite(elapsed) || elapsed < 0) return "Just now";
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

const inputClass = "h-10 w-full rounded-md border border-accord-border bg-accord-panel px-3 text-sm font-normal text-accord-text outline-none transition-colors placeholder:text-accord-muted focus:border-accord-primary";
const primaryButtonClass = "rounded-md bg-accord-night px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-accord-text";
