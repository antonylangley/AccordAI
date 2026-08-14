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
    document.documentElement.classList.add("accord-app-viewport");
    document.body.classList.add("accord-app-viewport");
    setTheme(readStoredTheme());
    const onThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<AccordTheme>).detail;
      setTheme(detail === "dark" ? "dark" : "light");
    };
    window.addEventListener(ACCORD_THEME_EVENT, onThemeChange);
    return () => {
      window.removeEventListener(ACCORD_THEME_EVENT, onThemeChange);
      document.documentElement.classList.remove("accord-app-viewport");
      document.body.classList.remove("accord-app-viewport");
    };
  }, []);

  if (chatMode) {
    return (
      <div className="h-dvh overflow-hidden bg-accord-mist overscroll-none">
        <ChatHoverNav />
        <main className="h-full min-h-0 overflow-hidden">{children}</main>
      </div>
    );
  }

  return (
    <div className={cn("app-rail-shell h-dvh overflow-hidden bg-accord-panel text-accord-text overscroll-none", theme === "dark" && "dark")}>
      <div className="flex h-full min-h-0">
        <Sidebar />
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <TopNav />
          <main className="app-content-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-none">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:px-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
