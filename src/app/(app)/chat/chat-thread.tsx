"use client";

import Image from "next/image";
import { FileSearch, ShieldCheck, Wand2 } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "./types";
import { ChatMessage } from "./chat-message";

type ChatThreadProps = {
  messages: ChatMessageType[];
  onStarterSelect: (prompt: string) => void;
};

const starters = [
  ["Analyze a document", FileSearch],
  ["Rewrite safely", Wand2],
  ["Check for confidential data", ShieldCheck]
];

export function ChatThread({ messages, onStarterSelect }: ChatThreadProps) {
  const empty = messages.length === 0;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_50%_-10%,rgba(98,91,255,0.055),transparent_24rem),linear-gradient(180deg,#fff,#fafbff)] px-4 py-4">
      {empty ? (
        <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center text-center">
          <Image src="/accord-mark.png" alt="" width={48} height={48} className="object-contain" />
          <div className="mt-4 max-w-xl">
            <h2 className="text-2xl font-semibold tracking-[-0.035em] text-accord-text">What do you want to work on?</h2>
            <p className="mt-2 text-sm leading-6 text-accord-muted">
              Accord scans and redacts sensitive data before model routing.
            </p>
          </div>
          <div className="mt-6 grid w-full gap-2 sm:grid-cols-3">
            {starters.map(([label, Icon]) => (
              <button
                key={label as string}
                type="button"
                onClick={() => onStarterSelect(label as string)}
                className="rounded-2xl border border-accord-border bg-white/85 p-3 text-left shadow-sm transition hover:border-accord-primary/30 hover:shadow-accord-panel"
              >
                <Icon className="h-4 w-4 text-accord-primary" aria-hidden="true" />
                <span className="mt-3 block text-sm font-semibold text-accord-text">{label as string}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-4xl space-y-3">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
        </div>
      )}
    </div>
  );
}
