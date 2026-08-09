import { ArrowRight, FileText } from "lucide-react";

export function PolicyFlowGraphic() {
  return (
    <div
      role="img"
      aria-label="How Accord turns a policy document into an enforced bundle: upload the document, Accord parses it into actionable rules, and approved rules deploy as a bundle to Accord Guard"
      className="select-none"
    >
      <div className="grid items-stretch gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
        {/* Stage 1: the document */}
        <Stage step="1" label="Upload your policy">
          <div className="flex items-center gap-2 border-b border-accord-border px-3.5 py-2.5">
            <FileText className="h-3.5 w-3.5 shrink-0 text-accord-primary" aria-hidden="true" />
            <p className="min-w-0 truncate text-[12px] font-medium text-accord-text">External AI Usage Policy.pdf</p>
            <span className="ml-auto shrink-0 rounded border border-accord-border px-1.5 py-0.5 font-mono text-[9px] uppercase text-accord-muted">
              pdf
            </span>
          </div>
          <div className="space-y-2 px-3.5 py-3">
            <DocLine w="92%" />
            <DocLine w="78%" />
            <div className="rounded-sm bg-accord-tint px-2 py-1.5">
              <p className="text-[10px] leading-4 text-accord-text/80">
                "Employees must not submit client names, account numbers, or medical records to personal AI services…"
              </p>
              <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.06em] text-accord-primary">§ 4.2 · Client information</p>
            </div>
            <DocLine w="85%" />
            <DocLine w="60%" />
          </div>
        </Stage>

        <FlowArrow />

        {/* Stage 2: parsed into rules */}
        <Stage step="2" label="Accord parses it into rules">
          <div className="flex items-center justify-between border-b border-accord-border px-3.5 py-2.5">
            <p className="text-[12px] font-medium text-accord-text">Extracted draft rules</p>
            <span className="font-mono text-[9px] text-accord-muted">2 of 7</span>
          </div>
          <div className="space-y-2 px-3.5 py-3">
            <RuleChip
              name="Redact client identifying information"
              ruleKey="redact_client_identifying_info"
              tag="cited § 4.2"
            />
            <RuleChip
              name="Block medical records in personal AI"
              ruleKey="block_medical_records_personal_ai"
              tag="cited § 4.2"
            />
            <p className="pt-0.5 text-[10px] leading-4 text-accord-muted">
              Every rule carries its source citation and an employee-facing explanation.
            </p>
          </div>
        </Stage>

        <FlowArrow />

        {/* Stage 3: deployed bundle */}
        <Stage step="3" label="Approved rules deploy as a bundle">
          <div className="flex h-full flex-col justify-between bg-accord-night p-3.5 text-white">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold">Bundle v12</p>
                <span className="rounded border border-white/15 px-1.5 py-0.5 font-mono text-[9px] text-slate-300">7 rules</span>
              </div>
              <p className="mt-1.5 font-mono text-[9px] text-slate-400">7d197c1d54a5e4613d375f72</p>
            </div>
            <div className="mt-4 space-y-1.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                Live in Accord Guard
              </p>
              <p className="text-[10px] leading-4 text-slate-400">
                Enforced in the browser on every prompt — warn, redact, require approval, or block.
              </p>
            </div>
          </div>
        </Stage>
      </div>
    </div>
  );
}

function Stage({ step, label, children }: { step: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <p className="mb-2 flex items-center gap-2 text-[11px] font-medium text-accord-muted">
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-accord-tint font-mono text-[9px] font-semibold text-accord-primary">
          {step}
        </span>
        {label}
      </p>
      <div className="flex-1 overflow-hidden rounded-lg border border-accord-border bg-accord-panel">{children}</div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="hidden items-center self-stretch pt-5 lg:flex">
      <ArrowRight className="h-4 w-4 text-accord-faint" aria-hidden="true" />
    </div>
  );
}

function DocLine({ w }: { w: string }) {
  return <div className="h-1.5 rounded-full bg-accord-surface" style={{ width: w }} />;
}

function RuleChip({ name, ruleKey, tag }: { name: string; ruleKey: string; tag: string }) {
  return (
    <div className="rounded-md border border-accord-border bg-accord-panel px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[11px] font-medium text-accord-text">{name}</p>
        <span className="shrink-0 rounded border border-emerald-200 bg-emerald-50 px-1 py-px text-[8px] font-medium text-emerald-700">
          draft
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate font-mono text-[9px] text-slate-400">{ruleKey}</p>
        <span className="shrink-0 font-mono text-[8px] text-accord-primary">{tag}</span>
      </div>
    </div>
  );
}
