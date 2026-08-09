"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, UploadCloud } from "lucide-react";
import type { ImportedPolicyRule, PolicyImportResult } from "@/lib/policy-import/types";
import { cn } from "@/lib/utils";

type ImportState = "idle" | "parsing" | "ready" | "saving" | "saved" | "error";

const actionOptions = ["allow", "transform", "warn", "require_approval", "block"];
const severityOptions = ["low", "medium", "high", "critical"];
const destinationOptions = ["any", "approved", "enterprise", "personal", "unapproved"];
const providerOptions = ["any", "chatgpt", "openai", "anthropic", "gemini", "internal"];

export function PolicyImportPanel({ companySlug }: { companySlug: string }) {
  const router = useRouter();
  const [state, setState] = useState<ImportState>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<PolicyImportResult | null>(null);
  const [rules, setRules] = useState<ImportedPolicyRule[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectedRules = useMemo(() => rules.filter((rule) => selectedIds.has(rule.id)), [rules, selectedIds]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setState("parsing");
    setError("");
    setResult(null);
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
    setRules((current) => current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
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
    <section className="rounded-lg border border-dashed border-accord-primary/40 bg-accord-tint/40 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <UploadCloud className="h-5 w-5 text-accord-primary" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-semibold text-accord-text">Import an AI policy document</h3>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-accord-muted">
            PDF, DOCX, DOC, TXT, or Markdown. Accord extracts obligations as editable draft rules — raw text is never saved.
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

      {result ? (
        <div className="mt-5 space-y-4 rounded-md border border-accord-border bg-accord-panel p-4 text-left">
          <p className="font-mono text-[11px] text-accord-muted">
            {result.fileName} · {result.fileType.toUpperCase()} · {result.extractedCharacters.toLocaleString()} chars · {rules.length} generated rules
          </p>

          {result.warnings.length ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-5 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
              {result.warnings.join(" ")}
            </div>
          ) : null}

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

          <div className="flex flex-col gap-3 rounded-md border border-accord-border bg-accord-panel px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
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
  return (
    <article className={cn("rounded-md border bg-accord-panel p-3", selected ? "border-accord-primary/40" : "border-accord-border")}>
      <div className="grid gap-4 xl:grid-cols-[auto_minmax(220px,0.75fr)_minmax(0,1.25fr)] xl:items-start">
        <label className="flex items-center gap-2 text-[13px] font-medium text-accord-text xl:pt-7">
          <input className="h-4 w-4 accent-accord-primary" type="checkbox" checked={selected} onChange={onToggle} />
          Use
        </label>

        <div className="grid gap-3">
          <Input label="Rule name" value={rule.name} onChange={(value) => onChange({ name: value })} />
          <Input label="Rule key" value={rule.ruleKey} onChange={(value) => onChange({ ruleKey: value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Action" value={rule.action} options={actionOptions} onChange={(value) => onChange({ action: value as ImportedPolicyRule["action"] })} />
            <Select label="Severity" value={rule.severity} options={severityOptions} onChange={(value) => onChange({ severity: value as ImportedPolicyRule["severity"] })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Provider" value={rule.aiProvider} options={providerOptions} onChange={(value) => onChange({ aiProvider: value })} />
            <Select label="Destination" value={rule.destinationType} options={destinationOptions} onChange={(value) => onChange({ destinationType: value as ImportedPolicyRule["destinationType"] })} />
          </div>
        </div>

        <div className="grid gap-3">
          <TextArea label="Supporting excerpt" rows={4} value={rule.supportingExcerpt} onChange={(value) => onChange({ supportingExcerpt: value })} />
          <TextArea label="Employee explanation" rows={3} value={rule.employeeExplanation} onChange={(value) => onChange({ employeeExplanation: value })} />
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
          <p className="font-mono text-[11px] text-accord-muted">
            {rule.sourcePolicyName} · {rule.sourceSection} · {rule.confidence}% confidence
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
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-accord-text">
      {label}
      <select
        className="h-8 rounded-md border border-accord-border bg-accord-panel px-2.5 text-[13px] text-accord-text outline-none transition-colors focus:border-accord-primary"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
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
