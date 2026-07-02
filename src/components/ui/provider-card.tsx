import { CheckCircle2, CircleDashed } from "lucide-react";
import type { ProviderConnection } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function ProviderCard({ provider }: { provider: ProviderConnection }) {
  const connected = provider.status === "connected";
  const pending = provider.status === "pending authorization";

  return (
    <article className="rounded-2xl border border-accord-border bg-white/92 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-accord-text">{provider.name}</h3>
          <p className="mt-2 text-sm leading-6 text-accord-muted">{provider.detail}</p>
        </div>
        <div
          className={cn(
            "rounded-full border p-2",
            connected && "border-emerald-200 bg-emerald-50 text-emerald-600",
            pending && "border-amber-200 bg-amber-50 text-amber-600",
            !connected && !pending && "border-slate-200 bg-slate-50 text-slate-400"
          )}
        >
          {connected ? (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <CircleDashed className="h-4 w-4" aria-hidden="true" />
          )}
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-accord-border/70 pt-4 text-sm">
        <span
          className={cn(
            "font-semibold capitalize",
            connected && "text-emerald-700",
            pending && "text-amber-700",
            !connected && !pending && "text-slate-500"
          )}
        >
          {provider.status}
        </span>
        <span className="font-mono text-xs text-accord-muted">{provider.requests}</span>
      </div>
    </article>
  );
}
