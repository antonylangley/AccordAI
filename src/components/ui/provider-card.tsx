import type { ProviderConnection } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function ProviderCard({ provider }: { provider: ProviderConnection }) {
  const connected = provider.status === "connected";
  const pending = provider.status === "pending authorization";

  return (
    <article className="rounded-lg border border-accord-border bg-accord-panel p-4">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-[13px] font-semibold text-accord-text">{provider.name}</h3>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium capitalize",
            connected && "text-emerald-600 dark:text-emerald-400",
            pending && "text-amber-600 dark:text-amber-400",
            !connected && !pending && "text-accord-muted"
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              connected && "bg-emerald-500",
              pending && "bg-amber-500",
              !connected && !pending && "bg-slate-400"
            )}
          />
          {provider.status}
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-accord-muted">{provider.detail}</p>
      <p className="mt-3 border-t border-accord-border/60 pt-2.5 font-mono text-[11px] text-accord-muted">{provider.requests}</p>
    </article>
  );
}
