"use client";

import { Pin, Plus, Search, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Conversation } from "./types";

type ChatHistorySidebarProps = {
  conversations: Conversation[];
  selectedId: string;
  open: boolean;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onClose: () => void;
};

const groups: Conversation["group"][] = ["Pinned", "Today", "Previous 7 days", "Older"];

export function ChatHistorySidebar({
  conversations,
  selectedId,
  open,
  onSelect,
  onNewChat,
  onClose
}: ChatHistorySidebarProps) {
  return (
    <aside
      className={cn(
        "fixed bottom-4 left-4 top-[4.8rem] z-40 flex w-[18rem] flex-col overflow-hidden rounded-2xl border border-accord-border bg-white/95 shadow-accord-panel backdrop-blur-xl transition duration-150",
        open ? "pointer-events-auto translate-x-0 opacity-100" : "pointer-events-none -translate-x-3 opacity-0"
      )}
      aria-hidden={!open}
    >
      <div className="border-b border-accord-border p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-accord-night px-3 py-2.5 text-sm font-semibold text-white shadow-accord-glow transition hover:bg-accord-elevated"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New chat
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-accord-border bg-white p-2.5 text-accord-muted transition hover:text-accord-text"
            aria-label="Close conversations"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <label className="mt-3 flex items-center gap-2 rounded-xl border border-accord-border bg-accord-mist px-3 py-2 text-xs text-accord-muted">
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">Search conversations</span>
          <input
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
            placeholder="Search conversations"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {groups.map((group) => {
          const items = conversations.filter((conversation) => conversation.group === group);
          if (!items.length) return null;

          return (
            <section key={group} className="mb-5">
              <h2 className="mb-2 px-2 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-accord-muted">
                {group}
              </h2>
              <div className="space-y-1">
                {items.map((conversation) => {
                  const active = conversation.id === selectedId;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => {
                        onSelect(conversation.id);
                        onClose();
                      }}
                      className={cn(
                        "group flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition",
                        active
                          ? "bg-[#f1f2ff] text-accord-text ring-1 ring-accord-primary/15"
                          : "text-slate-600 hover:bg-accord-mist hover:text-accord-text"
                      )}
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accord-border bg-white">
                        {conversation.pinned ? (
                          <Pin className="h-3 w-3 text-accord-primary" aria-hidden="true" />
                        ) : conversation.risk === "clean" ? (
                          <ShieldCheck className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                        ) : (
                          <ShieldAlert className="h-3 w-3 text-orange-600" aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{conversation.title}</span>
                      {conversation.risk !== "clean" ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" aria-label="Risk indicator" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}
