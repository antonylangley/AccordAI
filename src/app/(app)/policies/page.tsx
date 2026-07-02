import { BadgeCheck, Clock3 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PolicyToggle } from "@/components/ui/policy-toggle";
import { policyToggles, policyVersionHistory, retentionSettings, thresholdRows } from "@/lib/mock-data";

export default function PoliciesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Policies"
        description="Configure governance rules for AI usage with risk thresholds, redaction behavior, retention, and versioned policy history."
      />

      <section className="rounded-2xl border border-accord-border bg-accord-night p-6 text-white shadow-accord-panel">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-accord-violet">Active policy pack</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-white">Financial Services Starter Policy</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Tuned for PII, regulated financial context, customer communications, and metadata-first audit logs.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200">
            <BadgeCheck className="h-4 w-4" aria-hidden="true" />
            Active
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-accord-border bg-white/94 p-5 shadow-accord-panel">
          <h2 className="text-lg font-semibold text-accord-text">Risk thresholds</h2>
          <div className="mt-5 divide-y divide-slate-100">
            {thresholdRows.map((row) => (
              <div key={row.level} className="grid gap-3 py-4 sm:grid-cols-[120px_180px_1fr]">
                <p className="font-semibold text-accord-text">{row.level}</p>
                <p className="text-sm font-semibold text-accord-primary">{row.behavior}</p>
                <p className="text-sm leading-6 text-slate-600">{row.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {policyToggles.map((item) => (
            <PolicyToggle key={item.label} item={item} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-accord-border bg-white/94 p-5 shadow-accord-panel">
          <h2 className="text-lg font-semibold text-accord-text">Retention settings</h2>
          <div className="mt-5 space-y-3">
            {retentionSettings.map((setting) => (
              <div key={setting.label} className="flex items-center justify-between rounded-xl border border-accord-border bg-accord-mist px-4 py-3">
                <span className="text-sm font-medium text-slate-700">{setting.label}</span>
                <span className="text-sm font-semibold text-accord-text">{setting.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-accord-border bg-white/94 p-5 shadow-accord-panel">
          <h2 className="text-lg font-semibold text-accord-text">Policy version history</h2>
          <div className="mt-5 space-y-4">
            {policyVersionHistory.map((item) => (
              <div key={item.version} className="flex gap-3">
                <div className="mt-1 rounded-full bg-[#f1f2ff] p-2 text-accord-primary">
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-semibold text-accord-text">
                    {item.version} <span className="font-normal text-slate-500">on {item.date}</span>
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
