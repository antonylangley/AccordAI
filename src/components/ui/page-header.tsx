type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function PageHeader({ eyebrow = "Northstar Financial", title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-accord-faint">{eyebrow}</p>
        <h1 className="mt-1.5 text-xl font-semibold tracking-[-0.02em] text-accord-text">{title}</h1>
        {description ? <p className="mt-1 text-[13px] leading-5 text-accord-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
