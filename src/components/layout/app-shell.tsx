"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChatHoverNav } from "./chat-hover-nav";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";
import { ACCORD_THEME_EVENT, readStoredTheme, type AccordTheme } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const chatMode = pathname === "/chat";
  const [theme, setTheme] = useState<AccordTheme>("light");

  useEffect(() => {
    setTheme(readStoredTheme());
    const onThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<AccordTheme>).detail;
      setTheme(detail === "dark" ? "dark" : "light");
    };
    window.addEventListener(ACCORD_THEME_EVENT, onThemeChange);
    return () => window.removeEventListener(ACCORD_THEME_EVENT, onThemeChange);
  }, []);

  if (chatMode) {
    return (
      <div className="min-h-screen bg-accord-mist">
        <ChatHoverNav />
        <main className="min-h-screen">{children}</main>
      </div>
    );
  }

  return (
    <div className={cn("app-rail-shell min-h-screen bg-accord-panel text-accord-text", theme === "dark" && "dark")}>
      <div className="flex">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <TopNav />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
