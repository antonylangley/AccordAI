import { Plus } from "lucide-react";
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
    status: "pending"
  }
];

const securityRules = [
  "Tokens are encrypted at rest and never shown after save.",
  "Provider keys can be scoped by workspace, use case, and sensitivity.",
  "All token creation, rotation, and deletion events are audit logged.",
  "Raw prompt storage is not enabled by adding a provider token."
];

const inputClass =
  "mt-1.5 h-8 w-full rounded-md border border-accord-border bg-accord-panel px-2.5 text-[13px] text-accord-text outline-none transition-colors placeholder:text-accord-faint focus:border-accord-primary";

export default function ApiTokensPage() {
  return (
    <div className="app-geist space-y-6">
      <PageHeader
        title="API Tokens"
        description="Provider credentials for approved model routes — stored separately from chat logs"
        action={
          <button className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accord-night px-3 text-[13px] font-medium text-white transition-colors hover:bg-accord-navy dark:bg-accord-primary dark:hover:bg-accord-blue">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add token
          </button>
        }
      />

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
        <form className="rounded-lg border border-accord-border bg-accord-panel">
          <div className="border-b border-accord-border px-4 py-3">
            <h2 className="text-sm font-semibold text-accord-text">Add provider token</h2>
            <p className="mt-0.5 text-xs text-accord-muted">Requests route through policy checks before the key is used</p>
          </div>

          <div className="grid gap-3.5 px-4 py-4">
            <label className="text-xs font-medium text-accord-text">
              Provider
              <select className={inputClass}>
                <option>OpenAI</option>
                <option>Anthropic</option>
                <option>Gemini</option>
                <option>Internal model</option>
              </select>
            </label>

            <label className="text-xs font-medium text-accord-text">
              Token name
              <input className={inputClass} placeholder="Production support gateway" />
            </label>

            <label className="text-xs font-medium text-accord-text">
              Secret value
              <input type="password" className={inputClass} placeholder="Paste provider API token" />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-accord-text">
                Environment
                <select className={inputClass}>
                  <option>Production</option>
                  <option>Sandbox</option>
                  <option>Private endpoint</option>
                </select>
              </label>
              <label className="text-xs font-medium text-accord-text">
                Workspace scope
                <select className={inputClass}>
                  <option>All approved teams</option>
                  <option>Support only</option>
                  <option>Legal only</option>
                  <option>Engineering only</option>
                </select>
              </label>
            </div>

            <div className="rounded-md border border-accord-border bg-accord-surface/60 p-3">
              <p className="text-xs font-medium text-accord-text">Default token controls</p>
              <div className="mt-2 grid gap-1.5">
                {[
                  "Require policy scan before use",
                  "Store metadata only",
                  "Redact prompt and response previews",
                  "Audit all admin credential actions"
                ].map((label) => (
                  <label key={label} className="flex items-center gap-2 text-[13px] text-accord-muted">
                    <input type="checkbox" defaultChecked className="h-3.5 w-3.5 accent-[#625bff]" />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-md bg-accord-night px-3 text-[13px] font-medium text-white transition-colors hover:bg-accord-navy dark:bg-accord-primary dark:hover:bg-accord-blue"
              >
                Save token
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-md border border-accord-border bg-accord-panel px-3 text-[13px] font-medium text-accord-text transition-colors hover:border-accord-faint"
              >
                Test connection
              </button>
            </div>
          </div>
        </form>

        <div className="space-y-4">
          <section className="overflow-hidden rounded-lg border border-accord-border bg-accord-panel">
            <div className="border-b border-accord-border px-4 py-3">
              <h2 className="text-sm font-semibold text-accord-text">Configured provider tokens</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead className="border-b border-accord-border text-[11px] uppercase tracking-[0.06em] text-accord-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Provider</th>
                    <th scope="col" className="px-3 py-2 font-medium">Environment</th>
                    <th scope="col" className="px-3 py-2 font-medium">Token</th>
                    <th scope="col" className="px-3 py-2 font-medium">Owner</th>
                    <th scope="col" className="px-3 py-2 font-medium">Last used</th>
                    <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-accord-border/60">
                  {tokenRows.map((row) => (
                    <tr key={`${row.provider}-${row.environment}`}>
                      <td className="px-3 py-3 font-medium text-accord-text">{row.provider}</td>
                      <td className="px-3 py-3 text-accord-muted">{row.environment}</td>
                      <td className="px-3 py-3 font-mono text-xs text-accord-muted">{row.token}</td>
                      <td className="px-3 py-3 text-accord-muted">{row.owner}</td>
                      <td className="px-3 py-3 text-accord-muted">{row.lastUsed}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accord-text">
                          <span className={`h-1.5 w-1.5 rounded-full ${row.status === "connected" ? "bg-emerald-500" : "bg-amber-500"}`} />
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-accord-border bg-accord-panel">
            <div className="border-b border-accord-border px-4 py-3">
              <h2 className="text-sm font-semibold text-accord-text">Security posture</h2>
              <p className="mt-0.5 text-xs text-accord-muted">
                A model token gives Accord a route to a provider — it does not change retention or expose raw conversations
              </p>
            </div>
            <div className="divide-y divide-accord-border/60 px-4">
              {securityRules.map((rule) => (
                <div key={rule} className="flex items-center gap-2 py-2.5 text-[13px] text-accord-text">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  {rule}
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
