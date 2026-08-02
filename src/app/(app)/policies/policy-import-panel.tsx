"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, FileText, Loader2, UploadCloud } from "lucide-react";
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
    <section className="rounded-2xl border border-accord-border bg-accord-mist p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-white p-2 text-accord-primary shadow-sm ring-1 ring-accord-border">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-accord-text">Import existing AI policy</h3>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-accord-muted">
              Upload a policy PDF, DOCX, DOC, TXT, or Markdown file. Accord extracts policy obligations and formats them as editable draft rules. Raw document text is not saved.
            </p>
          </div>
        </div>

        <label
          className={cn(
            "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-accord-text shadow-sm ring-1 ring-accord-border transition hover:-translate-y-0.5 hover:text-accord-primary",
            state === "parsing" && "pointer-events-none opacity-70"
          )}
        >
          {state === "parsing" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UploadCloud className="h-4 w-4" aria-hidden="true" />}
          {state === "parsing" ? "Parsing document" : "Upload policy doc"}
          <input
            className="sr-only"
            type="file"
            accept=".pdf,.docx,.doc,.txt,.md,application/pdf,application/msword,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
          />
        </label>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
          {error}
        </div>
      ) : null}

      {state === "saved" ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          <BadgeCheck className="h-4 w-4" aria-hidden="true" />
          Imported draft rules saved. Review them below, then approve and publish when ready.
        </div>
      ) : null}

      {result ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-accord-border">{result.fileName}</span>
            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-accord-border">{result.fileType.toUpperCase()}</span>
            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-accord-border">{result.extractedCharacters.toLocaleString()} chars extracted</span>
            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-accord-border">{rules.length} generated rules</span>
          </div>

          {result.warnings.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
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

          <div className="flex flex-col gap-3 rounded-2xl border border-accord-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-accord-muted">
              {selectedRules.length} of {rules.length} generated rules selected. Saving creates drafts only; nothing is published until you approve and publish the bundle.
            </p>
            <button
              type="button"
              onClick={saveDrafts}
              disabled={state === "saving" || !selectedRules.length}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accord-night px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
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
    <article className={cn("rounded-2xl border bg-white p-4 shadow-sm", selected ? "border-accord-primary/30" : "border-accord-border")}>
      <div className="grid gap-4 xl:grid-cols-[auto_minmax(220px,0.75fr)_minmax(0,1.25fr)] xl:items-start">
        <label className="flex items-center gap-2 text-sm font-semibold text-accord-text xl:pt-8">
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
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1">{rule.sourcePolicyName}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">{rule.sourceSection}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1">{rule.confidence}% confidence</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-[13px] font-semibold text-accord-text">
      {label}
      <input
        className="rounded-xl border border-accord-border bg-white px-3.5 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-accord-primary"
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
    <label className="grid gap-2 text-[13px] font-semibold text-accord-text">
      {label}
      <select
        className="rounded-xl border border-accord-border bg-white px-3.5 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-accord-primary"
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
    <label className="grid gap-2 text-[13px] font-semibold text-accord-text">
      {label}
      <textarea
        className="resize-y rounded-xl border border-accord-border bg-white px-3.5 py-3 text-sm font-medium leading-6 text-slate-700 outline-none transition focus:border-accord-primary"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
