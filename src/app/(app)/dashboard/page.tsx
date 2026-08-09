import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { ChartCard } from "@/components/ui/chart-card";
import { EventTable } from "@/components/ui/event-table";
import { ProviderUsageChart } from "@/components/charts/provider-usage-chart";
import { RiskCategoryBars } from "@/components/charts/risk-category-bars";
import { RiskDistributionChart } from "@/components/charts/risk-distribution-chart";
import { UsageLineChart } from "@/components/charts/usage-line-chart";
import { getAccordOrganizationContext } from "@/lib/auth/organization";
import { getAccordDatabaseSnapshot } from "@/lib/db/accord-store";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const organization = await getAccordOrganizationContext({ autoCreate: true });
  const databaseSnapshot = await getAccordDatabaseSnapshot(organization.companySlug);
  const stats = databaseSnapshot.stats;
  const metrics = databaseSnapshot.extensionMetrics;
  const recentEvents = databaseSnapshot.recentEvents.slice(0, 6);

  const getStat = (label: string) => stats.find((stat) => stat.label === label);
  const totalRequests = getStat("Total AI requests")?.value || metrics.messagesSent.toLocaleString("en-US");
  const activeUsers = getStat("Active users")?.value || metrics.activeUsers.toLocaleString("en-US");
  const highRiskEvents = getStat("High-risk events")?.value || metrics.policyViolations.toLocaleString("en-US");
  const blockedRequests = getStat("Blocked requests")?.value || metrics.messagesBlocked.toLocaleString("en-US");
  const submittedOrBlocked = metrics.messagesSent + metrics.messagesBlocked;
  const blockRate = submittedOrBlocked ? `${Math.round((metrics.messagesBlocked / submittedOrBlocked) * 100)}%` : "0%";
  const riskTotal = databaseSnapshot.charts.riskDistribution.reduce((sum, item) => sum + item.count, 0);
  const highCriticalCount = databaseSnapshot.charts.riskDistribution
    .filter((item) => item.name === "High" || item.name === "Critical")
    .reduce((sum, item) => sum + item.count, 0);
  const highCriticalRate = riskTotal ? `${Math.round((highCriticalCount / riskTotal) * 100)}%` : "0%";

  const kpis = [
    { label: "AI requests", value: totalRequests },
    { label: "Active users", value: activeUsers },
    { label: "Policy events", value: highRiskEvents },
    { label: "Blocked", value: blockedRequests, detail: `${blockRate} of submitted` }
  ] as const;

  const extensionMetricCards = [
    ["Messages sent", metrics.messagesSent, "Submitted after Accord checks"],
    ["Messages blocked", metrics.messagesBlocked, "Stopped before external AI"],
    ["Governed uploads", metrics.governedUploads, "Files replaced or blocked"],
    ["Protected identifiers", metrics.protectedIdentifiers, "PII values counted, not stored"]
  ] as const;

  return (
    <div className="app-geist space-y-6">
      <OverviewHeader
        companyName={organization.companyName}
        authenticated={organization.authenticated}
        databaseEnabled={databaseSnapshot.databaseEnabled}
        extensionTelemetryEnabled={databaseSnapshot.extensionTelemetryEnabled}
      />

      <section className="grid divide-y divide-accord-border rounded-lg border border-accord-border bg-accord-panel md:grid-cols-2 md:divide-y-0 xl:grid-cols-4 xl:divide-x">
        {kpis.map((kpi) => (
          <OverviewMetricCell key={kpi.label} {...kpi} />
        ))}
      </section>

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.6fr)]">
        <ChartCard title="Guarded traffic">
          <UsageLineChart data={databaseSnapshot.charts.usageOverTime} />
        </ChartCard>

        <section className="rounded-lg border border-accord-border bg-accord-panel">
          <div className="border-b border-accord-border px-4 py-3">
            <h2 className="text-sm font-semibold text-accord-text">System status</h2>
          </div>

          <div className="divide-y divide-accord-border/60 px-4">
            <StatusRow label="Supabase" value={databaseSnapshot.databaseEnabled ? "Connected" : "Setup pending"} active={databaseSnapshot.databaseEnabled} />
            <StatusRow
              label="Extension telemetry"
              value={databaseSnapshot.extensionTelemetryEnabled ? "Receiving events" : "Migration pending"}
              active={databaseSnapshot.extensionTelemetryEnabled}
            />
            <StatusRow label="Raw content storage" value="Disabled" active />
          </div>

          <div className="grid grid-cols-2 divide-x divide-accord-border border-t border-accord-border">
            <MiniStat label="High or critical" value={highCriticalRate} />
            <MiniStat label="Recent events" value={recentEvents.length.toLocaleString("en-US")} />
          </div>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <ChartCard title="Risk breakdown">
          <RiskDistributionChart data={databaseSnapshot.charts.riskDistribution} />
        </ChartCard>
        <ChartCard title="Top categories">
          <RiskCategoryBars data={databaseSnapshot.charts.riskCategories} />
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

        <DashboardDetails title="Provider breakdown">
          <ProviderUsageChart data={databaseSnapshot.charts.providerUsage} compact />
        </DashboardDetails>

        <DashboardDetails title="Data source status">
          <div className="divide-y divide-accord-border/60">
            <StatusRow label="Database" value={databaseSnapshot.databaseEnabled ? "Supabase live" : "Setup pending"} active={databaseSnapshot.databaseEnabled} />
            <StatusRow label="Telemetry" value={databaseSnapshot.extensionTelemetryEnabled ? "Extension live" : "Migration pending"} active={databaseSnapshot.extensionTelemetryEnabled} />
            <StatusRow label="Account" value={organization.authenticated ? "Signed in" : "Demo mode"} active={organization.authenticated} />
            <StatusRow label="Workspace records" value={databaseSnapshot.memory.length.toLocaleString("en-US")} active={databaseSnapshot.memory.length > 0} />
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

function OverviewHeader({
  companyName,
  authenticated,
  databaseEnabled,
  extensionTelemetryEnabled
}: {
  companyName: string;
  authenticated: boolean;
  databaseEnabled: boolean;
  extensionTelemetryEnabled: boolean;
}) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-accord-faint">
          {companyName} / Overview
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.025em] text-accord-text">Governance activity</h1>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <HeaderStatus label={databaseEnabled ? "Supabase live" : "Supabase setup"} active={databaseEnabled} />
        <HeaderStatus label={extensionTelemetryEnabled ? "Extension live" : "Telemetry pending"} active={extensionTelemetryEnabled} />
        <HeaderStatus label={authenticated ? "Signed in" : "Demo mode"} active={authenticated} />
      </div>
    </header>
  );
}

function HeaderStatus({ label, active }: { label: string; active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accord-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-amber-500"}`} />
      {label}
    </span>
  );
}

function OverviewMetricCell({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className="px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-accord-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold leading-none tracking-[-0.025em] text-accord-text [font-variant-numeric:tabular-nums]">
        {value}
        {detail ? <span className="ml-2 align-middle text-xs font-normal tracking-normal text-accord-muted">{detail}</span> : null}
      </p>
    </article>
  );
}

function StatusRow({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <p className="text-[13px] text-accord-muted">{label}</p>
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-accord-text">
        <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-amber-500"}`} />
        {value}
      </p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4">
      <p className="text-xl font-semibold text-accord-text [font-variant-numeric:tabular-nums]">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.06em] text-accord-muted">{label}</p>
    </div>
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
