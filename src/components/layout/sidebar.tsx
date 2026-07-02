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

const navItems = [
  { label: "Overview", href: "/dashboard", icon: BarChart3 },
  { label: "Governed Chat", href: "/chat", icon: MessageSquare },
  { label: "Risk Events", href: "/risk-events", icon: ShieldAlert },
  { label: "Policies", href: "/policies", icon: SlidersHorizontal },
  { label: "Audit Reports", href: "/audit-reports", icon: FileText },
  { label: "API Tokens", href: "/api-tokens", icon: KeyRound },
  { label: "Settings", href: "/settings", icon: Settings }
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-72 shrink-0 border-r border-accord-darkBorder bg-accord-night px-4 py-5 text-white lg:block">
      <Link
        href="/"
        className="mb-7 inline-flex rounded-xl focus:outline-none focus:ring-2 focus:ring-accord-primary/50"
      >
        <AccordLogo lockup framed compact />
      </Link>
      <nav aria-label="Primary navigation" className="space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-white/[0.055] hover:text-white",
                active &&
                  "bg-gradient-to-r from-accord-primary/18 via-accord-blue/12 to-transparent text-white ring-1 ring-white/10"
              )}
            >
              {active ? (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accord-violet" />
              ) : null}
              <Icon className={cn("h-4 w-4", active ? "text-accord-violet" : "text-slate-500 group-hover:text-slate-300")} aria-hidden="true" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-8 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.075] to-white/[0.025] p-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.75)]" />
          <p className="text-sm font-semibold text-white">Governance mode</p>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          Metadata by default, redacted previews for review, raw content disabled.
        </p>
      </div>
    </aside>
  );
}
