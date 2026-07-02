import type { ReactNode } from "react";

type ChartCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function ChartCard({ title, description, children }: ChartCardProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-accord-border bg-white/92 shadow-accord-panel">
      <div className="border-b border-accord-border/80 bg-gradient-to-b from-white to-accord-mist/60 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-accord-text">{title}</h2>
            {description ? <p className="mt-1 text-xs leading-5 text-accord-muted">{description}</p> : null}
          </div>
          <span className="mt-1 h-2 w-2 rounded-full bg-accord-primary shadow-[0_0_18px_rgba(98,91,255,0.45)]" />
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
