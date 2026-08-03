import { BrainCircuit, CircleDot, Database, LockKeyhole, MessagesSquare, ShieldCheck, UploadCloud } from "lucide-react";
import { ChartCard } from "@/components/ui/chart-card";
import { EventTable } from "@/components/ui/event-table";
import { StatCard } from "@/components/ui/stat-card";
import { ProviderUsageChart } from "@/components/charts/provider-usage-chart";
import { RiskCategoryBars } from "@/components/charts/risk-category-bars";
import { RiskDistributionChart } from "@/components/charts/risk-distribution-chart";
import { UsageLineChart } from "@/components/charts/usage-line-chart";
import { getAccordDatabaseSnapshot } from "@/lib/db/accord-store";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const databaseSnapshot = await getAccordDatabaseSnapshot();
  const stats = databaseSnapshot.stats;
  const recentEvents = databaseSnapshot.recentEvents.slice(0, 4);
  const riskTotal = databaseSnapshot.charts.riskDistribution.reduce((sum, item) => sum + item.count, 0);
  const lowMediumCount = databaseSnapshot.charts.riskDistribution
    .filter((item) => item.name === "Low" || item.name === "Medium")
    .reduce((sum, item) => sum + item.count, 0);
  const lowMediumPercent = riskTotal ? Math.round((lowMediumCount / riskTotal) * 100) : 0;
  const postureCards = [
    [`${lowMediumPercent}%`, "Low or medium risk", "Live governed events"],
    ["0", "Raw content stores", "Tenant default remains disabled"],
    [databaseSnapshot.extensionTelemetryEnabled ? "Live" : "Setup", "Telemetry source", "Chrome extension and dashboard"]
  ];
  const memoryItems = databaseSnapshot.memory.length
    ? databaseSnapshot.memory
    : [
        {
          id: "supabase_setup",
          title: "Supabase setup pending",
          kind: "setup",
          summary: "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then run the Accord Supabase migration to activate persisted workspace memory.",
          createdAt: "",
          updatedAt: ""
        }
      ];
  const extensionMetricCards = [
    ["Messages sent to AI", databaseSnapshot.extensionMetrics.messagesSent, "Submitted through ChatGPT after Accord checks", MessagesSquare],
    ["Messages blocked", databaseSnapshot.extensionMetrics.messagesBlocked, "Stopped before external AI submission", ShieldCheck],
    ["Policy violations", databaseSnapshot.extensionMetrics.policyViolations, "Warn, redact, or block outcomes", LockKeyhole],
    ["Governed uploads", databaseSnapshot.extensionMetrics.governedUploads, "Files replaced or blocked by the extension", UploadCloud]
  ] as const;

  return (
    <div className="space-y-7">
      <OverviewHeader
        databaseEnabled={databaseSnapshot.databaseEnabled}
        extensionTelemetryEnabled={databaseSnapshot.extensionTelemetryEnabled}
        activeUsers={databaseSnapshot.extensionMetrics.activeUsers}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="grid gap-8 rounded-[1.5rem] border border-accord-border bg-accord-night p-7 text-white shadow-accord-panel xl:grid-cols-[minmax(0,1fr)_minmax(560px,1.35fr)] xl:items-start">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-accord-violet">Policy posture</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Governance health is stable.</h2>
          <p className="mt-3 max-w-4xl text-[15px] leading-7 text-slate-300">
            Accord is collecting policy metadata from governed browser activity while keeping raw prompts, raw
            responses, and source files out of dashboard storage by default.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {postureCards.map(([value, label, detail]) => (
            <article key={label} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
              <div className="flex items-center justify-between">
                <p className="text-2xl font-semibold">{value}</p>
                {label === "Raw content stores" ? (
                  <LockKeyhole className="h-4 w-4 text-accord-violet" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-accord-violet" aria-hidden="true" />
                )}
              </div>
              <p className="mt-2 text-sm font-semibold text-white">{label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <article className="rounded-2xl border border-accord-border bg-white p-5 shadow-accord-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-accord-violet">
                Workspace memory
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-accord-text">Supabase-backed context</h2>
            </div>
            <div className="rounded-full border border-accord-border bg-accord-soft p-2 text-accord-violet">
              <Database className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Accord now has a server-side place to remember product context, governed chat metadata, and audit events
            across fresh sessions without storing raw prompts or responses.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                databaseSnapshot.databaseEnabled
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              <CircleDot className="h-3.5 w-3.5" aria-hidden="true" />
              {databaseSnapshot.databaseEnabled ? "Supabase connected" : "Supabase setup pending"}
            </span>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                databaseSnapshot.extensionTelemetryEnabled
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              <CircleDot className="h-3.5 w-3.5" aria-hidden="true" />
              {databaseSnapshot.extensionTelemetryEnabled ? "Extension telemetry active" : "Extension migration pending"}
            </span>
            <span className="rounded-full border border-accord-border bg-accord-soft px-3 py-1 text-xs font-semibold text-slate-600">
              Raw content disabled
            </span>
          </div>
        </article>

        <div className="grid gap-3 md:grid-cols-3">
          {memoryItems.map((item) => (
            <article key={item.id} className="rounded-2xl border border-accord-border bg-white p-4 shadow-accord-panel">
              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-accord-violet/10 p-2 text-accord-violet">
                  <BrainCircuit className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="rounded-full bg-accord-soft px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {item.kind.replace("_", " ")}
                </span>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-accord-text">{item.title}</h3>
              <p className="mt-2 line-clamp-5 text-xs leading-5 text-slate-500">{item.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-accord-border bg-white p-5 shadow-accord-panel">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-accord-violet">
              Chrome extension telemetry
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-accord-text">Test company activity</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Accord Guard reports governed ChatGPT activity through the server API into Supabase. Metrics are metadata
              only: no raw prompts, raw responses, or source files.
            </p>
          </div>
          <div className="rounded-full border border-accord-border bg-accord-soft px-3 py-1 text-xs font-semibold text-slate-600">
            {databaseSnapshot.extensionMetrics.activeUsers} active extension user
            {databaseSnapshot.extensionMetrics.activeUsers === 1 ? "" : "s"}
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {extensionMetricCards.map(([label, value, detail, Icon]) => (
            <article key={label} className="rounded-2xl border border-accord-border bg-accord-soft/60 p-4">
              <div className="flex items-center justify-between">
                <p className="text-2xl font-semibold tracking-[-0.02em] text-accord-text">{value.toLocaleString("en-US")}</p>
                <span className="rounded-xl bg-white p-2 text-accord-violet shadow-sm">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold text-accord-text">{label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
            </article>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-accord-border bg-white p-4 text-sm text-slate-600">
          <span className="font-semibold text-accord-text">
            {databaseSnapshot.extensionMetrics.protectedIdentifiers.toLocaleString("en-US")} protected identifiers
          </span>{" "}
          have been counted across extension-governed messages and uploads.
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="AI usage over time" description="Requests routed through Accord by day.">
          <UsageLineChart data={databaseSnapshot.charts.usageOverTime} />
        </ChartCard>
        <ChartCard title="Risk level distribution" description="Policy outcomes across all reviewed model calls.">
          <RiskDistributionChart data={databaseSnapshot.charts.riskDistribution} />
        </ChartCard>
        <ChartCard title="Provider usage" description="Approved provider traffic for this tenant.">
          <ProviderUsageChart data={databaseSnapshot.charts.providerUsage} />
        </ChartCard>
        <ChartCard title="Top risk categories" description="Flagged events grouped by policy category.">
          <RiskCategoryBars data={databaseSnapshot.charts.riskCategories} />
        </ChartCard>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-accord-text">Recent flagged activity</h2>
            <p className="mt-1 text-sm text-slate-500">
              Redacted previews and policy outcomes only, designed for governance without surveillance.
            </p>
          </div>
        </div>
        <EventTable events={recentEvents} compact />
      </section>
    </div>
  );
}

function OverviewHeader({
  databaseEnabled,
  extensionTelemetryEnabled,
  activeUsers
}: {
  databaseEnabled: boolean;
  extensionTelemetryEnabled: boolean;
  activeUsers: number;
}) {
  return (
    <header className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(520px,0.9fr)] 2xl:items-end">
      <div>
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accord-primary">
          Northstar Financial / Governance overview
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-accord-text">Overview</h1>
        <p className="mt-3 max-w-4xl text-base leading-7 text-accord-muted">
          Monitor Accord Guard activity, policy outcomes, extension telemetry, and audit-ready metadata without storing
          raw employee conversations.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <OverviewHeaderStatus label="Database" value={databaseEnabled ? "Supabase live" : "Setup pending"} tone={databaseEnabled ? "success" : "warning"} />
        <OverviewHeaderStatus
          label="Telemetry"
          value={extensionTelemetryEnabled ? "Extension active" : "Migration pending"}
          tone={extensionTelemetryEnabled ? "success" : "warning"}
        />
        <OverviewHeaderStatus label="Users" value={`${activeUsers} active`} tone={activeUsers ? "success" : "default"} />
      </div>
    </header>
  );
}

function OverviewHeaderStatus({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const dotClass = tone === "success" ? "bg-emerald-400" : tone === "warning" ? "bg-amber-400" : "bg-accord-primary";

  return (
    <div className="rounded-2xl border border-accord-border bg-white/80 px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        <p className="text-sm font-semibold text-accord-text">{value}</p>
      </div>
    </div>
  );
}
