"use client";

import { useState } from "react";
import { EventTable } from "@/components/ui/event-table";
import { PageHeader } from "@/components/ui/page-header";
import { RiskBadge } from "@/components/ui/risk-badge";
import { governanceEvents, type GovernanceEvent } from "@/lib/mock-data";

export function RiskEventsExplorer() {
  const [selected, setSelected] = useState<GovernanceEvent>(governanceEvents[0]);

  return (
    <div className="app-geist space-y-6">
      <PageHeader
        title="Risk Events"
        description="Flagged events with redacted previews and policy outcomes — raw prompts are never displayed"
      />
      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <EventTable events={governanceEvents} selectedId={selected.id} onSelect={setSelected} />

        <aside className="rounded-lg border border-accord-border bg-accord-panel">
          <div className="flex items-center justify-between gap-4 border-b border-accord-border px-4 py-3">
            <h2 className="text-sm font-semibold text-accord-text">{selected.category}</h2>
            <RiskBadge level={selected.severity} />
          </div>

          <div className="space-y-4 px-4 py-4">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-[13px] text-accord-muted">Risk score</p>
              <p className="text-xl font-semibold text-accord-text [font-variant-numeric:tabular-nums]">
                {selected.riskScore}
                <span className="ml-1 text-xs font-normal text-accord-muted">/ 100</span>
              </p>
            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-accord-faint">Redacted prompt preview</p>
              <p className="mt-1.5 rounded-md bg-accord-night p-3 font-mono text-xs leading-5 text-slate-300">
                {selected.redactedPromptPreview}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-accord-faint">Flags</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {selected.flags.map((flag) => (
                  <span key={flag} className="rounded border border-accord-border bg-accord-surface px-1.5 py-0.5 text-[11px] font-medium text-accord-muted">
                    {flag}
                  </span>
                ))}
              </div>
            </div>

            <div className="divide-y divide-accord-border/60 border-t border-accord-border/60">
              <div className="py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-accord-faint">Policy triggered</p>
                <p className="mt-1 text-[13px] leading-5 text-accord-text">{selected.policyTriggered}</p>
              </div>
              <div className="py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-accord-faint">Recommended action</p>
                <p className="mt-1 text-[13px] leading-5 text-accord-text">{selected.recommendedAction}</p>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-accord-faint" htmlFor="reviewer-notes">
                Reviewer notes
              </label>
              <textarea
                id="reviewer-notes"
                className="mt-1.5 min-h-24 w-full resize-y rounded-md border border-accord-border bg-accord-panel p-2.5 text-[13px] leading-5 text-accord-text outline-none transition-colors placeholder:text-accord-faint focus:border-accord-primary"
                placeholder="Add review notes or exception rationale…"
              />
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
