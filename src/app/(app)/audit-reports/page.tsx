import { Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { reportCards } from "@/lib/mock-data";

const previewFacts: Array<[string, string]> = [
  ["Date range", "Jun 1-30, 2026"],
  ["Total requests", "18,420"],
  ["High-risk events", "47"],
  ["Blocked events", "12"],
  ["Most common risk category", "PII exposure"],
  ["Policy changes", "3 versioned updates"]
];

const inputClass =
  "mt-1.5 w-full rounded-md border border-accord-border bg-accord-panel px-2.5 text-[13px] text-accord-text outline-none transition-colors placeholder:text-accord-faint focus:border-accord-primary";

export default function AuditReportsPage() {
  return (
    <div className="app-geist space-y-6">
      <PageHeader
        title="Audit Reports"
        description="Compliance-ready evidence from metadata logs, redacted previews, and policy outcomes"
        action={
          <button className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accord-night px-3 text-[13px] font-medium text-white transition-colors hover:bg-accord-navy dark:bg-accord-primary dark:hover:bg-accord-blue">
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export report
          </button>
        }
      />

      <section className="grid divide-y divide-accord-border rounded-lg border border-accord-border bg-accord-panel md:grid-cols-2 md:divide-y-0 xl:grid-cols-5 xl:divide-x">
        {reportCards.map((card) => (
          <article key={card.title} className="px-4 py-4">
            <h2 className="text-[13px] font-semibold text-accord-text">{card.title}</h2>
            <p className="mt-1 text-xs leading-5 text-accord-muted">{card.description}</p>
          </article>
        ))}
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
        <div className="rounded-lg border border-accord-border bg-accord-panel">
          <div className="border-b border-accord-border px-4 py-3">
            <h2 className="text-sm font-semibold text-accord-text">Report builder</h2>
          </div>
          <div className="grid gap-3.5 px-4 py-4">
            <label className="text-xs font-medium text-accord-text">
              Report type
              <select className={`${inputClass} h-8`}>
                <option>Monthly governance report</option>
                <option>High-risk incident report</option>
                <option>Policy change log</option>
              </select>
            </label>
            <label className="text-xs font-medium text-accord-text">
              Date range
              <select className={`${inputClass} h-8`}>
                <option>Jun 1, 2026 - Jun 30, 2026</option>
                <option>May 1, 2026 - May 31, 2026</option>
              </select>
            </label>
            <label className="text-xs font-medium text-accord-text">
              Reviewer notes
              <textarea
                className={`${inputClass} min-h-28 resize-y py-2`}
                placeholder="Add executive summary or audit context…"
              />
            </label>
          </div>
        </div>

        <article className="rounded-lg border border-accord-border bg-accord-panel">
          <div className="flex items-center justify-between gap-4 border-b border-accord-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-accord-text">Monthly Governance Report</h2>
              <p className="mt-0.5 text-xs text-accord-muted">Northstar Financial · Jun 1-30, 2026 · generated 4:18 PM ET</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Ready
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 px-4 py-2 sm:grid-cols-3">
            {previewFacts.map(([label, value]) => (
              <div key={label} className="border-b border-accord-border/60 py-2.5 [&:nth-last-child(-n+3)]:border-b-0">
                <dt className="text-[11px] uppercase tracking-[0.06em] text-accord-faint">{label}</dt>
                <dd className="mt-1 text-[13px] font-medium text-accord-text">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="border-t border-accord-border px-4 py-3.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-accord-faint">Reviewer notes</p>
            <p className="mt-1.5 text-[13px] leading-5 text-accord-muted">
              Northstar Financial maintained metadata-only logging by default. High-risk events were reviewed with
              redacted previews, and critical events were blocked according to policy.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
