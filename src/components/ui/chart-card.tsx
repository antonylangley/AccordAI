import type { ReactNode } from "react";

type ChartCardProps = {
  title: string;
  description?: string;
  meta?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function ChartCard({ title, description, meta, action, children }: ChartCardProps) {
  return (
    <section className="accord-surface flex flex-col overflow-hidden rounded-md">
      <header className="flex items-start justify-between gap-4 border-b border-accord-hairline px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-[-0.01em] text-accord-text">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-5 text-accord-muted">{description}</p> : null}
        </div>
        {action ? (
          <div className="shrink-0">{action}</div>
        ) : meta ? (
          <span className="shrink-0 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-accord-muted">
            {meta}
          </span>
        ) : null}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
