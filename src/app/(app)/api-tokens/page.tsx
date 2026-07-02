import { CalendarClock, CheckCircle2, EyeOff, KeyRound, Plus, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

const tokenRows = [
  {
    provider: "OpenAI",
    environment: "Production",
    token: "sk-live...9Qp2",
    owner: "Platform team",
    lastUsed: "12 minutes ago",
    status: "connected"
  },
  {
    provider: "Anthropic",
    environment: "Production",
    token: "ak-ant...41Lm",
    owner: "Legal AI workspace",
    lastUsed: "1 hour ago",
    status: "connected"
  },
  {
    provider: "Internal model",
    environment: "Private endpoint",
    token: "vault...int",
    owner: "Engineering",
    lastUsed: "Yesterday",
    status: "connected"
  },
  {
    provider: "Gemini",
    environment: "Sandbox",
    token: "not configured",
    owner: "Unassigned",
    lastUsed: "Never",
    status: "pending authorization"
  }
];

const securityRules = [
  "Tokens are encrypted at rest and never shown after save.",
  "Provider keys can be scoped by workspace, use case, and sensitivity.",
  "All token creation, rotation, and deletion events are audit logged.",
  "Raw prompt storage is not enabled by adding a provider token."
];

export default function ApiTokensPage() {
  return (
    <div className="space-y-7">
      <PageHeader
        title="API Tokens"
        description="Add and rotate provider credentials for approved model routes. Accord stores keys separately from chat logs and keeps raw content retention disabled by default."
        action={
          <button className="inline-flex items-center gap-2 rounded-xl bg-accord-night px-4 py-2 text-sm font-semibold text-white shadow-accord-glow">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add token
          </button>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <form className="rounded-2xl border border-accord-border bg-white/95 p-5 shadow-accord-panel">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-accord-border bg-[#f1f2ff] p-2 text-accord-primary">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accord-primary">Credential vault</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-accord-text">Add provider token</h2>
              <p className="mt-2 text-sm leading-6 text-accord-muted">
                Use a scoped provider key where possible. Accord will route requests through policy checks before the
                key is used.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="text-sm font-medium text-slate-700">
              Provider
              <select className="mt-2 w-full rounded-xl border border-accord-border bg-accord-mist px-3 py-2.5 text-sm outline-none focus:border-accord-primary">
                <option>OpenAI</option>
                <option>Anthropic</option>
                <option>Gemini</option>
                <option>Internal model</option>
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Token name
              <input
                className="mt-2 w-full rounded-xl border border-accord-border bg-accord-mist px-3 py-2.5 text-sm outline-none focus:border-accord-primary"
                placeholder="Production support gateway"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Secret value
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-accord-border bg-accord-mist px-3 py-2.5">
                <input
                  type="password"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  placeholder="Paste provider API token"
                />
                <EyeOff className="h-4 w-4 text-accord-muted" aria-hidden="true" />
              </div>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Environment
                <select className="mt-2 w-full rounded-xl border border-accord-border bg-accord-mist px-3 py-2.5 text-sm outline-none focus:border-accord-primary">
                  <option>Production</option>
                  <option>Sandbox</option>
                  <option>Private endpoint</option>
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Workspace scope
                <select className="mt-2 w-full rounded-xl border border-accord-border bg-accord-mist px-3 py-2.5 text-sm outline-none focus:border-accord-primary">
                  <option>All approved teams</option>
                  <option>Support only</option>
                  <option>Legal only</option>
                  <option>Engineering only</option>
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-accord-border bg-accord-mist p-4">
              <p className="text-sm font-semibold text-accord-text">Default token controls</p>
              <div className="mt-3 grid gap-2">
                {[
                  "Require policy scan before use",
                  "Store metadata only",
                  "Redact prompt and response previews",
                  "Audit all admin credential actions"
                ].map((label) => (
                  <label key={label} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" defaultChecked className="h-4 w-4 accent-[#625bff]" />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-xl bg-accord-night px-4 py-2 text-sm font-semibold text-white">
                Save token
              </button>
              <button
                type="button"
                className="rounded-xl border border-accord-border bg-white px-4 py-2 text-sm font-semibold text-accord-text"
              >
                Test connection
              </button>
            </div>
          </div>
        </form>

        <div className="space-y-5">
          <section className="rounded-2xl border border-accord-border bg-accord-night p-5 text-white shadow-accord-panel">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-accord-violet" aria-hidden="true" />
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-accord-violet">Security posture</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em]">Keys are separate from review evidence.</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Adding a model token gives Accord a route to a provider. It does not change retention settings or
                  expose raw employee conversations.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {securityRules.map((rule) => (
                <div key={rule} className="rounded-xl border border-white/10 bg-white/[0.055] p-3 text-sm text-slate-300">
                  {rule}
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-accord-border bg-white/95 shadow-accord-panel">
            <div className="border-b border-accord-border bg-accord-mist/70 px-5 py-4">
              <h2 className="text-sm font-semibold text-accord-text">Configured provider tokens</h2>
              <p className="mt-1 text-xs text-accord-muted">Masked credentials, route scope, and recent usage.</p>
            </div>
            <div className="divide-y divide-accord-border">
              {tokenRows.map((row) => (
                <article key={`${row.provider}-${row.environment}`} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-accord-text">{row.provider}</h3>
                      <span className="rounded-full border border-accord-border bg-accord-mist px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-accord-muted">
                        {row.environment}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-accord-muted">{row.token}</p>
                    <p className="mt-1 text-xs text-slate-500">Owner: {row.owner}</p>
                  </div>
                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <span
                      className={
                        row.status === "connected"
                          ? "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
                          : "inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
                      }
                    >
                      {row.status === "connected" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {row.status}
                    </span>
                    <p className="text-xs text-accord-muted">Last used {row.lastUsed}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
