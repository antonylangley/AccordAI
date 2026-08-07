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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="group/sidebar sticky top-3 z-40 hidden h-fit w-20 shrink-0 self-start overflow-visible bg-transparent py-3 lg:block">
      <div className="ml-3 w-14 transform-gpu overflow-hidden rounded-[1.6rem] border border-accord-border/90 bg-white/90 shadow-accord-panel backdrop-blur-xl will-change-[width] transition-[width,background-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/sidebar:w-44 group-hover/sidebar:bg-white/95 group-focus-within/sidebar:w-44 group-focus-within/sidebar:bg-white/95">
        <div className="w-44 p-1.5">
          <Link
            href="/"
            className="mb-4 grid h-11 w-full grid-cols-[2.75rem_1fr] items-center rounded-2xl text-accord-text transition-colors duration-200 hover:bg-accord-mist focus:outline-none focus:ring-2 focus:ring-accord-primary/30"
            title="Accord home"
          >
            <AccordLogo markOnly tone="light" className="justify-self-center" />
            <span className="whitespace-nowrap text-lg font-semibold tracking-[-0.03em] opacity-0 transition-opacity delay-100 duration-150 ease-out group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
              Accord
            </span>
          </Link>
          <nav aria-label="Primary navigation" className="flex w-full flex-col gap-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group/nav relative grid h-11 w-full grid-cols-[2.75rem_1fr] items-center rounded-2xl text-sm font-medium text-slate-500 transition-colors duration-200 hover:bg-accord-mist hover:text-accord-text",
                    active && "bg-[#f1f2ff] text-accord-text shadow-sm ring-1 ring-accord-primary/15"
                  )}
                >
                  {active ? (
                    <span className="absolute left-1.5 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accord-primary opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100" />
                  ) : null}
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center justify-self-center rounded-xl transition-colors duration-200",
                      active ? "text-accord-primary" : "text-slate-500 group-hover/nav:text-accord-primary"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="whitespace-nowrap opacity-0 transition-opacity delay-100 duration-150 ease-out group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </aside>
  );
}
