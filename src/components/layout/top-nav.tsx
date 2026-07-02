import { Bell, ChevronDown, Command, Search } from "lucide-react";

export function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-accord-border bg-white/80 px-4 py-2.5 backdrop-blur-xl md:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <label className="sr-only" htmlFor="command-search">
            Search Accord
          </label>
          <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-accord-border bg-accord-mist/60 px-3 text-accord-muted transition focus-within:border-accord-primary/40 focus-within:bg-white md:max-w-md">
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <input
              id="command-search"
              placeholder="Search policies, events, reports..."
              className="min-w-0 flex-1 bg-transparent text-sm text-accord-text outline-none placeholder:text-slate-400"
            />
            <span className="hidden items-center gap-0.5 rounded border border-accord-border bg-white px-1.5 py-0.5 font-mono text-[10.5px] text-slate-400 sm:flex">
              <Command className="h-3 w-3" aria-hidden="true" />K
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="hidden h-9 items-center gap-2 rounded-lg border border-accord-border bg-white px-3 text-sm font-medium text-accord-text transition hover:border-accord-primary/30 md:flex"
            aria-label="Current tenant Northstar Financial"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-accord-primary to-accord-blue text-[10px] font-semibold text-white">
              N
            </span>
            Northstar Financial
            <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
          </button>

          <span className="hidden h-6 w-px bg-accord-border md:block" aria-hidden="true" />

          <button
            type="button"
            className="relative rounded-lg border border-accord-border bg-white p-2 text-accord-muted transition hover:border-accord-primary/30 hover:text-accord-text"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accord-primary" />
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accord-primary to-accord-blue text-xs font-semibold text-white shadow-accord-glow"
            aria-label="User menu"
          >
            NF
          </button>
        </div>
      </div>
    </header>
  );
}
