const counts: Array<[string, string]> = [
  ["Draft", "2"],
  ["Pending", "1"],
  ["Published", "7"]
];

const rules: Array<{ name: string; ruleKey: string }> = [
  {
    name: "Redact client identifying information before external AI use",
    ruleKey: "redact_client_identifying_information"
  },
  {
    name: "Do not submit secrets and credentials to unapproved AI",
    ruleKey: "do_not_submit_secrets_and_credentials"
  },
  {
    name: "Require approval for confidential data in AI workflows",
    ruleKey: "require_approval_for_confidential_data"
  }
];

export function PoliciesPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of the Accord policy authoring screen showing the current Guard bundle and published rules"
      className="select-none overflow-hidden rounded-lg border border-accord-border bg-accord-panel text-left"
    >
      {/* Bundle header */}
      <div className="flex items-center justify-between gap-3 border-b border-accord-border px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-accord-text">Current Guard bundle · v12</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-accord-muted">
            <span className="h-1 w-1 rounded-full bg-emerald-500" />
            Deployed to Accord Guard
          </p>
        </div>
        <span className="inline-flex h-7 items-center rounded-md bg-accord-night px-2.5 text-[11px] font-medium text-white">
          Publish bundle
        </span>
      </div>

      {/* Count strip */}
      <div className="grid grid-cols-3 divide-x divide-accord-border border-b border-accord-border">
        {counts.map(([label, value]) => (
          <div key={label} className="px-4 py-2.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.06em] text-accord-muted">{label}</p>
            <p className="mt-0.5 text-base font-semibold leading-none text-accord-text [font-variant-numeric:tabular-nums]">{value}</p>
          </div>
        ))}
      </div>

      {/* Rule rows */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-accord-text">Published rules</p>
          <span className="font-mono text-[10px] text-accord-muted">7</span>
        </div>
        <div className="mt-1 divide-y divide-accord-border/60">
          {rules.map((rule) => (
            <div key={rule.ruleKey} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-accord-text">{rule.name}</p>
                <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">{rule.ruleKey}</p>
              </div>
              <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                <MiniTag tone="green">approved</MiniTag>
                <MiniTag>v1</MiniTag>
                <MiniTag tone="indigo">bundle v12</MiniTag>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniTag({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "green" | "indigo" }) {
  const tones = {
    default: "border-accord-border text-slate-500",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    indigo: "border-accord-primary/25 bg-accord-tint text-accord-primary"
  } as const;
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${tones[tone]}`}>{children}</span>
  );
}
