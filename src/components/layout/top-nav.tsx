import Link from "next/link";
import { Bell, ChevronDown, Command, Search } from "lucide-react";

export function TopNav() {
  return (
    <header className="sticky top-0 z-30 flex h-[52px] items-center border-b border-accord-border bg-accord-panel px-4 md:px-6">
      <div className="flex w-full items-center justify-between gap-3">
        <div className="rail-follow flex min-w-0 flex-1 items-center">
          <label className="sr-only" htmlFor="command-search">
            Search Accord
          </label>
          <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-accord-border bg-accord-panel px-2.5 text-accord-muted transition-colors focus-within:border-slate-300 md:max-w-xs">
            <Search className="h-3.5 w-3.5 shrink-0 text-accord-faint" aria-hidden="true" />
            <input
              id="command-search"
              placeholder="Search policies, events, reports…"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-accord-faint"
            />
            <span className="hidden items-center gap-0.5 rounded border border-accord-border px-1 py-px font-mono text-[10px] text-accord-faint sm:flex">
              <Command className="h-2.5 w-2.5" aria-hidden="true" />K
            </span>
          </div>
        </div>
        <Link
          href="/settings"
          className="hidden h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-accord-text transition-colors hover:bg-accord-surface md:flex"
          aria-label="Current workspace settings"
        >
          Workspace
          <ChevronDown className="h-3.5 w-3.5 text-accord-faint" aria-hidden="true" />
        </Link>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md text-accord-muted transition-colors hover:bg-accord-surface hover:text-accord-text"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
        </button>
        <Link
          href="/login"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-accord-night text-[11px] font-semibold text-white"
          aria-label="Sign in or manage account"
        >
          A
        </Link>
      </div>
    </header>
  );
}
