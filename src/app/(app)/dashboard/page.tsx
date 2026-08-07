import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Database,
  FileText,
  LockKeyhole,
  MessagesSquare,
  ShieldCheck,
  UploadCloud,
  Users
} from "lucide-react";
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
    {
      label: "AI requests",
      value: totalRequests,
      detail: "Governed messages and dashboard sends",
      icon: MessagesSquare,
      tone: "primary"
    },
    {
      label: "Active users",
      value: activeUsers,
      detail: "Extension users reporting telemetry",
      icon: Users,
      tone: "blue"
    },
    {
      label: "Policy events",
      value: highRiskEvents,
      detail: "Warn, redact, or block decisions",
      icon: ShieldCheck,
      tone: "violet"
    },
    {
      label: "Blocked",
      value: blockedRequests,
      detail: `${blockRate} of submitted or blocked messages`,
      icon: LockKeyhole,
      tone: "night"
    }
  ] as const;

  const extensionMetricCards = [
    ["Messages sent", metrics.messagesSent, "Submitted after Accord checks", MessagesSquare],
    ["Messages blocked", metrics.messagesBlocked, "Stopped before external AI", ShieldCheck],
    ["Governed uploads", metrics.governedUploads, "Files replaced or blocked", UploadCloud],
    ["Protected identifiers", metrics.protectedIdentifiers, "PII values counted, not stored", LockKeyhole]
  ] as const;

  return (
    <div className="app-geist space-y-8">
      <OverviewHeader
        companyName={organization.companyName}
        authenticated={organization.authenticated}
        databaseEnabled={databaseSnapshot.databaseEnabled}
        extensionTelemetryEnabled={databaseSnapshot.extensionTelemetryEnabled}
      />

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {kpis.map((kpi) => (
          <OverviewMetricCard key={kpi.label} {...kpi} />
        ))}
      </section>

      <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <ChartCard title="Guarded traffic" description="Requests and flagged decisions over the last 7 days.">
          <UsageLineChart data={databaseSnapshot.charts.usageOverTime} />
        </ChartCard>

        <article className="overflow-hidden rounded-[1.4rem] border border-accord-border bg-white shadow-accord-panel">
          <div className="border-b border-accord-border bg-gradient-to-br from-white via-white to-[#f3f4ff] p-6">
            <p className="dashboard-eyebrow font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accord-violet">Live enforcement</p>
            <h2 className="mt-3 text-2xl text-accord-text">Guard is tracking decisions.</h2>
            <p className="mt-3 text-sm leading-6 text-accord-muted">
              The overview shows operational metadata only: counts, decisions, risk levels, and redacted event evidence.
            </p>
          </div>

          <div className="grid gap-3 p-5">
            <CompactSignal label="Supabase" value={databaseSnapshot.databaseEnabled ? "Connected" : "Setup pending"} active={databaseSnapshot.databaseEnabled} />
            <CompactSignal
              label="Extension telemetry"
              value={databaseSnapshot.extensionTelemetryEnabled ? "Receiving events" : "Migration pending"}
              active={databaseSnapshot.extensionTelemetryEnabled}
            />
            <CompactSignal label="Raw content storage" value="Disabled" active />
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-accord-border p-5">
            <DarkStat label="High or critical" value={highCriticalRate} />
            <DarkStat label="Recent events" value={recentEvents.length.toLocaleString("en-US")} />
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <ChartCard title="Risk mix" description="Policy outcomes grouped by severity.">
          <RiskDistributionChart data={databaseSnapshot.charts.riskDistribution} />
        </ChartCard>
        <ChartCard title="Top categories" description="Most common flagged policy areas.">
          <RiskCategoryBars data={databaseSnapshot.charts.riskCategories} />
        </ChartCard>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="dashboard-eyebrow font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accord-primary">Audit stream</p>
            <h2 className="mt-2 text-2xl text-accord-text">Recent governed activity</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-accord-muted">
            Review outcomes and statuses without storing raw prompts or responses.
          </p>
        </div>
        <EventTable events={recentEvents} compact />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DashboardDetails title="Extension metadata" eyebrow="Telemetry detail" icon={Activity}>
          <div className="grid gap-3 sm:grid-cols-2">
            {extensionMetricCards.map(([label, value, detail, Icon]) => (
              <article key={label} className="rounded-2xl border border-accord-border bg-accord-soft/60 p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="dashboard-number text-2xl text-accord-text">{value.toLocaleString("en-US")}</p>
                  <span className="rounded-xl bg-white p-2 text-accord-primary shadow-sm">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium text-accord-text">{label}</p>
                <p className="mt-1 text-xs leading-5 text-accord-muted">{detail}</p>
              </article>
            ))}
          </div>
        </DashboardDetails>

        <DashboardDetails title="Provider breakdown" eyebrow="Routing detail" icon={BarChart3}>
          <ProviderUsageChart data={databaseSnapshot.charts.providerUsage} compact />
        </DashboardDetails>

        <DashboardDetails title="Data source status" eyebrow="System detail" icon={Database}>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatusTile label="Database" value={databaseSnapshot.databaseEnabled ? "Supabase live" : "Setup pending"} active={databaseSnapshot.databaseEnabled} />
            <StatusTile label="Telemetry" value={databaseSnapshot.extensionTelemetryEnabled ? "Extension live" : "Migration pending"} active={databaseSnapshot.extensionTelemetryEnabled} />
            <StatusTile label="Account" value={organization.authenticated ? "Signed in" : "Demo mode"} active={organization.authenticated} />
            <StatusTile label="Workspace records" value={databaseSnapshot.memory.length.toLocaleString("en-US")} active={databaseSnapshot.memory.length > 0} />
          </div>
        </DashboardDetails>

        <DashboardDetails title="Governance defaults" eyebrow="Privacy detail" icon={FileText}>
          <div className="grid gap-3">
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
    <header className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
      <div>
        <p className="dashboard-eyebrow font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accord-primary">
          {companyName} / Overview
        </p>
        <h1 className="mt-3 text-4xl text-accord-text">Governance activity</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-accord-muted">
          Live usage, policy decisions, and redacted audit evidence from Accord Guard.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <HeaderPill label={databaseEnabled ? "Supabase live" : "Supabase setup"} active={databaseEnabled} />
        <HeaderPill label={extensionTelemetryEnabled ? "Extension live" : "Telemetry pending"} active={extensionTelemetryEnabled} />
        <HeaderPill label={authenticated ? "Signed in" : "Demo mode"} active={authenticated} />
      </div>
    </header>
  );
}

