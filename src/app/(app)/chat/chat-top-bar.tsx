"use client";

import Image from "next/image";
import {
  ChevronDown,
  MessageSquareText,
  Settings,
  ShieldCheck,
  SlidersHorizontal
} from "lucide-react";
import { getModelOptions, providerLabel } from "@/lib/chat/model-registry";
import { cn } from "@/lib/utils";
import { ThinkingToggle } from "./thinking-toggle";
import type { ToolOption } from "./types";

type ChatTopBarProps = {
  title: string;
  model: string;
  useCase: string;
  sensitivity: string;
  thinkingMode: boolean;
  toolsOpen: boolean;
  selectedToolIds: string[];
  toolOptions: ToolOption[];
  governanceCollapsed: boolean;
  providerStatusLabel: string;
  onOpenHistory: () => void;
  onModelChange: (value: string) => void;
  onUseCaseChange: (value: string) => void;
  onSensitivityChange: (value: string) => void;
  onThinkingChange: (value: boolean) => void;
  onToolsOpenChange: (open: boolean) => void;
  onToggleTool: (id: string) => void;
  onToggleGovernance: () => void;
};

const modelOptions = getModelOptions();
const useCaseOptions = ["General", "Customer Support", "Legal Draft", "HR", "Code", "Research"];
const sensitivityOptions = ["Public", "Internal", "Confidential", "Regulated"];

export function ChatTopBar({
  title,
  model,
  useCase,
  sensitivity,
  thinkingMode,
  toolsOpen,
  selectedToolIds,
  toolOptions,
  governanceCollapsed,
  providerStatusLabel,
  onOpenHistory,
  onModelChange,
  onUseCaseChange,
  onSensitivityChange,
  onThinkingChange,
  onToolsOpenChange,
  onToggleTool,
  onToggleGovernance
}: ChatTopBarProps) {
  const selectedModel = modelOptions.find((option) => option.label === model) || modelOptions[0];

  return (
    <header className="relative z-30 shrink-0 border-b border-accord-border bg-white/90 px-3 py-2.5 pl-[8.8rem] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenHistory}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-accord-border bg-white px-2.5 text-xs font-medium text-accord-text shadow-sm transition hover:border-accord-primary/30"
          >
            <MessageSquareText className="h-4 w-4" aria-hidden="true" />
            Chats
          </button>
          <Image
            src="/brand/accord-emblem-new.png"
            alt=""
            width={576}
            height={410}
            className="h-6 w-auto shrink-0 object-contain"
          />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accord-primary">Accord Chat</div>
            <h1 className="truncate text-sm font-semibold tracking-[-0.015em] text-accord-text">{title}</h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <select
            value={model}
            onChange={(event) => onModelChange(event.target.value)}
            className="h-8 max-w-[11rem] rounded-full border border-accord-border bg-white px-2.5 text-xs font-semibold text-accord-text outline-none focus:border-accord-primary"
            aria-label="Model"
          >
            {modelOptions.map((option) => (
              <option key={option.id} value={option.label}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onToggleGovernance}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border border-[#dfe4ff] bg-[#f6f7ff] px-2.5 text-xs font-semibold text-accord-primary transition hover:border-accord-primary/30",
              !governanceCollapsed && "ring-2 ring-accord-primary/10"
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Governance active
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => onToolsOpenChange(!toolsOpen)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-accord-border bg-white px-2.5 text-xs font-semibold text-accord-text shadow-sm transition hover:border-accord-primary/30"
              aria-expanded={toolsOpen}
            >
              <Settings className="h-3.5 w-3.5" aria-hidden="true" />
              Settings
              <ChevronDown className="h-3.5 w-3.5 text-accord-muted" aria-hidden="true" />
            </button>

            {toolsOpen ? (
              <div className="absolute right-0 top-10 z-50 max-h-[calc(100vh-6rem)] w-[22rem] overflow-y-auto rounded-2xl border border-accord-border bg-white p-3 text-sm shadow-accord-panel">
                <div className="mb-3 flex items-center justify-between gap-3 border-b border-accord-border pb-3">
                  <div>
                    <p className="text-xs font-semibold text-accord-text">{selectedModel.label}</p>
                    <p className="mt-0.5 text-[11px] text-accord-muted">{providerLabel(selectedModel.provider)} route</p>
                  </div>
                  <span className="rounded-full bg-accord-mist px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-accord-muted">
                    {providerStatusLabel}
                  </span>
                </div>

                <div className="grid gap-2">
                  <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-accord-muted">
                    Use case
                    <select
                      value={useCase}
                      onChange={(event) => onUseCaseChange(event.target.value)}
                      className="h-9 rounded-xl border border-accord-border bg-white px-3 text-sm font-medium normal-case tracking-normal text-accord-text outline-none focus:border-accord-primary"
                    >
                      {useCaseOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-accord-muted">
                    Sensitivity
                    <select
                      value={sensitivity}
                      onChange={(event) => onSensitivityChange(event.target.value)}
                      className="h-9 rounded-xl border border-accord-border bg-white px-3 text-sm font-medium normal-case tracking-normal text-accord-text outline-none focus:border-accord-primary"
                    >
                      {sensitivityOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>

                  <div className="flex items-center justify-between rounded-xl border border-accord-border bg-accord-mist px-3 py-2">
                    <div>
                      <p className="text-xs font-semibold text-accord-text">Thinking mode</p>
                      <p className="mt-0.5 text-[11px] text-accord-muted">Adds a deeper policy-aware pass.</p>
                    </div>
                    <ThinkingToggle enabled={thinkingMode} onChange={onThinkingChange} compact />
                  </div>

                  <div className="rounded-xl border border-accord-border bg-white p-2">
                    <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold text-accord-text">
                      <SlidersHorizontal className="h-3.5 w-3.5 text-accord-primary" aria-hidden="true" />
                      Tools
                    </div>
                    <div className="grid gap-1">
                      {toolOptions.map((tool) => {
                        const Icon = tool.icon;
                        const selected = selectedToolIds.includes(tool.id);
                        return (
                          <button
                            key={tool.id}
                            type="button"
                            disabled={!tool.enabled}
                            onClick={() => onToggleTool(tool.id)}
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition",
                              tool.enabled ? "hover:bg-accord-mist" : "cursor-not-allowed opacity-40",
                              selected && "bg-[#f1f2ff] text-accord-primary"
                            )}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate font-medium">{tool.label}</span>
                            {selected ? <span className="h-1.5 w-1.5 rounded-full bg-accord-primary" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#dfe4ff] bg-[#f6f7ff] px-3 py-2 text-xs leading-5 text-accord-muted">
                    Governance mode keeps raw prompts and responses disabled, stores metadata, and routes redacted previews through the server gateway.
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
