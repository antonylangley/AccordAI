import type { ReactNode } from "react";

type ChartCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function ChartCard({ title, description, children }: ChartCardProps) {
  return (
    <section className="rounded-lg border border-accord-border bg-accord-panel">
      <div className="border-b border-accord-border px-4 py-3">
        <h2 className="text-[15px] font-semibold text-accord-text">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-accord-muted">{description}</p> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
