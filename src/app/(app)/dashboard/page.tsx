import Link from "next/link";
import { ArrowRight, Calendar, Download, Gauge, LockKeyhole, ShieldCheck } from "lucide-react";
import { ChartCard } from "@/components/ui/chart-card";
import { EventTable } from "@/components/ui/event-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ProviderUsageChart } from "@/components/charts/provider-usage-chart";
import { RiskCategoryBars } from "@/components/charts/risk-category-bars";
import { RiskDistributionChart } from "@/components/charts/risk-distribution-chart";
import { UsageLineChart } from "@/components/charts/usage-line-chart";
import { dashboardStats, governanceEvents } from "@/lib/mock-data";

const postureTiles = [
  { value: "92%", label: "Low or medium risk", detail: "Requests cleared by policy", icon: ShieldCheck },
  { value: "0", label: "Raw content stores", detail: "Tenant default remains disabled", icon: LockKeyhole },
  { value: "184ms", label: "Median scan time", detail: "Pre-flight policy evaluation", icon: Gauge }
];

export default function DashboardPage() {
  return (
    <div className="space-y-7">
      <PageHeader
        title="Overview"
        description="Aggregate AI usage, policy events, and audit-ready metadata for Northstar Financial. Raw content storage remains disabled."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-9 items-center gap-2 rounded-md border border-accord-border bg-white px-3 text-sm font-medium text-accord-text transition hover:border-accord-primary/30"
            >
              <Calendar className="h-4 w-4 text-accord-muted" aria-hidden="true" />
              Last 7 days
            </button>
            <button
              type="button"
              className="flex h-9 items-center gap-2 rounded-md bg-accord-text px-3 text-sm font-medium text-white transition hover:opacity-90"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export
            </button>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {dashboardStats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="relative overflow-hidden rounded-lg border border-accord-darkBorder bg-gradient-to-br from-accord-ink to-accord-night p-6 text-white shadow-accord-soft">
        <div className="relative grid gap-6 lg:grid-cols-[1fr_1.5fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-accord-violet">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Policy posture
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-balance">
              Governance health is stable.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Accord is routing approved model usage with metadata-first logging, redacted evidence, and no broad
              employee content retention.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {postureTiles.map(({ value, label, detail, icon: Icon }) => (
              <article
                key={label}
                className="rounded-md border border-white/[0.08] bg-white/[0.04] p-4 transition hover:border-white/[0.16]"
              >
                <div className="flex items-center justify-between">
                  <p className="tnum text-2xl font-semibold tracking-[-0.02em]">{value}</p>
                  <Icon className="h-4 w-4 text-accord-violet" aria-hidden="true" />
                </div>
                <p className="mt-2 text-sm font-semibold text-white">{label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="AI usage over time" description="Requests routed through Accord by day." meta="7d">
          <UsageLineChart />
        </ChartCard>
        <ChartCard title="Risk level distribution" description="Policy outcomes across all reviewed model calls." meta="All calls">
          <RiskDistributionChart />
        </ChartCard>
        <ChartCard title="Provider usage" description="Approved provider traffic for this tenant." meta="Requests">
          <ProviderUsageChart />
        </ChartCard>
        <ChartCard title="Top risk categories" description="Flagged events grouped by policy category." meta="Events">
          <RiskCategoryBars />
        </ChartCard>
      </section>

      <section>
        <div className="mb-3.5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold tracking-[-0.01em] text-accord-text">Recent flagged activity</h2>
            <p className="mt-1 text-sm text-accord-muted">
              Redacted previews and policy outcomes only, designed for governance without surveillance.
            </p>
          </div>
          <Link
            href="/risk-events"
            className="hidden shrink-0 items-center gap-1.5 rounded-md border border-accord-border bg-white px-3 py-2 text-sm font-medium text-accord-text transition hover:border-accord-primary/30 sm:flex"
          >
            View all
            <ArrowRight className="h-4 w-4 text-accord-muted" aria-hidden="true" />
          </Link>
        </div>
        <EventTable events={governanceEvents.slice(0, 4)} compact />
      </section>
    </div>
  );
}
