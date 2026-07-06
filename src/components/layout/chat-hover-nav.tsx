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
  { label: "Accord Chat", href: "/chat", icon: MessageSquare },
  { label: "Risk Events", href: "/risk-events", icon: ShieldAlert },
  { label: "Policies", href: "/policies", icon: SlidersHorizontal },
  { label: "Audit Reports", href: "/audit-reports", icon: FileText },
  { label: "API Tokens", href: "/api-tokens", icon: KeyRound },
  { label: "Settings", href: "/settings", icon: Settings }
];

export function ChatHoverNav() {
  const pathname = usePathname();

  return (
    <div className="group fixed left-4 top-4 z-50">
      <Link
        href="/"
        className="inline-flex rounded-xl shadow-accord-glow focus:outline-none focus:ring-2 focus:ring-accord-primary/50"
        aria-label="Open Accord navigation"
      >
        <AccordLogo lockup framed compact />
      </Link>

      <aside className="pointer-events-none absolute left-0 top-12 w-72 translate-y-2 rounded-2xl border border-white/10 bg-accord-night p-3 text-white opacity-0 shadow-accord-glow transition duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <p className="mb-2 px-2 font-mono text-[11px] uppercase tracking-[0.1em] text-slate-500">Workspace nav</p>
        <nav aria-label="Chat mode navigation" className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-white/[0.055] hover:text-white",
                  active &&
                    "bg-gradient-to-r from-accord-primary/18 via-accord-blue/12 to-transparent text-white ring-1 ring-white/10"
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-accord-violet" : "text-slate-500")} aria-hidden="true" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.045] p-3">
          <p className="text-xs font-semibold text-white">Governance mode</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Metadata by default. Redacted previews. Raw content disabled.
          </p>
        </div>
      </aside>
    </div>
  );
}
