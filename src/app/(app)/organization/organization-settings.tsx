import { ChevronDown, MailPlus, Settings2 } from "lucide-react";
import type { AccordOrganizationContext } from "@/lib/auth/organization";
import type { OrganizationPersonSummary } from "@/lib/organization/types";
import { cn } from "@/lib/utils";
import { addMemberAction, resendMemberInviteAction, updateWorkspaceAction } from "./actions";

export function OrganizationSettings({
  organization,
  people,
  memberStatus,
  workspaceStatus
}: {
  organization: AccordOrganizationContext;
  people: OrganizationPersonSummary[];
  memberStatus?: string;
  workspaceStatus?: string;
}) {
  return (
    <section id="organization-settings" className="scroll-mt-6 rounded-lg border border-accord-border bg-accord-panel">
      <details className="group" open={Boolean(memberStatus || workspaceStatus)}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 marker:content-none">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-accord-border bg-accord-surface text-accord-muted">
              <Settings2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-accord-text">Organization settings</h2>
              <p className="mt-0.5 text-xs text-accord-muted">Workspace details, access, and invitations.</p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-accord-muted transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>

        <div className="grid gap-4 border-t border-accord-border p-4 xl:grid-cols-[0.7fr_1.3fr]">
          <div className="rounded-md border border-accord-border p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-accord-faint">Workspace</p>
            <form action={updateWorkspaceAction} className="mt-3 space-y-3">
              <label className="grid gap-1.5 text-xs font-semibold text-accord-text">
                Company name
                <input name="companyName" defaultValue={organization.companyName} required minLength={2} maxLength={80} className={inputClass} />
              </label>
              <button type="submit" className={primaryButtonClass}>Save workspace</button>
            </form>
            {workspaceStatus ? <Notice ok={workspaceStatus === "saved"} text={workspaceStatus === "saved" ? "Workspace name saved." : "Could not save the workspace name."} /> : null}
            <dl className="mt-4 space-y-2 text-xs">
              <MetaRow label="Workspace ID" value={organization.companySlug} mono />
              <MetaRow label="Your access" value={organization.role} />
            </dl>
          </div>

          <div className="overflow-hidden rounded-md border border-accord-border">
            <div className="flex items-center gap-2 border-b border-accord-border px-4 py-3">
              <MailPlus className="h-4 w-4 text-accord-muted" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold text-accord-text">Invite and manage members</h3>
                <p className="mt-0.5 text-xs text-accord-muted">Uses the same invitation flow as Settings.</p>
              </div>
            </div>
            {memberStatus ? <MemberNotice status={memberStatus} /> : null}
            <form action={addMemberAction} className="grid gap-3 p-4 md:grid-cols-[1fr_140px_auto]">
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
            <div className="max-h-64 divide-y divide-accord-border overflow-y-auto border-t border-accord-border">
              {people.map((person) => (
                <div key={person.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-accord-text">{person.displayName}</p>
                    <p className="truncate text-xs text-accord-muted">{person.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {person.status === "invited" ? (
                      <form action={resendMemberInviteAction}>
                        <input type="hidden" name="memberId" value={person.id} />
                        <button type="submit" className="rounded-md border border-accord-border px-2.5 py-1 text-xs font-semibold text-accord-text hover:bg-accord-surface">Resend</button>
                      </form>
                    ) : null}
                    <span className="text-xs capitalize text-accord-muted">{person.role}</span>
                    <StatusDot status={person.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}

function StatusDot({ status }: { status: string }) {
  return <span title={status} aria-label={status} className={cn("h-2 w-2 rounded-full", status === "active" ? "bg-emerald-500" : status === "invited" ? "bg-amber-500" : "bg-slate-400")} />;
}

function Notice({ ok, text }: { ok: boolean; text: string }) {
  return <p className={cn("mt-3 rounded-md border px-3 py-2 text-xs", ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800")}>{text}</p>;
}

function MemberNotice({ status }: { status: string }) {
  const ok = ["added", "invited", "resent"].includes(status);
  const text = status === "invited" ? "Invite email sent." : status === "resent" ? "Invite email resent." : status === "added" ? "Organization member saved." : "Could not save that member or send the invitation.";
  return <div className="px-4"><Notice ok={ok} text={text} /></div>;
}

function MetaRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-accord-muted">{label}</dt><dd className={cn("truncate font-semibold capitalize text-accord-text", mono && "font-mono text-[11px] uppercase")}>{value}</dd></div>;
}

const inputClass = "h-10 w-full rounded-md border border-accord-border bg-accord-panel px-3 text-sm font-normal text-accord-text outline-none transition-colors placeholder:text-accord-muted focus:border-accord-primary focus:ring-2 focus:ring-accord-primary/15";
const primaryButtonClass = "rounded-md bg-accord-night px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-accord-text focus:outline-none focus:ring-2 focus:ring-accord-primary/30";
