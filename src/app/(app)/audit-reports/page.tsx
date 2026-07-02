import { Download, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { reportCards } from "@/lib/mock-data";

export default function AuditReportsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Audit Reports"
        description="Generate compliance-ready evidence from metadata logs, redacted previews, policy outcomes, and reviewer notes."
        action={
          <button className="inline-flex items-center gap-2 rounded-xl bg-accord-night px-4 py-2 text-sm font-semibold text-white shadow-accord-glow">
            <Download className="h-4 w-4" aria-hidden="true" />
            Export report
          </button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {reportCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} className="rounded-2xl border border-accord-border bg-white/94 p-5 shadow-sm">
              <div className="rounded-xl border border-accord-border bg-[#f1f2ff] p-2 text-accord-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 font-semibold text-accord-text">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{card.description}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-accord-border bg-white/94 p-5 shadow-accord-panel">
          <h2 className="text-lg font-semibold text-accord-text">Report builder</h2>
          <div className="mt-5 grid gap-4">
            <label className="text-sm font-medium text-slate-700">
              Report type
              <select className="mt-2 w-full rounded-xl border border-accord-border bg-accord-mist px-3 py-2 outline-none focus:border-accord-primary">
                <option>Monthly governance report</option>
                <option>High-risk incident report</option>
                <option>Policy change log</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Date range
              <select className="mt-2 w-full rounded-xl border border-accord-border bg-accord-mist px-3 py-2 outline-none focus:border-accord-primary">
                <option>Jun 1, 2026 - Jun 30, 2026</option>
                <option>May 1, 2026 - May 31, 2026</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Reviewer notes
              <textarea
                className="mt-2 min-h-32 w-full resize-none rounded-xl border border-accord-border bg-accord-mist p-3 outline-none focus:border-accord-primary"
                placeholder="Add executive summary or audit context..."
              />
            </label>
          </div>
        </div>

        <article className="rounded-2xl border border-accord-border bg-white p-6 shadow-accord-panel">
          <div className="flex items-start gap-4 border-b border-accord-border pb-5">
            <div className="rounded-2xl bg-gradient-to-br from-accord-primary to-accord-blue p-3 text-white">
              <FileText className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-accord-primary">Generated preview</p>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  Ready
                </span>
              </div>
              <h2 className="mt-1 text-2xl font-semibold text-accord-text">Monthly Governance Report</h2>
              <p className="mt-2 text-sm text-slate-500">Northstar Financial, Jun 1-30, 2026 at 4:18 PM ET</p>
            </div>
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              ["Date range", "Jun 1-30, 2026"],
              ["Total requests", "18,420"],
              ["High-risk events", "47"],
              ["Blocked events", "12"],
              ["Most common risk category", "PII exposure"],
              ["Policy changes", "3 versioned updates"]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-accord-border bg-accord-mist p-4">
                <dt className="text-xs font-medium uppercase text-slate-500">{label}</dt>
                <dd className="mt-2 font-semibold text-accord-text">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 rounded-2xl border border-accord-border bg-accord-mist p-4">
            <p className="text-sm font-semibold text-accord-text">Reviewer notes</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Northstar Financial maintained metadata-only logging by default. High-risk events were reviewed with
              redacted previews, and critical events were blocked according to policy.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