function HeaderPill({ label, active }: { label: string; active: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-accord-border bg-white px-3.5 py-2 text-sm font-medium text-accord-text shadow-sm">
      <span className={`h-2 w-2 rounded-full ${active ? "bg-emerald-400" : "bg-amber-400"}`} />
      {label}
    </span>
  );
}

function OverviewMetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: "primary" | "blue" | "violet" | "night";
}) {
  const toneClass = {
    primary: "from-accord-primary/12 to-white text-accord-primary",
    blue: "from-accord-blue/12 to-white text-accord-blue",
    violet: "from-accord-violet/16 to-white text-accord-violet",
    night: "from-accord-night/10 to-white text-accord-night"
  }[tone];
  const iconClass = {
    primary: "text-accord-primary",
    blue: "text-accord-blue",
    violet: "text-accord-violet",
    night: "text-accord-night"
  }[tone];

  return (
    <article className="group relative overflow-hidden rounded-[1.35rem] border border-accord-border bg-white p-5 shadow-accord-panel">
      <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${toneClass} opacity-80`} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="dashboard-label font-mono text-[11px] uppercase text-accord-muted">{label}</p>
          <p className="dashboard-number mt-3 text-[2.25rem] leading-none text-accord-text">{value}</p>
        </div>
        <div className={`rounded-2xl border border-white bg-white/90 p-2.5 shadow-sm ${iconClass}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <p className="relative mt-5 text-sm leading-6 text-accord-muted">{detail}</p>
    </article>
  );
}

function CompactSignal({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-accord-border bg-accord-soft/70 px-4 py-3">
      <div>
        <p className="dashboard-label text-xs uppercase text-accord-muted">{label}</p>
        <p className="mt-1 text-sm font-medium text-accord-text">{value}</p>
      </div>
      {active ? <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" /> : <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />}
    </div>
  );
}

function DarkStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-accord-border bg-accord-soft/70 p-4">
      <p className="dashboard-number text-3xl text-accord-text">{value}</p>
      <p className="dashboard-label mt-2 text-xs uppercase text-accord-muted">{label}</p>
    </div>
  );
}

function DashboardDetails({
  title,
  eyebrow,
  icon: Icon,
  children
}: {
  title: string;
  eyebrow: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-[1.35rem] border border-accord-border bg-white shadow-accord-panel">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 outline-none transition hover:bg-accord-mist/60 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-[#f1f2ff] p-2.5 text-accord-primary">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="dashboard-eyebrow font-mono text-[10px] font-semibold uppercase text-accord-primary">{eyebrow}</p>
            <h2 className="mt-1 text-lg text-accord-text">{title}</h2>
          </div>
        </div>
        <ChevronDown className="h-5 w-5 text-accord-muted transition duration-300 group-open:rotate-180" aria-hidden="true" />
      </summary>

      <div className="grid grid-rows-[0fr] overflow-hidden px-5 transition-[grid-template-rows] duration-300 ease-out group-open:grid-rows-[1fr]">
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-accord-border py-5">{children}</div>
        </div>
      </div>
    </details>
  );
}

function StatusTile({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="rounded-2xl border border-accord-border bg-accord-soft/70 p-4">
      <p className="dashboard-label text-xs uppercase text-accord-muted">{label}</p>
      <div className="mt-3 flex items-center gap-2">
        <CircleDot className={`h-4 w-4 ${active ? "text-emerald-500" : "text-amber-500"}`} aria-hidden="true" />
        <p className="text-sm font-medium text-accord-text">{value}</p>
      </div>
    </div>
  );
}

function PrivacyRow({ title, value }: { title: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-accord-border bg-accord-soft/70 px-4 py-3">
      <p className="text-sm font-medium text-accord-text">{title}</p>
      <p className="text-right text-sm text-accord-muted">{value}</p>
    </div>
  );
}
