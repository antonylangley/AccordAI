"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, UploadCloud } from "lucide-react";
import { isPolicyGuidanceOnly, recommendedActionToRuleAction, ruleActionToRecommendedAction } from "@/lib/policy-import/enforceability";
import type { ImportedPolicyIdentity, ImportedPolicyMetadataField, ImportedPolicyRule, PolicyImportResult } from "@/lib/policy-import/types";
import { cn } from "@/lib/utils";

type ImportState = "idle" | "parsing" | "ready" | "saving" | "saved" | "error";

const actionOptions = ["allow", "transform", "warn", "require_approval", "block"];
const severityOptions = ["low", "medium", "high", "critical"];
const destinationOptions = ["any", "approved", "enterprise", "personal", "unapproved"];
const providerOptions = ["any", "chatgpt", "openai", "anthropic", "gemini", "internal"];
const controlTypeOptions = [
  "data_submission",
  "destination_restriction",
  "data_redaction",
  "security_secret",
  "intellectual_property",
  "tool_usage",
  "human_review",
  "output_usage",
  "procedural",
  "monitoring",
  "other"
];
const enforceabilityOptions = ["fully_enforceable", "partially_enforceable", "not_enforceable"];
const directionOptions = ["prompt_input", "ai_provider_usage", "ai_output_usage", "human_process", "organization_policy", "unknown"];
const recommendedActionOptions = ["none", "warn", "redact", "require_approval", "block"];

