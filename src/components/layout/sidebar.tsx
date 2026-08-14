"use client";

import Image from "next/image";
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
      <Link
        href="/"
        className="relative z-10 flex h-[52px] w-14 items-center justify-center bg-white text-accord-text transition-colors duration-200 hover:bg-accord-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accord-primary/35"
        title="Accord home"
        aria-label="Accord home"
      >
        <Image
          src="/brand/accord-emblem-new.png"
          width={576}
          height={410}
          alt=""
          priority
          className="h-7 w-auto object-contain"
        />
      </Link>

      <div className="absolute bottom-0 left-0 top-[52px] w-14 overflow-hidden border-r border-accord-border bg-[#081526] transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/sidebar:w-52 group-focus-within/sidebar:w-52">
        <div className="w-52">
          <nav aria-label="Primary navigation" className="flex w-full flex-col px-1.5 py-3">
            {navGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="flex flex-col gap-0.5">
                {groupIndex > 0 ? <div className="mx-2 my-2 h-px bg-white/10" /> : null}
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
                        "group/nav relative grid h-9 w-full grid-cols-[2.75rem_1fr] items-center rounded-md text-[13px] font-medium text-slate-400 transition-colors duration-200 hover:bg-white/5 hover:text-white",
                        active && "bg-white/[0.07] text-white"
                      )}
                    >
                      {active ? (
                        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[#8B7CFF]" />
                      ) : null}
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center justify-self-center transition-colors duration-200",
                          active ? "text-[#8B7CFF]" : "text-slate-400 group-hover/nav:text-white"
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
