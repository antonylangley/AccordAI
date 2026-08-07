import Link from "next/link";
import { Bell, ChevronDown, Command, Search } from "lucide-react";

export function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-accord-border/80 bg-white/72 px-4 py-2.5 backdrop-blur-xl md:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <label className="sr-only" htmlFor="command-search">
            Search Accord
          </label>
          <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-accord-border bg-white/80 px-3 text-accord-muted shadow-sm md:max-w-sm">
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <input
              id="command-search"
              placeholder="Search policies, events, reports..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
            <span className="hidden items-center gap-1 rounded-md border border-accord-border bg-accord-mist px-1.5 py-0.5 text-[11px] text-slate-400 sm:flex">
              <Command className="h-3 w-3" aria-hidden="true" />K
            </span>
          </div>
        </div>
        <Link
          href="/settings"
          className="hidden h-9 items-center gap-2 rounded-xl border border-accord-border bg-white/80 px-3 text-sm font-medium text-accord-text shadow-sm md:flex"
          aria-label="Current workspace settings"
        >
          Workspace
          <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
        </Link>
        <button
          type="button"
          className="rounded-xl border border-accord-border bg-white/80 p-2 text-accord-muted shadow-sm"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
        </button>
        <Link
          href="/login"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accord-primary to-accord-blue text-xs font-semibold text-white shadow-accord-glow"
          aria-label="Sign in or manage account"
        >
          A
        </Link>
      </div>
    </header>
  );
}