export function PolicyImportPanel({ companySlug }: { companySlug: string }) {
  const router = useRouter();
  const [state, setState] = useState<ImportState>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<PolicyImportResult | null>(null);
  const [policy, setPolicy] = useState<ImportedPolicyIdentity | null>(null);
  const [rules, setRules] = useState<ImportedPolicyRule[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedRules = useMemo(() => rules.filter((rule) => selectedIds.has(rule.id)), [rules, selectedIds]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    event.currentTarget.blur();
    setState("parsing");
    setError("");
    setResult(null);
    setPolicy(null);
    setRules([]);
    setSelectedIds(new Set());

    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch("/api/policies/import", {
        method: "POST",
        body
      });
      const payload = (await response.json()) as PolicyImportResult & { error?: string };

      if (!response.ok) throw new Error(payload.error || "Could not import this policy document.");

      setResult(payload);
      setPolicy(payload.policy);
      setRules(payload.rules);
      setSelectedIds(new Set(payload.rules.map((rule) => rule.id)));
      setState("ready");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not import this policy document.");
      setState("error");
    } finally {
      event.target.value = "";
    }
  }

  async function saveDrafts() {
    if (!selectedRules.length) {
      setError("Select at least one generated rule to save.");
      setState("error");
      return;
    }

    setState("saving");
    setError("");

    try {
      const response = await fetch("/api/policies/import/drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          companySlug,
          policy,
          rules: selectedRules
        })
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) throw new Error(payload.error || "Could not save imported rules.");

      setState("saved");
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save imported rules.");
      setState("error");
    }
  }

  function updateRule(id: string, patch: Partial<ImportedPolicyRule>) {
    const normalizedPatch =
      patch.enforceability === "not_enforceable"
        ? ({ ...patch, recommendedAction: null, action: "allow", fallbackAction: "allow" } satisfies Partial<ImportedPolicyRule>)
        : patch;
    setRules((current) => current.map((rule) => (rule.id === id ? { ...rule, ...normalizedPatch } : rule)));
  }

  function updatePolicyField(fieldName: keyof Pick<ImportedPolicyIdentity, "title" | "description" | "organizationName" | "owner" | "effectiveDate" | "version" | "scope">, value: string) {
    setPolicy((current) => {
      if (!current) return current;
      const previous = current[fieldName] as ImportedPolicyMetadataField | undefined;
      const nextField: ImportedPolicyMetadataField = {
        value,
        confidence: previous?.confidence ?? 1,
        sourceText: previous?.sourceText,
        sourceSection: previous?.sourceSection,
        sourcePage: previous?.sourcePage,
        extractionMethod: previous?.value === value ? previous.extractionMethod : "admin_override",
        derived: previous?.derived
      };
      return { ...current, [fieldName]: nextField };
    });

    if (fieldName === "title") {
      setRules((current) => current.map((rule) => ({ ...rule, sourcePolicyName: value || rule.sourcePolicyName })));
    }
    if (fieldName === "effectiveDate") {
      setRules((current) => current.map((rule) => ({ ...rule, effectiveDate: value || rule.effectiveDate })));
    }
  }

  function toggleRule(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="space-y-4">
      <div data-layout-role="policy-import-upload" className="rounded-lg border border-dashed border-accord-primary/40 bg-accord-tint/40 p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <UploadCloud className="h-5 w-5 text-accord-primary" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-semibold text-accord-text">Import an AI policy document</h3>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-accord-muted">
              PDF, DOCX, DOC, TXT, or Markdown. Accord extracts obligations as editable draft rules; the full raw document is never saved.
            </p>
          </div>

          <label
            className={cn(
              "inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-accord-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-accord-blue",
              state === "parsing" && "pointer-events-none opacity-70"
            )}
          >
            {state === "parsing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
            {state === "parsing" ? "Parsing document" : "Choose file"}
            <input
              className="sr-only"
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md,application/pdf,application/msword,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
            />
          </label>
        </div>

        {error ? (
          <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] leading-5 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        {state === "saved" ? (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] font-medium text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
            <BadgeCheck className="h-4 w-4" aria-hidden="true" />
            Imported draft rules saved. Review them below, then approve and publish when ready.
          </div>
        ) : null}
      </div>

      {result ? (
        <div data-layout-role="policy-import-review" className="space-y-4 rounded-lg border border-accord-border bg-accord-panel p-4 text-left">
          <p className="font-mono text-[11px] text-accord-muted">
            {result.fileName} · {result.fileType.toUpperCase()} · {result.extractedCharacters.toLocaleString()} chars · {rules.length} generated rules
          </p>

          {result.warnings.length ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
              {result.warnings.join(" ")}
            </div>
          ) : null}

          {policy ? <PolicyIdentityEditor policy={policy} onChange={updatePolicyField} /> : null}

          <div className="space-y-3">
            {rules.map((rule) => (
              <ImportedRuleEditor
                key={rule.id}
                rule={rule}
                selected={selectedIds.has(rule.id)}
                onToggle={() => toggleRule(rule.id)}
                onChange={(patch) => updateRule(rule.id, patch)}
              />
            ))}
          </div>

          <div data-layout-role="policy-import-save-footer" className="flex flex-col gap-3 rounded-md border border-accord-border bg-accord-surface/35 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-accord-muted">
              {selectedRules.length} of {rules.length} generated rules selected. Saving creates drafts only; nothing is published until you approve and publish the bundle.
            </p>
            <button
              type="button"
              onClick={saveDrafts}
              disabled={state === "saving" || !selectedRules.length}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-accord-night px-3 text-[13px] font-medium text-white transition-colors hover:bg-accord-navy dark:bg-accord-primary dark:hover:bg-accord-blue disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BadgeCheck className="h-4 w-4" aria-hidden="true" />}
              Save selected drafts
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PolicyIdentityEditor({
  policy,
  onChange
}: {
  policy: ImportedPolicyIdentity;
  onChange: (
    fieldName: keyof Pick<ImportedPolicyIdentity, "title" | "description" | "organizationName" | "owner" | "effectiveDate" | "version" | "scope">,
    value: string
  ) => void;
}) {
  return (
    <div className="rounded-md border border-accord-border bg-accord-surface/40 p-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-accord-faint">Step 1 · Policy identity</p>
          <h4 className="mt-1 text-sm font-semibold text-accord-text">Confirm the imported policy</h4>
        </div>
        <span className="w-fit rounded border border-accord-border bg-accord-panel px-1.5 py-0.5 font-mono text-[11px] text-accord-muted">
          {formatConfidence(policy.metadataExtractionConfidence)}
        </span>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <PolicyFieldInput label="Policy title" field={policy.title} onChange={(value) => onChange("title", value)} />
        <PolicyFieldInput label="Organization" field={policy.organizationName} onChange={(value) => onChange("organizationName", value)} />
        <PolicyFieldInput label="Owner" field={policy.owner} onChange={(value) => onChange("owner", value)} />
        <PolicyFieldInput label="Effective date" field={policy.effectiveDate} onChange={(value) => onChange("effectiveDate", value)} />
        <PolicyFieldInput label="Version" field={policy.version} onChange={(value) => onChange("version", value)} />
        <PolicyFieldInput label="Scope" field={policy.scope} onChange={(value) => onChange("scope", value)} />
      </div>

      <div className="mt-3">
        <PolicyFieldTextArea label="Description / purpose" field={policy.description} rows={3} onChange={(value) => onChange("description", value)} />
      </div>

      {policy.sections.length ? (
        <p className="mt-3 font-mono text-[11px] text-accord-muted">
          {policy.sections.length} source section{policy.sections.length === 1 ? "" : "s"} detected from document structure.
        </p>
      ) : null}
    </div>
  );
}

function PolicyFieldInput({
  label,
  field,
  onChange
}: {
  label: string;
  field?: ImportedPolicyMetadataField;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-accord-text">
      <span className="flex items-center justify-between gap-2">
        {label}
        {field ? <MetadataHint field={field} /> : null}
      </span>
      <input
        className={cn(
          "h-8 rounded-md border bg-accord-panel px-2.5 text-[13px] text-accord-text outline-none transition-colors focus:border-accord-primary",
          field && field.confidence < 0.6 ? "border-amber-300" : "border-accord-border"
        )}
        value={field?.value || ""}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function PolicyFieldTextArea({
  label,
  field,
  rows,
  onChange
}: {
  label: string;
  field: ImportedPolicyMetadataField;
  rows: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-accord-text">
      <span className="flex items-center justify-between gap-2">
        {label}
        <MetadataHint field={field} />
      </span>
      <textarea
        className={cn(
          "resize-y rounded-md border bg-accord-panel px-2.5 py-2 text-[13px] leading-5 text-accord-text outline-none transition-colors focus:border-accord-primary",
          field.confidence < 0.6 ? "border-amber-300" : "border-accord-border"
        )}
        rows={rows}
        value={field.value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function MetadataHint({ field }: { field: ImportedPolicyMetadataField }) {
  return (
    <span className="font-mono text-[10px] font-normal text-accord-muted" title={field.sourceText || field.extractionMethod}>
      {formatConfidence(field.confidence)} · {formatLabel(field.extractionMethod)}
    </span>
  );
}

function ImportedRuleEditor({
  rule,
  selected,
  onToggle,
  onChange
}: {
  rule: ImportedPolicyRule;
  selected: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<ImportedPolicyRule>) => void;
}) {
  const guidanceOnly = isPolicyGuidanceOnly(rule.enforceability);
  const recommendedActionValue = rule.recommendedAction ?? "none";

  return (
    <article className={cn("rounded-md border bg-accord-panel p-3", selected ? "border-accord-primary/40" : "border-accord-border")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <label className="flex items-center gap-2 text-[13px] font-medium text-accord-text">
          <input className="h-4 w-4 accent-accord-primary" type="checkbox" checked={selected} onChange={onToggle} />
          Use
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <EnforceabilityPill enforceability={rule.enforceability} />
          <span className="rounded border border-accord-border px-1.5 py-0.5 font-mono text-[11px] text-accord-muted">
            {formatConfidence(rule.confidence)}
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.2fr)] xl:items-start">

        <div className="grid gap-3">
          <Input label="Rule name" value={rule.name} onChange={(value) => onChange({ name: value })} />
          <Input label="Rule key" value={rule.ruleKey} onChange={(value) => onChange({ ruleKey: value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Control type" value={rule.controlType} options={controlTypeOptions} onChange={(value) => onChange({ controlType: value as ImportedPolicyRule["controlType"] })} />
            <Select label="Enforceability" value={rule.enforceability} options={enforceabilityOptions} onChange={(value) => onChange({ enforceability: value as ImportedPolicyRule["enforceability"] })} />
          </div>
          <Select
            label="Direction / scope"
            value={rule.requirementDirection}
            options={directionOptions}
            onChange={(value) => onChange({ requirementDirection: value as ImportedPolicyRule["requirementDirection"] })}
          />
          {guidanceOnly ? (
            <div className="rounded-md border border-accord-border bg-accord-surface/50 px-3 py-2 text-[12px] leading-5 text-accord-muted">
              <p className="font-medium text-accord-text">Policy guidance only</p>
              <p className="mt-1">
                Current Guard cannot observe this requirement at the outgoing prompt layer. It saves with action Allow until an admin converts it into an enforceable control.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Recommended action"
                value={recommendedActionValue}
                options={recommendedActionOptions}
                onChange={(value) => {
                  const recommendedAction = value === "none" ? null : (value as ImportedPolicyRule["recommendedAction"]);
                  onChange({
                    recommendedAction,
                    action: recommendedActionToRuleAction(recommendedAction)
                  });
                }}
              />
              <Select
                label="Action"
                value={rule.action}
                options={actionOptions}
                onChange={(value) =>
                  onChange({
                    action: value as ImportedPolicyRule["action"],
                    recommendedAction: ruleActionToRecommendedAction(value as ImportedPolicyRule["action"])
                  })
                }
              />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Severity" value={rule.severity} options={severityOptions} onChange={(value) => onChange({ severity: value as ImportedPolicyRule["severity"] })} />
            <Select label="Provider" value={rule.aiProvider} options={providerOptions} onChange={(value) => onChange({ aiProvider: value })} />
          </div>
          <p className="font-mono text-[11px] text-accord-muted">Recommended severity: {formatLabel(rule.recommendedSeverity || rule.severity)}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Destination" value={rule.destinationType} options={destinationOptions} onChange={(value) => onChange({ destinationType: value as ImportedPolicyRule["destinationType"] })} />
            <Input
              label="Destination types"
              value={rule.destinationTypes.join(", ")}
              onChange={(value) =>
                onChange({
                  destinationTypes: value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean) as ImportedPolicyRule["destinationTypes"]
                })
              }
            />
          </div>
        </div>

        <div className="grid gap-3">
          <TextArea label="Requirement summary" rows={2} value={rule.requirementSummary} onChange={(value) => onChange({ requirementSummary: value })} />
          <TextArea label="Supporting excerpt" rows={4} value={rule.supportingExcerpt} onChange={(value) => onChange({ supportingExcerpt: value })} />
          <TextArea label="Condition" rows={2} value={rule.conditionDescription} onChange={(value) => onChange({ conditionDescription: value })} />
          <TextArea label="Employee explanation" rows={3} value={rule.employeeExplanation} onChange={(value) => onChange({ employeeExplanation: value })} />
          <TextArea label="Reasoning" rows={3} value={rule.reasoning} onChange={(value) => onChange({ reasoning: value })} />
          <Input
            label="Data categories"
            value={rule.dataCategories.join(", ")}
            onChange={(value) =>
              onChange({
                dataCategories: value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              })
            }
          />
          {rule.destinationAuthorizations.length ? (
            <div className="rounded-md border border-accord-border bg-accord-surface/40 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-accord-faint">Destination authorization</p>
              <div className="mt-1.5 space-y-1">
                {rule.destinationAuthorizations.map((authorization, index) => (
                  <p key={`${authorization.provider}-${index}`} className="text-[12px] leading-5 text-accord-muted">
                    {authorization.provider} · {authorization.destinationType} · {authorization.dataCategories.join(", ")} · {authorization.condition}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
          <p className="font-mono text-[11px] text-accord-muted">
            {rule.sourcePolicyName} · {rule.sourceSection}
          </p>
        </div>
      </div>
    </article>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-accord-text">
      {label}
      <input
        className="h-8 rounded-md border border-accord-border bg-accord-panel px-2.5 text-[13px] text-accord-text outline-none transition-colors focus:border-accord-primary"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  disabled
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-accord-text">
      {label}
      <select
        className="h-8 rounded-md border border-accord-border bg-accord-panel px-2.5 text-[13px] text-accord-text outline-none transition-colors focus:border-accord-primary disabled:cursor-not-allowed disabled:opacity-60"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {formatLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function EnforceabilityPill({ enforceability }: { enforceability: ImportedPolicyRule["enforceability"] }) {
  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 text-[11px] font-medium",
        enforceability === "fully_enforceable" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400",
        enforceability === "partially_enforceable" && "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400",
        enforceability === "not_enforceable" && "border-accord-border bg-accord-surface text-accord-muted"
      )}
    >
      {enforceabilityLabel(enforceability)}
    </span>
  );
}

function enforceabilityLabel(enforceability: ImportedPolicyRule["enforceability"]) {
  if (enforceability === "fully_enforceable") return "Fully enforceable";
  if (enforceability === "partially_enforceable") return "Partially enforceable";
  return "Policy guidance only";
}

function formatConfidence(value: number) {
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}% confidence`;
}

function formatLabel(value: string) {
  if (value === "none") return "None";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function TextArea({
  label,
  rows,
  value,
  onChange
}: {
  label: string;
  rows: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-accord-text">
      {label}
      <textarea
        className="resize-y rounded-md border border-accord-border bg-accord-panel px-2.5 py-2 text-[13px] leading-5 text-accord-text outline-none transition-colors focus:border-accord-primary"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
