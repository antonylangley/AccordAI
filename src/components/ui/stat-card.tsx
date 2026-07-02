import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
};

export function StatCard({ label, value, detail, icon: Icon }: StatCardProps) {
  const trend = detail.startsWith("+") ? "up" : detail.startsWith("-") ? "down" : "flat";

  return (
    <article className="accord-surface accord-surface-hover group flex flex-col justify-between rounded-md p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-accord-muted">
          {label}
        </p>
        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-accord-hairline bg-accord-mist text-accord-muted transition group-hover:border-accord-primary/30 group-hover:text-accord-primary">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>

      <p className="tnum mt-4 text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-accord-text">
        {value}
      </p>

      <div className="mt-3 flex items-center gap-1.5 border-t border-accord-hairline pt-3">
        {trend === "up" ? (
          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
        ) : trend === "down" ? (
          <ArrowDownRight className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
        ) : null}
        <p
          className={cn(
            "text-xs leading-5",
            trend === "up" ? "font-medium text-emerald-700" : trend === "down" ? "font-medium text-red-700" : "text-accord-muted"
          )}
        >
          {detail}
        </p>
      </div>
    </article>
  );
}
