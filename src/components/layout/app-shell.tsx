"use client";

import { usePathname } from "next/navigation";
import { ChatHoverNav } from "./chat-hover-nav";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const chatMode = pathname === "/chat";

  if (chatMode) {
    return (
      <div className="min-h-screen bg-accord-mist">
        <ChatHoverNav />
        <main className="min-h-screen">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-accord-mist">
      <div className="flex">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <TopNav />
          <main className="mx-auto w-full max-w-7xl px-4 py-7 md:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
