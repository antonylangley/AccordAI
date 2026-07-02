import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
};

export function StatCard({ label, value, detail, icon: Icon }: StatCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-accord-border bg-white/92 p-4 shadow-accord-panel">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-accord-primary/0 via-accord-primary/70 to-accord-blue/0" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-accord-muted">{label}</p>
          <p className="mt-2 text-[2rem] font-semibold leading-none tracking-[-0.03em] text-accord-text">{value}</p>
        </div>
        <div className="rounded-xl border border-accord-border bg-gradient-to-br from-white to-accord-mist p-2 text-accord-primary shadow-sm">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-4 border-t border-accord-border/70 pt-3 text-xs leading-5 text-accord-muted">{detail}</p>
    </article>
  );
}
