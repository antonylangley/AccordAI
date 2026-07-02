import { CheckCircle2 } from "lucide-react";
import type { PolicyToggleItem } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function PolicyToggle({ item }: { item: PolicyToggleItem }) {
  return (
    <article className="rounded-2xl border border-accord-border bg-white/92 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-accord-text">{item.label}</h3>
          <p className="mt-2 text-sm leading-6 text-accord-muted">{item.description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={item.enabled}
          aria-label={`${item.label} policy toggle`}
          className={cn(
            "relative h-7 w-12 rounded-full border transition",
            item.enabled
              ? "border-accord-primary bg-gradient-to-r from-accord-primary to-accord-blue"
              : "border-slate-300 bg-slate-200"
          )}
        >
          <span
            className={cn(
              "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition",
              item.enabled ? "left-6" : "left-1"
            )}
          />
        </button>
      </div>
      {item.enabled ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Active
        </div>
      ) : (
        <div className="mt-4 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
          Draft
        </div>
      )}
    </article>
  );
}
