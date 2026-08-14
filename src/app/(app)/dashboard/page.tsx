import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, Info } from "lucide-react";
import { ChartCard } from "@/components/ui/chart-card";
import { EventTable } from "@/components/ui/event-table";
import { ProviderUsageChart } from "@/components/charts/provider-usage-chart";
import { RiskCategoryBars } from "@/components/charts/risk-category-bars";
import { RiskDistributionChart } from "@/components/charts/risk-distribution-chart";
import { UsageLineChart } from "@/components/charts/usage-line-chart";
import { getAccordOrganizationContext } from "@/lib/auth/organization";
import { getAccordDatabaseSnapshot, normalizeDashboardTimeRange, type DashboardTimeRange } from "@/lib/db/accord-store";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const timeRangeOptions: Array<{ value: DashboardTimeRange; label: string; description: string }> = [
  { value: "7d", label: "Last 7 days", description: "Since the start of the seventh day back" },
  { value: "30d", label: "Last month", description: "Last 30 calendar days" },
  { value: "all", label: "All time", description: "Every event in this workspace" }
];

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: { range?: string | string[] };
}) {
  const timeRange = normalizeDashboardTimeRange(searchParams?.range);
  const timeRangeLabel = timeRangeOptions.find((option) => option.value === timeRange)?.label || "Last 7 days";
  const organization = await getAccordOrganizationContext({ autoCreate: true });
  const databaseSnapshot = await getAccordDatabaseSnapshot(organization.companySlug, timeRange);
  const stats = databaseSnapshot.stats;
  const metrics = databaseSnapshot.extensionMetrics;
  const recentEvents = databaseSnapshot.recentEvents.slice(0, 6);

  const getStat = (label: string) => stats.find((stat) => stat.label === label);
  const totalRequests = getStat("Total AI requests")?.value || metrics.messagesSent.toLocaleString("en-US");
  const activeUsers = getStat("Active users")?.value || metrics.activeUsers.toLocaleString("en-US");
  const redactedRequests = metrics.messagesRedacted.toLocaleString("en-US");
  const blockedRequests = getStat("Blocked requests")?.value || metrics.messagesBlocked.toLocaleString("en-US");
  const submittedOrBlocked = metrics.messagesSent + metrics.messagesBlocked;
  const blockRate = submittedOrBlocked ? `${Math.round((metrics.messagesBlocked / submittedOrBlocked) * 100)}%` : "0%";
  const redactionRate = metrics.messagesSent ? `${Math.round((metrics.messagesRedacted / metrics.messagesSent) * 100)}%` : "0%";
  const kpis = [
    { label: "AI requests", value: totalRequests },
    { label: "Policy events", value: metrics.policyViolations.toLocaleString("en-US") },
    {
      label: "Redacted requests",
      value: redactedRequests,
      detail: metrics.messagesRedacted > 0 ? `(${redactionRate} of sent)` : undefined
    },
    {
      label: "Blocked attempts",
      value: blockedRequests,
      detail: metrics.messagesBlocked > 0 ? `(${blockRate} of attempts)` : undefined
    },
    { label: "Active users", value: activeUsers }
  ] as const;

  const extensionMetricCards = [
    ["Policy decisions", metrics.policyViolations, "Warn, redact, or block outcomes"],
    ["Messages sent", metrics.messagesSent, "Submitted after Accord checks"],
    ["Messages blocked", metrics.messagesBlocked, "Stopped before external AI"],
    ["Governed uploads", metrics.governedUploads, "Files replaced or blocked"],
    ["Protected identifiers", metrics.protectedIdentifiers, "PII values counted, not stored"]
  ] as const;

  return (
    <div className="app-geist space-y-6">
      <OverviewHeader companyName={organization.companyName} />

      <section className="grid divide-y divide-accord-border rounded-lg border border-accord-border bg-accord-panel md:grid-cols-2 md:divide-y-0 xl:grid-cols-5 xl:divide-x">
        {kpis.map((kpi) => (
          <OverviewMetricCell key={kpi.label} {...kpi} />
        ))}
      </section>

      <div className="space-y-2">
        <div className="flex">
          <TimeRangeFilter selectedRange={timeRange} />
        </div>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.65fr)]">
          <ChartCard title="Guarded traffic" description={timeRangeLabel}>
            <UsageLineChart data={databaseSnapshot.charts.usageOverTime} />
          </ChartCard>
          <ChartCard title="Risk breakdown" description={timeRangeLabel}>
            <RiskDistributionChart data={databaseSnapshot.charts.riskDistribution} />
          </ChartCard>
        </section>
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <ChartCard title="Top categories" description={timeRangeLabel}>
          <RiskCategoryBars data={databaseSnapshot.charts.riskCategories} />
        </ChartCard>
        <ChartCard title="AI provider usage" description={timeRangeLabel}>
          <ProviderUsageChart data={databaseSnapshot.charts.providerUsage} />
        </ChartCard>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-accord-text">Recent governed activity</h2>
        <EventTable events={recentEvents} compact />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DashboardDetails title="Extension metadata">
          <div className="grid divide-y divide-accord-border/60 sm:grid-cols-2 sm:divide-y-0 sm:gap-x-6">
            {extensionMetricCards.map(([label, value, detail]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 border-b border-accord-border/60 py-2.5 sm:border-b">
                <div>
                  <p className="text-[13px] font-medium text-accord-text">{label}</p>
                  <p className="mt-0.5 text-xs text-accord-muted">{detail}</p>
                </div>
                <p className="text-lg font-semibold text-accord-text [font-variant-numeric:tabular-nums]">
                  {value.toLocaleString("en-US")}
                </p>
              </div>
            ))}
          </div>
        </DashboardDetails>

        <DashboardDetails title="Governance defaults">
          <div className="divide-y divide-accord-border/60">
            <PrivacyRow title="Raw prompts" value="Not stored by default" />
            <PrivacyRow title="Raw responses" value="Not stored by default" />
            <PrivacyRow title="Evidence" value="Redacted previews and metadata" />
            <PrivacyRow title="Uploads" value="Governed by extension event metadata" />
          </div>
        </DashboardDetails>
      </section>
    </div>
  );
}

