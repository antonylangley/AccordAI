"use client";

import { useState } from "react";
import { FilePenLine, ShieldCheck } from "lucide-react";
import { EventTable } from "@/components/ui/event-table";
import { PageHeader } from "@/components/ui/page-header";
import { RiskBadge } from "@/components/ui/risk-badge";
import { governanceEvents, type GovernanceEvent } from "@/lib/mock-data";

export function RiskEventsExplorer() {
  const [selected, setSelected] = useState<GovernanceEvent>(governanceEvents[0]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Risk Events"
        description="Review flagged events with redacted prompt previews, policy outcomes, and reviewer notes. Raw prompts are intentionally not displayed."
      />
      <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <EventTable events={governanceEvents} selectedId={selected.id} onSelect={setSelected} />

        <aside className="rounded-2xl border border-accord-border bg-white/94 p-5 shadow-accord-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-accord-primary">Incident review</p>
              <h2 className="mt-1 text-xl font-semibold text-accord-text">{selected.category}</h2>
            </div>
            <RiskBadge level={selected.severity} />
          </div>

          <div className="mt-5 rounded-2xl border border-accord-border bg-accord-mist p-4">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-accord-muted">Risk score</p>
            <div className="mt-2 flex items-end gap-2">
              <p className="text-4xl font-semibold text-accord-text">{selected.riskScore}</p>
              <p className="pb-1 text-sm text-slate-500">/ 100</p>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-accord-text">Redacted prompt preview</p>
            <p className="mt-1 text-xs text-accord-muted">Secure evidence card. Raw prompt content is not displayed.</p>
            <p className="mt-2 rounded-2xl border border-accord-border bg-accord-night p-4 font-mono text-xs leading-6 text-slate-300">
              {selected.redactedPromptPreview}
            </p>
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-accord-text">Flags</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selected.flags.map((flag) => (
                <span key={flag} className="rounded-full bg-[#f1f2ff] px-3 py-1 text-xs font-semibold text-accord-primary">
                  {flag}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="flex gap-3 rounded-2xl border border-accord-border bg-white p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-accord-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-accord-text">Policy triggered</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{selected.policyTriggered}</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-2xl border border-accord-border bg-white p-4">
              <FilePenLine className="mt-0.5 h-5 w-5 text-accord-primary" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-accord-text">Recommended action</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{selected.recommendedAction}</p>
              </div>
            </div>
          </div>

          <label className="mt-5 block text-sm font-semibold text-accord-text" htmlFor="reviewer-notes">
            Reviewer notes
          </label>
          <textarea
            id="reviewer-notes"
            className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-accord-border bg-accord-mist p-3 text-sm outline-none focus:border-accord-primary"
            placeholder="Add review notes or exception rationale..."
          />
        </aside>
      </section>
    </div>
  );
}
