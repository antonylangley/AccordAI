"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  FileCheck2,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  X
} from "lucide-react";
import type { ChatAttachmentMetadata, ChatGatewayResponse, ProviderCapabilities } from "@/lib/chat/types";
import { cn } from "@/lib/utils";
import type { RiskState } from "./types";

type GovernancePanelProps = {
  risk: RiskState;
  redactedPreview?: string;
  redactions?: string[];
  redactionSummary?: ChatGatewayResponse["redactionSummary"];
  model: string;
  provider: string;
  capabilities: ProviderCapabilities;
  attachments: ChatAttachmentMetadata[];
  contentSupportWarning?: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSendRedacted: () => void;
  onEditMessage: () => void;
  onCancel: () => void;
};

export function GovernancePanel({
  risk,
  redactedPreview,
  redactions = [],
  redactionSummary,
  model,
  provider,
  capabilities,
  attachments,
  contentSupportWarning,
  collapsed,
  onToggleCollapsed,
  onSendRedacted,
  onEditMessage,
  onCancel
}: GovernancePanelProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (collapsed) return null;

  const warning = risk.decision === "Warn" || risk.decision === "Redact" || risk.decision === "Block";

  return (
    <aside className="hidden min-h-0 w-[320px] shrink-0 overflow-y-auto rounded-2xl border border-accord-border bg-white/92 shadow-accord-panel 2xl:block">
      <div className="sticky top-0 z-10 border-b border-accord-border bg-white/95 p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-accord-primary">
              Governance layer
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-accord-text">Live risk review</h2>
          </div>
          <button type="button" onClick={onToggleCollapsed} className="rounded-full border border-accord-border p-2">
            <X className="h-4 w-4 text-accord-muted" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <section className="rounded-2xl border border-accord-border bg-accord-mist p-4">
          <p className="text-sm font-semibold text-accord-text">Model route</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white px-3 py-2">
              <p className="font-medium text-accord-muted">Provider</p>
              <p className="mt-1 font-semibold text-accord-text">{provider}</p>
            </div>
            <div className="rounded-xl bg-white px-3 py-2">
              <p className="font-medium text-accord-muted">Model</p>
              <p className="mt-1 font-semibold text-accord-text">{model}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-accord-muted">
              Text {capabilities.text ? "on" : "off"}
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-accord-muted">
              Images {capabilities.images ? "on" : "off"}
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-accord-muted">
              Docs {capabilities.documents ? "on" : "off"}
            </span>
          </div>
          {contentSupportWarning ? (
            <p className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs leading-5 text-orange-900">
              {contentSupportWarning}
            </p>
          ) : null}
        </section>

        <section
          className={cn(
            "rounded-2xl border p-4",
            risk.tone === "clear" && "border-emerald-200 bg-emerald-50",
            risk.tone === "warning" && "border-orange-200 bg-orange-50",
            risk.tone === "critical" && "border-red-200 bg-red-50"
          )}
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Policy decision</p>
              <p
                className={cn(
                  "mt-1 text-3xl font-semibold tracking-[-0.04em]",
                  risk.tone === "clear" && "text-emerald-700",
                  risk.tone === "warning" && "text-orange-700",
                  risk.tone === "critical" && "text-red-700"
                )}
              >
                {risk.decision}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-slate-500">Risk score</p>
              <p className="text-2xl font-semibold tracking-[-0.04em] text-accord-text">{risk.score}/100</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/10">
            <div
              className={cn(
                "h-full rounded-full",
                risk.tone === "clear" && "bg-emerald-400",
                risk.tone === "warning" && "bg-orange-400",
                risk.tone === "critical" && "bg-red-500"
              )}
              style={{ width: `${risk.score}%` }}
            />
          </div>
        </section>

        <section>
          <p className="text-sm font-semibold text-accord-text">Detected categories</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {risk.categories.map((category) => (
              <span key={category} className="rounded-full bg-[#f1f2ff] px-3 py-1 text-xs font-semibold text-accord-primary">
                {category}
              </span>
            ))}
          </div>
        </section>

        {redactedPreview ? (
          <section className="rounded-2xl border border-accord-border bg-accord-mist p-4">
            <p className="text-sm font-semibold text-accord-text">Redacted provider preview</p>
            <p className="mt-2 text-xs leading-5 text-accord-muted">{redactedPreview}</p>
            {redactionSummary?.total ? (
              <div className="mt-3 rounded-xl border border-white bg-white/80 p-3 text-xs leading-5 text-accord-muted">
                <p className="font-semibold text-accord-text">{redactionSummary.total} identifiers redacted</p>
                <p className="mt-1">{formatEntityCounts(redactionSummary.byType)}</p>
                <p className="mt-2">Provider saw placeholder-based content.</p>
                <p>{redactionSummary.responseRehydrated ? "Response rehydrated locally." : "No response placeholders needed local rehydration."}</p>
              </div>
            ) : null}
            {redactions.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {redactions.map((placeholder) => (
                  <span key={placeholder} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-accord-primary">
                    {placeholder}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {attachments.length ? (
          <section className="rounded-2xl border border-accord-border bg-accord-mist p-4">
            <p className="text-sm font-semibold text-accord-text">Attachment governance</p>
            <div className="mt-3 space-y-2">
              {attachments.map((attachment) => (
                <div key={attachment.id || attachment.name} className="rounded-xl bg-white px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate font-semibold text-accord-text">{attachment.name}</p>
                    <span className="shrink-0 rounded-full bg-accord-mist px-2 py-0.5 font-mono text-[10px] text-accord-muted">
                      {attachment.type}
                    </span>
                  </div>
                  <p className="mt-1 leading-5 text-accord-muted">
                    {attachment.extractionStatus === "metadata_only_todo"
                      ? "Metadata only. Text extraction is TODO for this format."
                      : attachment.kind === "image"
                        ? "Image accepted with visual scan limitation."
                        : attachment.flags?.length
                          ? "Text extracted and redacted where needed."
                          : "Text extracted with no elevated flags."}
                  </p>
                  {attachment.flags?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {attachment.flags.map((flag) => (
                        <span key={`${attachment.id}-${flag.type}`} className="rounded-full bg-[#f1f2ff] px-2 py-0.5 font-semibold text-accord-primary">
                          {flag.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {attachment.visualScanLimited ? (
                    <p className="mt-2 rounded-lg bg-orange-50 px-2 py-1 text-[11px] leading-4 text-orange-800">
                      Visual PII redaction is not fully implemented yet.
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {warning ? (
          <section className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-orange-950">
                  {risk.decision === "Block" ? "Provider routing blocked" : risk.decision === "Redact" ? "Redaction required" : "Policy warning issued"}
                </p>
                <p className="mt-1 text-xs leading-5 text-orange-900">
                  Raw detected identifiers are not routed to external models by default.
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              <button type="button" onClick={onSendRedacted} className="rounded-xl bg-accord-night px-3 py-2 text-sm font-semibold text-white">
                Send redacted
              </button>
              <button type="button" onClick={onEditMessage} className="rounded-xl border border-orange-300 bg-white px-3 py-2 text-sm font-semibold text-orange-800">
                Edit message
              </button>
              <button type="button" onClick={onCancel} className="rounded-xl border border-accord-border bg-white px-3 py-2 text-sm font-semibold text-accord-text">
                Cancel
              </button>
            </div>
          </section>
        ) : null}

        <button
          type="button"
          onClick={() => setDetailsOpen((value) => !value)}
          className="flex w-full items-center justify-between rounded-2xl border border-accord-border bg-accord-mist px-4 py-3 text-left text-sm font-semibold text-accord-text transition hover:border-accord-primary/30"
        >
          Audit details
          {detailsOpen ? (
            <ChevronUp className="h-4 w-4 text-accord-muted" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 text-accord-muted" aria-hidden="true" />
          )}
        </button>

        {detailsOpen ? (
          <div className="space-y-3">
            <section className="rounded-2xl border border-[#dfe4ff] bg-[#f3f4ff] p-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-accord-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-accord-text">Pre-flight scan</p>
                  <p className="text-xs text-accord-muted">Enabled before every model call</p>
                </div>
              </div>
            </section>

            {[
              ["Redaction behavior", "Identifiers are masked in review evidence.", LockKeyhole],
              ["Logging behavior", "Metadata by default, redacted previews only.", FileCheck2],
              ["Post-response scan", "Response is checked for regulated claims.", ShieldAlert],
              ["Audit trail", "Admin review actions are audit logged.", CheckCircle2]
            ].map(([title, copy, Icon]) => (
              <section key={title as string} className="rounded-2xl border border-accord-border bg-accord-mist p-4">
                <div className="flex gap-3">
                  <Icon className="mt-0.5 h-5 w-5 text-accord-primary" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-accord-text">{title as string}</p>
                    <p className="mt-1 text-xs leading-5 text-accord-muted">{copy as string}</p>
                  </div>
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function formatEntityCounts(counts: ChatGatewayResponse["redactionSummary"]["byType"]) {
  const entries = Object.entries(counts)
    .filter(([, count]) => Boolean(count))
    .map(([type, count]) => `${count} ${type.toLowerCase()}`);

  return entries.length ? entries.join(", ") : "No identifiers redacted";
}