function OverviewHeader({ companyName }: { companyName: string }) {
  return (
    <header>
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.09em] text-accord-faint">
          {companyName} / Overview
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-accord-text md:text-[32px]">Governance activity</h1>
      </div>

    </header>
  );
}

function TimeRangeFilter({ selectedRange }: { selectedRange: DashboardTimeRange }) {
  return (
    <div className="inline-flex rounded-lg border border-accord-border bg-accord-panel p-0.5">
      {timeRangeOptions.map((option) => {
        const active = option.value === selectedRange;
        return (
          <Link
            key={option.value}
            href={option.value === "7d" ? "/dashboard" : `/dashboard?range=${option.value}`}
            aria-current={active ? "true" : undefined}
            title={option.description}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
              active ? "bg-accord-night text-white" : "text-accord-muted hover:bg-accord-surface hover:text-accord-text"
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

function OverviewMetricCell({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className="px-4 py-4">
      <div className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.06em] text-accord-muted">
        <span>{label}</span>
        {label === "Policy events" ? (
          <span className="group relative inline-flex">
            <button
              type="button"
              aria-label="About policy events"
              aria-describedby="policy-events-tooltip"
              className="rounded-sm text-accord-faint outline-none transition-colors hover:text-accord-muted focus-visible:ring-2 focus-visible:ring-accord-primary/40"
            >
              <Info className="h-3 w-3" aria-hidden="true" />
            </button>
            <span
              id="policy-events-tooltip"
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-md bg-accord-night px-3 py-2 font-sans text-xs normal-case leading-relaxed tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              Policy rule triggers, including blocked attempts. One request may trigger multiple policies.
            </span>
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-3xl font-semibold leading-none tracking-[-0.025em] text-accord-text [font-variant-numeric:tabular-nums]">
        {value}
        {detail ? (
          <>
            {" "}
            <span className="ml-2 align-middle text-xs font-normal tracking-normal text-accord-muted">{detail}</span>
          </>
        ) : null}
      </p>
    </article>
  );
}

function DashboardDetails({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group rounded-lg border border-accord-border bg-accord-panel" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 outline-none transition-colors hover:bg-accord-surface/60 [&::-webkit-details-marker]:hidden">
        <h2 className="text-sm font-semibold text-accord-text">{title}</h2>
        <ChevronDown className="h-4 w-4 text-accord-faint transition duration-200 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-accord-border px-4 py-3">{children}</div>
    </details>
  );
}

function PrivacyRow({ title, value }: { title: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <p className="text-[13px] text-accord-muted">{title}</p>
      <p className="text-right text-[13px] font-medium text-accord-text">{value}</p>
    </div>
  );
}
