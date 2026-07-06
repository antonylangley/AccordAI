"use client";

import { CheckCircle2, Sparkles, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "./types";

export function ChatMessage({ message }: { message: ChatMessageType }) {
  if (message.role === "system") {
    return (
      <div className="mx-auto flex max-w-xl items-center justify-center gap-1.5 rounded-full border border-accord-border bg-white/75 px-2.5 py-1 text-[11px] text-accord-muted shadow-sm">
        <CheckCircle2 className="h-3 w-3 text-emerald-600" aria-hidden="true" />
        {message.content}
      </div>
    );
  }

  return (
    <div className={cn("flex gap-2.5", message.role === "user" ? "justify-end" : "justify-start")}>
      {message.role === "assistant" ? (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accord-night text-white shadow-accord-glow">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
      ) : null}
      <article
        className={cn(
          "max-w-[min(720px,82%)] rounded-2xl border px-3.5 py-2.5 text-sm leading-6",
          message.role === "user"
            ? "border-accord-primary/20 bg-[#f1f2ff] text-accord-text"
            : "border-accord-border bg-white text-slate-700 shadow-sm"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.meta ? (
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-accord-muted">{message.meta}</p>
        ) : null}
      </article>
      {message.role === "user" ? (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accord-primary to-accord-blue text-white shadow-accord-glow">
          <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
      ) : null}
    </div>
  );
}
