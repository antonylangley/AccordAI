"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, Command, LogOut, Search, Settings, UserRound } from "lucide-react";
import type { AppShellAccount } from "./app-shell";

export function TopNav({ account }: { account: AppShellAccount | null }) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountMenuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountMenuOpen]);

  return (
    <header className="relative z-30 flex h-[52px] shrink-0 items-center border-b border-accord-border bg-accord-panel px-4 md:px-6">
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
        <div className="relative" ref={accountMenuRef}>
          {account ? (
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-accord-night text-[11px] font-semibold text-white ring-offset-2 transition-shadow hover:ring-2 hover:ring-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              aria-label="Open account menu"
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              onClick={() => setAccountMenuOpen((open) => !open)}
            >
              {account.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={account.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                initials(account.displayName)
              )}
            </button>
          ) : (
            <Link
              href="/login"
              className="flex h-8 items-center rounded-md bg-accord-night px-3 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Sign in
            </Link>
          )}

          {account && accountMenuOpen ? (
            <div
              className="absolute right-0 top-10 z-50 w-64 overflow-hidden rounded-lg border border-accord-border bg-white shadow-[0_14px_35px_rgba(15,23,42,0.14)]"
              role="menu"
              aria-label="Account"
            >
              <div className="border-b border-accord-border px-4 py-3">
                <p className="truncate text-sm font-semibold text-accord-text">{account.displayName}</p>
                <p className="mt-0.5 truncate text-xs text-accord-muted">{account.email}</p>
              </div>
              <div className="p-1.5">
                <MenuLink href="/account" icon={<UserRound className="h-4 w-4" aria-hidden="true" />} onSelect={() => setAccountMenuOpen(false)}>
                  Profile
                </MenuLink>
                <MenuLink href="/settings" icon={<Settings className="h-4 w-4" aria-hidden="true" />} onSelect={() => setAccountMenuOpen(false)}>
                  Workspace settings
                </MenuLink>
              </div>
              <form action="/auth/logout" method="post" className="border-t border-accord-border p-1.5">
                <button
                  type="submit"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-accord-muted transition-colors hover:bg-accord-surface hover:text-accord-text focus:outline-none focus-visible:bg-accord-surface"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function MenuLink({
  href,
  icon,
  onSelect,
  children
}: {
  href: string;
  icon: React.ReactNode;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onSelect}
      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-accord-muted transition-colors hover:bg-accord-surface hover:text-accord-text focus:outline-none focus-visible:bg-accord-surface"
    >
      {icon}
      {children}
    </Link>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";
}
