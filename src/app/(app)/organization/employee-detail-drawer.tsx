"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, Ban, CheckCircle2, ChevronDown, FileLock2, ShieldAlert, ShieldCheck, X } from "lucide-react";
import type {
  OrganizationAuditEvent,
  OrganizationDateRange,
  OrganizationPersonDetail,
  OrganizationPersonSummary
} from "@/lib/organization/types";
import { cn } from "@/lib/utils";

type DrawerTab = "overview" | "activity" | "policies";

export function EmployeeDetailDrawer({
  person,
  range,
  onClose
}: {
  person: OrganizationPersonSummary | null;
  range: OrganizationDateRange;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<OrganizationPersonDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<DrawerTab>("overview");
  const [activityFilter, setActivityFilter] = useState("all");
  const [activitySurface, setActivitySurface] = useState("all");
  const [activityPolicy, setActivityPolicy] = useState("all");
  const [isClosing, setIsClosing] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeTimerRef = useRef<number>();

  const requestClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(onClose, 150);
  }, [isClosing, onClose]);

  useEffect(() => {
    if (!person) return;
    const controller = new AbortController();
    setDetail(null);
    setError("");
    setLoading(true);
    setIsClosing(false);
    setTab("overview");
    setActivityFilter("all");
    setActivitySurface("all");
    setActivityPolicy("all");
    fetch(`/api/organization/members/${encodeURIComponent(person.id)}/activity?range=${range}`, {
      signal: controller.signal,
      cache: "no-store"
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load employee activity.");
        return response.json() as Promise<OrganizationPersonDetail>;
      })
      .then(setDetail)
      .catch((fetchError: unknown) => {
        if (fetchError instanceof Error && fetchError.name !== "AbortError") setError(fetchError.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [person, range]);

  useEffect(() => {
    if (!person) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((element) => !element.hasAttribute("hidden"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [person, requestClose]);

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

  const events = useMemo(() => detail?.events || [], [detail?.events]);
  const visibleEvents = useMemo(
    () => events.filter((event) =>
      (activityFilter === "all" || event.category === activityFilter) &&
      (activitySurface === "all" || event.surface === activitySurface) &&
      (activityPolicy === "all" || event.policyRuleKey === activityPolicy)
    ),
    [activityFilter, activityPolicy, activitySurface, events]
  );

  if (!person) return null;

  async function loadMore() {
    const lastEvent = detail?.events.at(-1);
    if (!detail?.hasMore || !lastEvent || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const response = await fetch(
        `/api/organization/members/${encodeURIComponent(person!.id)}/activity?range=${range}&before=${encodeURIComponent(lastEvent.createdAt)}`,
        { cache: "no-store" }
      );
      if (!response.ok) throw new Error("Could not load more activity.");
      const next = await response.json() as OrganizationPersonDetail;
      setDetail((current) => current ? {
        ...current,
        events: [...current.events, ...next.events.filter((event) => !current.events.some((existing) => existing.id === event.id))],
        policies: mergePolicies(current.policies, next.policies),
        hasMore: next.hasMore
      } : next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load more activity.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-[1px]"
      onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}
      aria-hidden="false"
    >
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-drawer-title"
        className={cn(isClosing ? "accord-drawer-exit" : "accord-drawer-enter", "flex h-full w-full max-w-[640px] flex-col border-l border-accord-border bg-accord-panel shadow-2xl")}
      >
        <header className="shrink-0 border-b border-accord-border px-5 pb-0 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar person={person} size="large" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="employee-drawer-title" className="truncate text-lg font-semibold tracking-tight text-accord-text">{person.displayName}</h2>
                  <CoverageBadge status={person.coverageStatus} />
                </div>
                <p className="truncate text-sm text-accord-muted">{person.email}</p>
                <p className="mt-0.5 text-xs text-accord-faint">{person.department || "Department not set"} · <span className="capitalize">{person.role}</span></p>
              </div>
            </div>
            <button ref={closeRef} type="button" onClick={requestClose} className="rounded-md p-2 text-accord-muted hover:bg-accord-surface hover:text-accord-text focus:outline-none focus:ring-2 focus:ring-accord-primary/30" aria-label="Close employee details">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <nav className="mt-5 flex gap-5" aria-label="Employee details">
            {(["overview", "activity", "policies"] as DrawerTab[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn("border-b-2 px-0.5 pb-3 text-xs font-semibold capitalize transition-colors", tab === value ? "border-accord-primary text-accord-primary" : "border-transparent text-accord-muted hover:text-accord-text")}
                aria-current={tab === value ? "page" : undefined}
              >
                {value}
              </button>
            ))}
          </nav>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? <DrawerSkeleton /> : error && !detail ? <ErrorState message={error} /> : null}
          {!loading && tab === "overview" ? <OverviewTab person={person} events={events} /> : null}
          {!loading && tab === "activity" ? (
            <ActivityTab
              events={visibleEvents}
              totalEvents={events.length}
              filter={activityFilter}
              onFilter={setActivityFilter}
              surface={activitySurface}
              onSurface={setActivitySurface}
              policy={activityPolicy}
              onPolicy={setActivityPolicy}
              allEvents={events}
              hasMore={Boolean(detail?.hasMore)}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
            />
          ) : null}
          {!loading && tab === "policies" ? <PoliciesTab detail={detail} onViewEvents={(policyKey) => { setActivityFilter("all"); setActivityPolicy(policyKey); setTab("activity"); }} /> : null}
          {error && detail ? <p className="mt-4 text-xs font-medium text-rose-700">{error}</p> : null}
        </div>
      </aside>
    </div>
  );
}

function OverviewTab({ person, events }: { person: OrganizationPersonSummary; events: OrganizationAuditEvent[] }) {
  const recentRisk = events.filter((event) => !["allowed", "error"].includes(event.category)).slice(0, 5);
  const outcomes = ["blocked", "redacted", "held", "warning", "flagged", "allowed"]
    .map((category) => ({ category, count: events.filter((event) => event.category === category).length }))
    .filter((item) => item.count > 0);
  const signalCounts = new Map<string, number>();
  for (const event of events) {
    for (const signal of [...event.detectedCategories, ...event.flags]) {
      signalCounts.set(signal, (signalCounts.get(signal) || 0) + 1);
    }
  }
  const signals = Array.from(signalCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return (
    <div className="space-y-6">
      <section>
        <SectionHeading title="Risk posture" description="Calculated from governed events in the selected date range." />
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-accord-border bg-accord-border sm:grid-cols-4">
          <DrawerMetric label="Latest / average" value={person.auditCount ? `${person.latestRiskScore} / ${person.averageRiskScore}` : "—"} />
          <DrawerMetric label="Highest" value={person.auditCount ? String(person.highestRiskScore) : "—"} />
          <DrawerMetric label="Risk events" value={person.riskEventCount.toLocaleString("en-US")} />
          <DrawerMetric label="Enforced" value={`${person.enforcementRate}%`} />
        </div>
        {person.auditCount ? <MiniRiskTrend events={events} /> : null}
        {outcomes.length ? <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">{outcomes.map((item) => <div key={item.category} className="rounded-md bg-accord-surface px-2 py-2 text-center"><p className="font-mono text-sm font-semibold text-accord-text">{item.count}</p><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] text-accord-faint">{item.category}</p></div>)}</div> : null}
        {signals.length ? <div className="mt-3"><p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-accord-faint">Top observed signals</p><div className="mt-1.5 flex flex-wrap gap-1.5">{signals.map(([signal, count]) => <span key={signal} className="rounded bg-accord-surface px-2 py-1 text-[10px] font-medium text-accord-muted">{labelize(signal)} · {count}</span>)}</div></div> : null}
        {!person.auditCount ? <p className="mt-3 rounded-md border border-dashed border-accord-border px-3 py-3 text-xs text-accord-muted">No governed activity was reported in this range. This is not classified as low risk.</p> : null}
      </section>

      <section>
        <SectionHeading title="Coverage" description="Device reporting and observed AI surfaces." />
        <dl className="mt-3 divide-y divide-accord-border rounded-md border border-accord-border">
          <DetailRow label="Reporting status" value={coverageLabel(person.coverageStatus)} />
          <DetailRow label="Joined" value={person.createdAt ? formatTimestamp(person.createdAt) : "Not recorded"} />
          <DetailRow label="Last active" value={person.lastSeenAt ? formatTimestamp(person.lastSeenAt) : "Never reported"} />
          <DetailRow label="Last audit" value={person.lastAuditAt ? formatTimestamp(person.lastAuditAt) : "No audit events"} />
          <DetailRow label="AI surfaces" value={person.surfaces.length ? person.surfaces.map(labelize).join(", ") : "None observed"} />
          <DetailRow label="Primary surface" value={person.surfaces[0] ? labelize(person.surfaces[0]) : "Not observed"} />
        </dl>
      </section>

      <section>
        <SectionHeading title="Recent risk activity" description="Metadata only. Prompt text is never displayed." />
        <div className="mt-3 space-y-2">
          {recentRisk.length ? recentRisk.map((event) => <CompactEvent key={event.id} event={event} />) : <EmptyState text="No risk events in this range." />}
        </div>
      </section>
    </div>
  );
}

function ActivityTab({
  events,
  totalEvents,
  filter,
  onFilter,
  surface,
  onSurface,
  policy,
  onPolicy,
  allEvents,
  hasMore,
  loadingMore,
  onLoadMore
}: {
  events: OrganizationAuditEvent[];
  totalEvents: number;
  filter: string;
  onFilter: (value: string) => void;
  surface: string;
  onSurface: (value: string) => void;
  policy: string;
  onPolicy: (value: string) => void;
  allEvents: OrganizationAuditEvent[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const surfaces = Array.from(new Set(allEvents.map((event) => event.surface))).sort();
  const policies = Array.from(new Map(allEvents.flatMap((event) => event.policyRuleKey ? [[event.policyRuleKey, event.policyName || labelize(event.policyRuleKey)] as const] : [])).entries());
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading title="Activity history" description={`${totalEvents} metadata-only event${totalEvents === 1 ? "" : "s"} loaded.`} />
        <div className="flex flex-wrap gap-2">
          <DrawerFilter label="Outcome" value={filter} onChange={onFilter} options={[["all", "All outcomes"], ["blocked", "Blocked"], ["redacted", "Redacted"], ["held", "Held"], ["warning", "Warnings"], ["allowed", "Allowed"], ["error", "Errors"]] as Array<[string, string]>} />
          {surfaces.length > 1 ? <DrawerFilter label="Surface" value={surface} onChange={onSurface} options={[["all", "All surfaces"], ...surfaces.map((value): [string, string] => [value, labelize(value)])]} /> : null}
          {policies.length ? <DrawerFilter label="Policy" value={policy} onChange={onPolicy} options={[["all", "All policies"] as [string, string], ...policies]} /> : null}
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {events.length ? events.map((event) => <EventCard key={event.id} event={event} />) : <EmptyState text="No events match this filter." />}
      </div>
      {hasMore ? (
        <button type="button" onClick={onLoadMore} disabled={loadingMore} className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-accord-border py-2.5 text-xs font-semibold text-accord-text hover:bg-accord-surface disabled:opacity-60">
          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />{loadingMore ? "Loading…" : "Load older activity"}
        </button>
      ) : null}
    </section>
  );
}

function PoliciesTab({ detail, onViewEvents }: { detail: OrganizationPersonDetail | null; onViewEvents: (policyKey: string) => void }) {
  return (
    <section>
      <SectionHeading title="Policy activity" description="Rules linked to this employee’s loaded governance events." />
      <div className="mt-4 space-y-2">
        {detail?.policies.length ? detail.policies.map((policy) => (
          <article key={policy.key} className="rounded-md border border-accord-border p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-accord-text">{policy.name}</p>
                <p className="mt-1 truncate font-mono text-[10px] text-accord-faint">{policy.key}</p>
              </div>
              <span className="shrink-0 rounded-md bg-accord-surface px-2 py-1 font-mono text-xs font-semibold text-accord-text">{policy.eventCount}</span>
            </div>
            <dl className="mt-3 grid grid-cols-4 gap-2 text-xs">
              <DetailRow label="Source" value={policy.source || "Built-in policy"} compact />
              <DetailRow label="Events" value={String(policy.eventCount)} compact />
              <DetailRow label="Blocks" value={String(policy.blockCount)} compact />
              <DetailRow label="Redactions" value={String(policy.redactionCount)} compact />
            </dl>
            <p className="mt-2 text-[10px] text-accord-faint">{[policy.action, policy.severity].filter((value): value is string => Boolean(value)).map(labelize).join(" · ") || "Recorded"}{policy.lastTriggeredAt ? ` · Last ${formatTimestamp(policy.lastTriggeredAt)}` : ""}</p>
            <button type="button" onClick={() => onViewEvents(policy.key)} className="mt-3 text-xs font-semibold text-accord-primary hover:underline">View related activity</button>
          </article>
        )) : <EmptyState text="No policy rule identifiers were attached to this employee’s events." />}
      </div>
    </section>
  );
}

function EventCard({ event }: { event: OrganizationAuditEvent }) {
  return (
    <details className="group rounded-md border border-accord-border bg-accord-panel">
      <summary className="flex cursor-pointer list-none items-start gap-3 p-3 marker:content-none">
        <EventIcon category={event.category} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-accord-text">{eventTitle(event)}</p>
            <OutcomeBadge category={event.category} />
          </div>
          <p className="mt-1 text-xs text-accord-muted">{formatTimestamp(event.createdAt)} · {labelize(event.surface)} · Risk {event.riskScore}</p>
        </div>
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-accord-muted transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-accord-border px-3 pb-3 pt-2.5">
        <dl className="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
          <DetailRow compact label="Event ID" value={event.id} />
          <DetailRow compact label="Event type" value={labelize(event.eventType)} />
          <DetailRow compact label="Action" value={labelize(event.action)} />
          <DetailRow compact label="Policy" value={event.policyName || (event.policyRuleKey ? labelize(event.policyRuleKey) : "No rule attached")} />
          <DetailRow compact label="Policy source" value={event.policySource || "Not provided"} />
          <DetailRow compact label="Control" value={[event.policyControlType, event.policyEnforceability].filter((value): value is string => Boolean(value)).map(labelize).join(" · ") || "Not recorded"} />
          <DetailRow compact label="Confidence" value={event.policyConfidence === undefined ? "Not recorded" : `${Math.round(event.policyConfidence * 100)}%`} />
          <DetailRow compact label="Destination" value={[event.provider, event.destinationType].filter(Boolean).map((value) => labelize(value!)).join(" · ") || "Not recorded"} />
          <DetailRow compact label="Content profile" value={[event.messageLengthBucket, event.attachmentCount ? `${event.attachmentCount} attachment${event.attachmentCount === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ") || "Not recorded"} />
        </dl>
        {event.detectedEntities.length || event.detectedCategories.length || event.flags.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {event.detectedEntities.map((entity) => <span key={entity.type} className="rounded bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">{labelize(entity.type)} × {entity.count}</span>)}
            {[...event.detectedCategories, ...event.flags].slice(0, 10).map((label, index) => <span key={`${label}-${index}`} className="rounded bg-accord-surface px-2 py-1 text-[10px] font-medium text-accord-muted">{labelize(label)}</span>)}
          </div>
        ) : null}
        {event.policyCondition || event.policyReasoning ? <div className="mt-3 rounded-md bg-accord-surface px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-accord-faint">Policy explanation</p>{event.policyCondition ? <p className="mt-1 text-xs leading-5 text-accord-text">{event.policyCondition}</p> : null}{event.policyReasoning ? <p className="mt-1 text-[11px] leading-5 text-accord-muted">{event.policyReasoning}</p> : null}</div> : null}
        {event.performedLocally ? <p className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"><ShieldCheck className="h-3 w-3" aria-hidden="true" />Action performed locally before submission.</p> : null}
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-accord-faint"><FileLock2 className="h-3 w-3" aria-hidden="true" />Prompt and response content are not stored in this view.</p>
      </div>
    </details>
  );
}

function CompactEvent({ event }: { event: OrganizationAuditEvent }) {
  return <div className="flex items-center gap-3 rounded-md border border-accord-border px-3 py-2.5"><EventIcon category={event.category} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-accord-text">{eventTitle(event)}</p><p className="mt-0.5 text-[11px] text-accord-muted">{formatTimestamp(event.createdAt)} · Risk {event.riskScore}</p></div><OutcomeBadge category={event.category} /></div>;
}

function EventIcon({ category }: { category: OrganizationAuditEvent["category"] }) {
  const Icon = category === "blocked" ? Ban : category === "allowed" ? CheckCircle2 : category === "error" ? AlertTriangle : category === "redacted" ? ShieldCheck : ShieldAlert;
  return <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", category === "blocked" || category === "error" ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" : category === "allowed" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300")}><Icon className="h-4 w-4" aria-hidden="true" /></span>;
}

function OutcomeBadge({ category }: { category: OrganizationAuditEvent["category"] }) {
  return <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize", category === "blocked" || category === "error" ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" : category === "allowed" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300")}>{category}</span>;
}

function DrawerMetric({ label, value }: { label: string; value: string }) {
  return <div className="bg-accord-panel p-3"><dt className="text-[10px] font-semibold uppercase tracking-[0.05em] text-accord-faint">{label}</dt><dd className="mt-1.5 font-mono text-lg font-semibold text-accord-text">{value}</dd></div>;
}

function MiniRiskTrend({ events }: { events: OrganizationAuditEvent[] }) {
  const points = [...events].filter((event) => event.eventType !== "assistant_response_rehydrated").slice(0, 16).reverse();
  if (points.length < 2) return null;
  const coordinates = points.map((event, index) => `${(index / (points.length - 1)) * 100},${30 - (event.riskScore / 100) * 28}`).join(" ");
  return <div className="mt-3 rounded-md border border-accord-border px-3 py-2"><div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.05em] text-accord-faint"><span>Individual risk trend</span><span>Oldest → newest</span></div><svg className="mt-2 h-8 w-full" viewBox="0 0 100 32" preserveAspectRatio="none" role="img" aria-label="Recent event risk scores"><line x1="0" x2="100" y1="30" y2="30" stroke="#dbe2ea" strokeWidth="0.6" /><polyline points={coordinates} fill="none" stroke="#6d5dfc" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg></div>;
}

function DrawerFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: ReadonlyArray<readonly [string, string]> }) {
  return <label className="grid gap-1 text-[10px] font-semibold text-accord-muted"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-8 max-w-40 rounded-md border border-accord-border bg-accord-panel px-2 text-[11px] text-accord-text outline-none focus:border-accord-primary">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function DetailRow({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return <div className={cn(!compact && "flex items-center justify-between gap-4 px-3 py-2.5")}><dt className="text-accord-muted">{label}</dt><dd className={cn("font-medium text-accord-text", !compact && "text-right", compact && "mt-0.5")}>{value}</dd></div>;
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <div><h3 className="text-sm font-semibold text-accord-text">{title}</h3><p className="mt-0.5 text-xs leading-5 text-accord-muted">{description}</p></div>;
}

function CoverageBadge({ status }: { status: OrganizationPersonSummary["coverageStatus"] }) {
  const reporting = status === "reporting";
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold", reporting ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300")}><span className={cn("h-1.5 w-1.5 rounded-full", reporting ? "bg-emerald-500" : "bg-slate-400")} />{coverageLabel(status)}</span>;
}

function Avatar({ person, size = "default" }: { person: OrganizationPersonSummary; size?: "default" | "large" }) {
  const classes = size === "large" ? "h-12 w-12 text-sm" : "h-9 w-9 text-xs";
  if (person.avatarUrl) {
    // Auth profile images may come from several trusted identity providers.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={person.avatarUrl} alt={`${person.displayName} profile`} referrerPolicy="no-referrer" className={cn(classes, "shrink-0 rounded-full border border-accord-border object-cover")} />;
  }
  return <div aria-hidden="true" className={cn(classes, "flex shrink-0 items-center justify-center rounded-full bg-accord-night font-semibold text-white")}>{initials(person.displayName)}</div>;
}

function DrawerSkeleton() {
  return <div className="space-y-3" aria-label="Loading employee activity"><div className="h-20 animate-pulse rounded-md bg-accord-surface" /><div className="h-40 animate-pulse rounded-md bg-accord-surface" /><div className="h-24 animate-pulse rounded-md bg-accord-surface" /></div>;
}

function ErrorState({ message }: { message: string }) {
  return <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p className="font-semibold">Activity unavailable</p><p className="mt-1 text-xs">{message}</p></div>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-accord-border px-3 py-5 text-center text-xs text-accord-muted">{text}</p>;
}

function mergePolicies(current: OrganizationPersonDetail["policies"], next: OrganizationPersonDetail["policies"]) {
  const merged = new Map(current.map((policy) => [policy.key, { ...policy }]));
  for (const policy of next) {
    const existing = merged.get(policy.key);
    merged.set(policy.key, existing ? {
      ...existing,
      eventCount: existing.eventCount + policy.eventCount,
      blockCount: existing.blockCount + policy.blockCount,
      redactionCount: existing.redactionCount + policy.redactionCount,
      warningCount: existing.warningCount + policy.warningCount
    } : policy);
  }
  return Array.from(merged.values()).sort((a, b) => b.eventCount - a.eventCount);
}

function eventTitle(event: OrganizationAuditEvent) {
  if (event.policyName) return event.policyName;
  if (event.category === "blocked") return "AI submission blocked";
  if (event.category === "redacted") return `${event.redactionCount || "Sensitive"} item${event.redactionCount === 1 ? "" : "s"} redacted`;
  if (event.category === "held") return "Submission held for review";
  if (event.category === "allowed") return "Governed submission allowed";
  if (event.category === "error") return "Extension runtime error";
  return "Policy event recorded";
}

function coverageLabel(status: OrganizationPersonSummary["coverageStatus"]) {
  return status === "reporting" ? "Reporting" : status === "no_recent_activity" ? "No recent activity" : status === "not_reporting" ? "Not reporting" : status === "invite_pending" ? "Invite pending" : "Suspended";
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function labelize(value: string) {
  return value.replace(/^accord[._-]/, "").replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "A";
}
