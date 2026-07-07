"use client";

import { useEffect, useMemo, useState } from "react";
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

  const isAssistant = message.role === "assistant";
  const typing = isAssistant && message.status === "typing";
  const thinking = isAssistant && message.status === "thinking";

  return (
    <div className={cn("chat-message-enter flex gap-2.5", message.role === "user" ? "justify-end" : "justify-start")}>
      {isAssistant ? (
        <div
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accord-night text-white shadow-accord-glow",
            thinking && "chat-thinking-orb"
          )}
        >
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
        {thinking ? <ThinkingMessage /> : <TypedMessage content={message.content} enabled={typing} />}
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

function TypedMessage({ content, enabled }: { content: string; enabled: boolean }) {
  const [visibleLength, setVisibleLength] = useState(enabled ? 0 : content.length);
  const done = visibleLength >= content.length;

  useEffect(() => {
    if (!enabled) {
      setVisibleLength(content.length);
      return;
    }

    setVisibleLength(0);
  }, [content, enabled]);

  useEffect(() => {
    if (!enabled || visibleLength >= content.length) return;

    const remaining = content.length - visibleLength;
    const chunk = remaining > 240 ? 9 : remaining > 120 ? 7 : remaining > 48 ? 5 : 3;
    const timer = window.setTimeout(() => {
      setVisibleLength((current) => Math.min(content.length, current + chunk));
    }, 22);

    return () => window.clearTimeout(timer);
  }, [content, enabled, visibleLength]);

  return (
    <p className="whitespace-pre-wrap">
      {content.slice(0, visibleLength)}
      {enabled && !done ? <span className="chat-type-caret" aria-hidden="true" /> : null}
    </p>
  );
}

function ThinkingMessage() {
  const steps = useMemo(
    () => ["Scanning policy", "Redacting preview", "Routing securely", "Drafting response"],
    []
  );
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setStep((current) => (current + 1) % steps.length);
    }, 900);

    return () => window.clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="min-w-[15rem]">
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-accord-text">{steps[step]}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f2ff] px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-accord-primary">
          Live
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="chat-loading-dot h-2 w-2 rounded-full bg-accord-primary"
            style={{ animationDelay: `${dot * 140}ms` }}
          />
        ))}
        <div className="ml-2 h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef2ff]">
          <div className="chat-loading-bar h-full rounded-full bg-gradient-to-r from-accord-primary to-accord-blue" />
        </div>
      </div>
    </div>
  );
}
