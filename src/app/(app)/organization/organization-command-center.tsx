"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Search, ShieldCheck, UsersRound } from "lucide-react";
import type { OrganizationDateRange, OrganizationOverview, OrganizationPersonSummary } from "@/lib/organization/types";
import { cn } from "@/lib/utils";
import { EmployeeDetailDrawer } from "./employee-detail-drawer";
import { RiskActivityChart } from "./risk-activity-chart";

type SortKey = "risk" | "events" | "latest";
type SortDirection = "asc" | "desc";

export function OrganizationCommandCenter({ overview, initialPersonId }: { overview: OrganizationOverview; initialPersonId?: string }) {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [surfaceFilter, setSurfaceFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("risk");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedId, setSelectedId] = useState(() => overview.people.some((person) => person.id === initialPersonId) ? initialPersonId || null : null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const departments = useMemo(() => Array.from(new Set(overview.people.flatMap((person) => person.department ? [person.department] : []))).sort(), [overview.people]);
  const surfaces = useMemo(() => Array.from(new Set(overview.people.flatMap((person) => person.surfaces))).sort(), [overview.people]);
  const visiblePeople = useMemo(() => {
    const query = search.trim().toLowerCase();
    return overview.people.filter((person) => {
      if (query && ![person.displayName, person.email, person.department || "", person.topPolicyLabel || ""].some((value) => value.toLowerCase().includes(query))) return false;
      if (riskFilter === "no_activity" && person.auditCount > 0) return false;
      if (riskFilter !== "all" && riskFilter !== "no_activity" && (person.auditCount === 0 || person.riskLevel !== riskFilter)) return false;
      if (statusFilter !== "all" && person.coverageStatus !== statusFilter) return false;
      if (departmentFilter !== "all" && person.department !== departmentFilter) return false;
      if (surfaceFilter !== "all" && !person.surfaces.includes(surfaceFilter)) return false;
      if (actionFilter === "enforced" && person.enforcementCount === 0) return false;
      if (actionFilter === "not_enforced" && person.enforcementCount > 0) return false;
      return true;
    }).sort((a, b) => {
      const direction = sortDirection === "desc" ? 1 : -1;
      if (sortKey === "events") return direction * (b.riskEventCount - a.riskEventCount);
      if (sortKey === "latest") return direction * (Date.parse(b.lastAuditAt || "1970-01-01") - Date.parse(a.lastAuditAt || "1970-01-01"));
      if (!a.auditCount && b.auditCount) return sortDirection === "desc" ? 1 : -1;
      if (a.auditCount && !b.auditCount) return sortDirection === "desc" ? -1 : 1;
      return direction * (b.averageRiskScore - a.averageRiskScore || b.riskEventCount - a.riskEventCount);
    });
  }, [actionFilter, departmentFilter, overview.people, riskFilter, search, sortDirection, sortKey, statusFilter, surfaceFilter]);
  const selectedPerson = overview.people.find((person) => person.id === selectedId) || null;

  const closeDrawer = useCallback(() => {
    setSelectedId(null);
    updatePersonQuery(null);
    window.setTimeout(() => lastTriggerRef.current?.focus(), 0);
  }, []);

  function openDrawer(person: OrganizationPersonSummary, trigger: HTMLElement) {
    lastTriggerRef.current = trigger;
    setSelectedId(person.id);
    updatePersonQuery(person.id);
  }

  function updateSort(next: SortKey) {
    if (sortKey === next) setSortDirection((current) => current === "desc" ? "asc" : "desc");
    else {
      setSortKey(next);
      setSortDirection("desc");
    }
  }

  return (
    <>
      <div className="space-y-5">
        <SummaryStrip overview={overview} />

        <section className="grid overflow-hidden rounded-lg border border-accord-border bg-accord-panel xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.65fr)]">
          <div className="border-b border-accord-border p-4 xl:border-b-0 xl:border-r">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-accord-text">Risk activity</h2>
                <p className="mt-0.5 text-xs text-accord-muted">Governed events and enforcement over the selected range.</p>
              </div>
              <span className="rounded-md bg-accord-surface px-2 py-1 font-mono text-xs font-semibold text-accord-text">{overview.metrics.totalEvents.toLocaleString("en-US")}</span>
            </div>
            <div className="mt-3"><RiskActivityChart data={overview.trend} /></div>
          </div>
          <div className="p-4">
            <h3 className="text-sm font-semibold text-accord-text">Event breakdown</h3>
            <p className="mt-0.5 text-xs text-accord-muted">Outcome distribution, excluding response rehydration.</p>
            <div className="mt-5 space-y-3">
              {overview.breakdown.length ? overview.breakdown.map((item) => {
                const percentage = overview.breakdown.reduce((sum, candidate) => sum + candidate.count, 0) ? Math.round((item.count / overview.breakdown.reduce((sum, candidate) => sum + candidate.count, 0)) * 100) : 0;
                return (
                  <div key={item.category}>
                    <div className="flex items-center justify-between gap-3 text-xs"><span className="font-medium text-accord-text">{item.label}</span><span className="font-mono text-accord-muted">{item.count} · {percentage}%</span></div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-accord-surface"><div className={cn("h-full rounded-full", breakdownTone(item.category))} style={{ width: `${percentage}%` }} /></div>
                  </div>
                );
              }) : <p className="rounded-md border border-dashed border-accord-border px-3 py-5 text-center text-xs text-accord-muted">No governed events in this range.</p>}
            </div>
            {overview.surfaces.length ? <p className="mt-5 border-t border-accord-border pt-3 text-[11px] text-accord-faint">Top surface: <span className="font-semibold text-accord-muted">{labelize(overview.surfaces[0].name)}</span> · {overview.surfaces[0].count} events</p> : null}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-accord-border bg-accord-panel">
          <div className="border-b border-accord-border px-4 py-3.5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-accord-text">People</h2>
                <p className="mt-0.5 text-xs text-accord-muted">Investigate individual risk posture and complete governance activity.</p>
              </div>
              <label className="relative block w-full lg:w-72">
                <span className="sr-only">Search people</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-accord-faint" aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, policy…" className="h-9 w-full rounded-md border border-accord-border bg-accord-panel pl-9 pr-3 text-xs text-accord-text outline-none placeholder:text-accord-faint focus:border-accord-primary focus:ring-2 focus:ring-accord-primary/15" />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <FilterSelect label="Risk" value={riskFilter} onChange={setRiskFilter} options={[["all", "All risk"], ["critical", "Critical"], ["high", "High"], ["moderate", "Moderate"], ["low", "Low"], ["no_activity", "No activity"]]} />
              <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={[["all", "All status"], ["reporting", "Reporting"], ["no_recent_activity", "No recent activity"], ["not_reporting", "Not reporting"], ["invite_pending", "Invite pending"], ["suspended", "Suspended"]]} />
              {departments.length ? <FilterSelect label="Department" value={departmentFilter} onChange={setDepartmentFilter} options={[["all", "All departments"], ...departments.map((value) => [value, value])]} /> : null}
              {surfaces.length ? <FilterSelect label="Surface" value={surfaceFilter} onChange={setSurfaceFilter} options={[["all", "All surfaces"], ...surfaces.map((value) => [value, labelize(value)])]} /> : null}
              <FilterSelect label="Action" value={actionFilter} onChange={setActionFilter} options={[["all", "All actions"], ["enforced", "Enforced"], ["not_enforced", "No enforcement"]]} />
              <span className="ml-auto text-[11px] font-medium text-accord-faint">{visiblePeople.length} of {overview.people.length}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="border-b border-accord-border bg-accord-surface/60 text-[10px] font-semibold uppercase tracking-[0.055em] text-accord-faint">
                  <th className="px-4 py-2.5">Employee</th>
                  <th className="px-3 py-2.5">Status</th>
                  <SortableHeader label="Risk" active={sortKey === "risk"} direction={sortDirection} onClick={() => updateSort("risk")} />
                  <SortableHeader label="Risk events" active={sortKey === "events"} direction={sortDirection} onClick={() => updateSort("events")} />
                  <th className="px-3 py-2.5">Enforcement</th>
                  <th className="px-3 py-2.5">Top policy</th>
                  <SortableHeader label="Last active" active={sortKey === "latest"} direction={sortDirection} onClick={() => updateSort("latest")} />
                  <th className="w-10 px-2 py-2.5"><span className="sr-only">Open details</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accord-border/75">
                {visiblePeople.map((person) => (
                  <tr
                    key={person.id}
                    tabIndex={0}
                    aria-label={`Open ${person.displayName} details`}
                    onClick={(event) => { if (!(event.target as Element).closest("button")) openDrawer(person, event.currentTarget); }}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDrawer(person, event.currentTarget); } }}
                    className="group cursor-pointer transition-colors hover:bg-accord-surface/55 focus:bg-accord-surface/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accord-primary/30"
                  >
                    <td className="px-4 py-3">
                      <button type="button" onClick={(event) => openDrawer(person, event.currentTarget)} className="flex w-full min-w-0 items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accord-primary/30">
                        <Avatar person={person} />
                        <span className="min-w-0"><span className="flex items-center gap-2"><span className="block truncate text-sm font-semibold text-accord-text">{person.displayName}</span>{person.isCurrentUser ? <span className="text-[10px] font-semibold text-accord-primary">You</span> : null}</span><span className="block truncate text-[11px] text-accord-muted">{person.department || person.email}</span></span>
                      </button>
                    </td>
                    <td className="px-3 py-3"><CoverageBadge status={person.coverageStatus} /></td>
                    <td className="px-3 py-3"><RiskCell person={person} /></td>
                    <td className="px-3 py-3"><p className="font-mono text-sm font-semibold text-accord-text">{person.riskEventCount}</p><p className="mt-0.5 text-[10px] text-accord-faint">{person.auditCount} total</p></td>
                    <td className="px-3 py-3"><p className="text-xs font-semibold text-accord-text">{person.enforcementRate}%</p><p className="mt-0.5 text-[10px] text-accord-faint">{person.enforcementCount} actions</p></td>
                    <td className="max-w-[210px] px-3 py-3"><p className="truncate text-xs font-medium text-accord-text" title={person.topPolicyLabel}>{person.topPolicyLabel || "No policy triggered"}</p></td>
                    <td className="px-3 py-3"><p className="text-xs font-medium text-accord-text">{person.lastAuditAt ? relativeTime(person.lastAuditAt) : "No activity"}</p><p className="mt-0.5 text-[10px] text-accord-faint">{person.lastAuditAt ? formatDate(person.lastAuditAt) : coverageLabel(person.coverageStatus)}</p></td>
                    <td className="px-2 py-3"><button type="button" onClick={(event) => openDrawer(person, event.currentTarget)} className="rounded-md p-1.5 text-accord-faint group-hover:text-accord-text hover:bg-accord-surface focus:outline-none focus:ring-2 focus:ring-accord-primary/30" aria-label={`Open ${person.displayName} details`}><ChevronRight className="h-4 w-4" aria-hidden="true" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visiblePeople.length ? <p className="px-4 py-10 text-center text-sm text-accord-muted">No people match the current filters.</p> : null}
          </div>
          {overview.isTruncated ? <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-[11px] text-amber-800">Overview metrics use the most recent 1,500 lightweight telemetry rows. Open an employee to inspect paginated activity.</p> : null}
        </section>
      </div>
      <EmployeeDetailDrawer person={selectedPerson} range={overview.range} onClose={closeDrawer} />
    </>
  );
}

function SummaryStrip({ overview }: { overview: OrganizationOverview }) {
  const trend = overview.metrics.riskEventTrendPercent;
  return (
    <section className="grid overflow-hidden rounded-lg border border-accord-border bg-accord-panel sm:grid-cols-2 xl:grid-cols-5">
      <SummaryMetric icon={UsersRound} label="Active / reporting" value={`${overview.metrics.activeMembers} / ${overview.metrics.reportingMembers}`} detail={overview.metrics.activeMembers === overview.metrics.reportingMembers ? "all active members reporting" : `${overview.metrics.activeMembers - overview.metrics.reportingMembers} active not reporting`} />
      <SummaryMetric label="Risk events" value={overview.metrics.riskEvents.toLocaleString("en-US")} detail={trend === undefined ? "new vs prior period" : `${trend > 0 ? "+" : ""}${trend}% vs prior`} trend={trend} />
      <SummaryMetric label="High-risk users" value={String(overview.metrics.highRiskUsers)} detail="average score 50+" />
      <SummaryMetric icon={ShieldCheck} label="Enforcement" value={`${overview.metrics.enforcementRate}%`} detail={`${overview.metrics.blockedEvents} blocked · ${overview.metrics.redactedEvents} redacted`} />
      <SummaryMetric label="Coverage" value={`${overview.metrics.coverageRate}%`} detail="active members reporting" />
    </section>
  );
}

function SummaryMetric({ icon: Icon, label, value, detail, trend }: { icon?: typeof UsersRound; label: string; value: string; detail: string; trend?: number }) {
  return <article className="border-b border-accord-border px-4 py-3.5 last:border-b-0 sm:border-r sm:[&:nth-child(2)]:border-r-0 xl:border-b-0 xl:[&:nth-child(2)]:border-r xl:last:border-r-0"><div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.055em] text-accord-faint">{Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}{label}</div><div className="mt-1.5 flex items-baseline gap-2"><p className="font-mono text-xl font-semibold tracking-tight text-accord-text">{value}</p>{trend !== undefined && trend !== 0 ? trend > 0 ? <ArrowUp className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" /> : <ArrowDown className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : null}</div><p className="mt-0.5 text-[10px] text-accord-muted">{detail}</p></article>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label><span className="sr-only">{label}</span><select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-8 rounded-md border border-accord-border bg-accord-panel px-2 text-[11px] font-medium text-accord-text outline-none hover:bg-accord-surface focus:border-accord-primary">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function SortableHeader({ label, active, direction, onClick }: { label: string; active: boolean; direction: SortDirection; onClick: () => void }) {
  const Icon = active ? direction === "desc" ? ArrowDown : ArrowUp : ArrowUpDown;
  return <th className="px-3 py-2.5"><button type="button" onClick={onClick} className={cn("flex items-center gap-1 uppercase hover:text-accord-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accord-primary/30", active && "text-accord-text")}>{label}<Icon className="h-3 w-3" aria-hidden="true" /></button></th>;
}

