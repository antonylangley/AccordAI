import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  icon?: LucideIcon;
};

export function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <article className="rounded-lg border border-accord-border bg-accord-panel p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-accord-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold leading-none tracking-[-0.02em] text-accord-text [font-variant-numeric:tabular-nums]">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-accord-muted">{detail}</p>
    </article>
  );
}
