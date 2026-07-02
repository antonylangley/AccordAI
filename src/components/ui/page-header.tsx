type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function PageHeader({ eyebrow = "Northstar Financial", title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-accord-primary">{eyebrow}</p>
        <h1 className="mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.035em] text-accord-text">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-accord-muted">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
