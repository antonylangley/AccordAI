"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileText,
  KeyRound,
  MessageSquare,
  Settings,
  ShieldAlert,
  SlidersHorizontal
} from "lucide-react";
import { AccordLogo } from "@/components/ui/accord-logo";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "Monitor",
    items: [
      { label: "Overview", href: "/dashboard", icon: BarChart3 },
      { label: "Governed Chat", href: "/chat", icon: MessageSquare },
      { label: "Risk Events", href: "/risk-events", icon: ShieldAlert }
    ]
  },
  {
    label: "Govern",
    items: [
      { label: "Policies", href: "/policies", icon: SlidersHorizontal },
      { label: "Audit Reports", href: "/audit-reports", icon: FileText },
      { label: "API Tokens", href: "/api-tokens", icon: KeyRound },
      { label: "Settings", href: "/settings", icon: Settings }
    ]
  }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-64 shrink-0 flex-col border-r border-accord-darkBorder bg-gradient-to-b from-accord-ink to-accord-night px-3.5 py-5 text-white lg:flex">
      <Link
        href="/"
        className="mb-8 inline-flex rounded-xl focus:outline-none focus:ring-2 focus:ring-accord-primary/50"
      >
        <AccordLogo lockup framed compact />
      </Link>

      <nav aria-label="Primary navigation" className="flex-1 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-2 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-white/[0.06] font-medium text-white"
                        : "text-slate-400 hover:bg-white/[0.035] hover:text-slate-200"
                    )}
                  >
                    {active ? (
                      <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-accord-violet to-accord-primary" />
                    ) : null}
                    <Icon
                      className={cn(
                        "h-4 w-4 transition-colors",
                        active ? "text-accord-violet" : "text-slate-500 group-hover:text-slate-300"
                      )}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <p className="text-[13px] font-semibold text-white">Governance mode</p>
        </div>
        <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
          Metadata by default, redacted previews for review, raw content disabled.
        </p>
      </div>
    </aside>
  );
}
