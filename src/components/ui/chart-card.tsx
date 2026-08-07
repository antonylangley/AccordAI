import type { ReactNode } from "react";

type ChartCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function ChartCard({ title, description, children }: ChartCardProps) {
  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-accord-border bg-white shadow-accord-panel">
      <div className="border-b border-accord-border/80 bg-gradient-to-br from-white via-white to-[#f3f4ff] px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.025em] text-accord-text">{title}</h2>
            {description ? <p className="mt-1.5 text-sm leading-6 text-accord-muted">{description}</p> : null}
          </div>
          <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accord-primary shadow-[0_0_22px_rgba(98,91,255,0.55)]" />
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}
