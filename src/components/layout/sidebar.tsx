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
  [
    { label: "Overview", href: "/dashboard", icon: BarChart3 },
    { label: "Policies", href: "/policies", icon: SlidersHorizontal },
    { label: "Audit Reports", href: "/audit-reports", icon: FileText },
    { label: "Risk Events", href: "/risk-events", icon: ShieldAlert }
  ],
  [{ label: "Accord Chat", href: "/chat", icon: MessageSquare }],
  [
    { label: "API Tokens", href: "/api-tokens", icon: KeyRound },
    { label: "Settings", href: "/settings", icon: Settings }
  ]
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="group/sidebar sticky top-0 z-40 hidden h-screen w-14 shrink-0 lg:block">
      <div className="absolute inset-y-0 left-0 w-14 overflow-hidden border-r border-accord-border bg-accord-panel transition-[width,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/sidebar:w-52 group-hover/sidebar:shadow-[8px_0_24px_rgba(7,18,37,0.06)] group-focus-within/sidebar:w-52 group-focus-within/sidebar:shadow-[8px_0_24px_rgba(7,18,37,0.06)]">
        <div className="w-52">
          <Link
            href="/"
            className="grid h-[52px] w-full grid-cols-[3.5rem_1fr] items-center border-b border-accord-border text-accord-text transition-colors duration-200 hover:bg-accord-surface/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-accord-primary/30"
            title="Accord home"
          >
            <AccordLogo markOnly tone="light" className="justify-self-center" />
            <span className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.02em] opacity-0 transition-opacity delay-100 duration-150 ease-out group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
              Accord
            </span>
          </Link>

          <nav aria-label="Primary navigation" className="flex w-full flex-col px-1.5 py-3">
            {navGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="flex flex-col gap-0.5">
                {groupIndex > 0 ? <div className="mx-2 my-2 h-px bg-accord-border" /> : null}
                {group.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group/nav relative grid h-9 w-full grid-cols-[2.75rem_1fr] items-center rounded-md text-[13px] font-medium text-accord-muted transition-colors duration-200 hover:bg-accord-surface hover:text-accord-text",
                        active && "bg-accord-surface text-accord-text"
                      )}
                    >
                      {active ? (
                        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accord-primary" />
                      ) : null}
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center justify-self-center transition-colors duration-200",
                          active ? "text-accord-primary" : "text-accord-muted group-hover/nav:text-accord-text"
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
              </div>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}
