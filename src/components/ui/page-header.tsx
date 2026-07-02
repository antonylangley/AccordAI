type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function PageHeader({ eyebrow = "Northstar Financial", title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accord-primary" aria-hidden="true" />
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-accord-muted">
            {eyebrow}
          </p>
        </div>
        <h1 className="mt-2.5 text-[1.9rem] font-semibold leading-tight tracking-[-0.035em] text-accord-text text-balance">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-accord-muted text-pretty">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
