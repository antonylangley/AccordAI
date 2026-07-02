import { LockKeyhole, ShieldCheck } from "lucide-react";
import { ChartCard } from "@/components/ui/chart-card";
import { EventTable } from "@/components/ui/event-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ProviderUsageChart } from "@/components/charts/provider-usage-chart";
import { RiskCategoryBars } from "@/components/charts/risk-category-bars";
import { RiskDistributionChart } from "@/components/charts/risk-distribution-chart";
import { UsageLineChart } from "@/components/charts/usage-line-chart";
import { dashboardStats, governanceEvents } from "@/lib/mock-data";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Aggregate AI usage, policy events, and audit-ready metadata for Northstar Financial. Raw content storage remains disabled."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {dashboardStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="grid gap-4 rounded-2xl border border-accord-border bg-accord-night p-5 text-white shadow-accord-panel lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-accord-violet">Policy posture</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">Governance health is stable.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Accord is routing approved model usage with metadata-first logging, redacted evidence, and no broad
            employee content retention.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["92%", "Low or medium risk", "Requests cleared by policy"],
            ["0", "Raw content stores", "Tenant default remains disabled"],
            ["184ms", "Median scan time", "Pre-flight policy evaluation"]
          ].map(([value, label, detail]) => (
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

      <section className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="AI usage over time" description="Requests routed through Accord by day.">
          <UsageLineChart />
        </ChartCard>
        <ChartCard title="Risk level distribution" description="Policy outcomes across all reviewed model calls.">
          <RiskDistributionChart />
        </ChartCard>
        <ChartCard title="Provider usage" description="Approved provider traffic for this tenant.">
          <ProviderUsageChart />
        </ChartCard>
        <ChartCard title="Top risk categories" description="Flagged events grouped by policy category.">
          <RiskCategoryBars />
        </ChartCard>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-accord-text">Recent flagged activity</h2>
            <p className="mt-1 text-sm text-slate-500">
              Redacted previews and policy outcomes only, designed for governance without surveillance.
            </p>
          </div>
        </div>
        <EventTable events={governanceEvents.slice(0, 4)} compact />
      </section>
    </div>
  );
}