function RiskCell({ person }: { person: OrganizationPersonSummary }) {
  if (!person.auditCount) return <div><p className="text-xs font-semibold text-accord-muted">No activity</p><p className="mt-0.5 text-[10px] text-accord-faint">Not scored</p></div>;
  return <div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", riskTone(person.riskLevel))} /><div><p className="font-mono text-sm font-semibold text-accord-text">{person.averageRiskScore}</p><p className="text-[10px] capitalize text-accord-faint">{person.riskLevel}</p></div></div>;
}

function CoverageBadge({ status }: { status: OrganizationPersonSummary["coverageStatus"] }) {
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accord-text"><span className={cn("h-1.5 w-1.5 rounded-full", status === "reporting" ? "bg-emerald-500" : status === "invite_pending" ? "bg-amber-500" : status === "suspended" ? "bg-rose-500" : "bg-slate-400")} />{coverageLabel(status)}</span>;
}

function Avatar({ person }: { person: OrganizationPersonSummary }) {
  if (person.avatarUrl) {
    // Auth profile images may come from several trusted identity providers.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={person.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-9 w-9 shrink-0 rounded-full border border-accord-border object-cover" />;
  }
  return <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accord-night text-xs font-semibold text-white">{initials(person.displayName)}</span>;
}

function updatePersonQuery(personId: string | null) {
  const url = new URL(window.location.href);
  if (personId) url.searchParams.set("person", personId);
  else url.searchParams.delete("person");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function breakdownTone(category: string) {
  if (category === "blocked" || category === "error") return "bg-rose-500";
  if (category === "allowed") return "bg-emerald-500";
  if (category === "redacted" || category === "held") return "bg-violet-500";
  return "bg-amber-500";
}

function riskTone(level: OrganizationPersonSummary["riskLevel"]) {
  return level === "critical" ? "bg-rose-600" : level === "high" ? "bg-orange-500" : level === "moderate" ? "bg-amber-500" : "bg-emerald-500";
}

function coverageLabel(status: OrganizationPersonSummary["coverageStatus"]) {
  return status === "reporting" ? "Reporting" : status === "no_recent_activity" ? "No recent activity" : status === "not_reporting" ? "Not reporting" : status === "invite_pending" ? "Invite pending" : "Suspended";
}

function relativeTime(value: string) {
  const elapsed = Date.now() - Date.parse(value);
  if (!Number.isFinite(elapsed) || elapsed < 60000) return "Just now";
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function labelize(value: string) {
  return value.replace(/^accord[._-]/, "").replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "A";
}
