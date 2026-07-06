"use client";

import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolOption } from "./types";

type ToolsMenuProps = {
  tools: ToolOption[];
  selectedToolIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleTool: (id: string) => void;
};

export function ToolsMenu({ tools, selectedToolIds, open, onOpenChange, onToggleTool }: ToolsMenuProps) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="inline-flex items-center gap-2 rounded-full border border-accord-border bg-white px-3 py-2 text-sm font-medium text-accord-text shadow-sm transition hover:border-accord-primary/30"
      >
        Tools
        {selectedToolIds.length ? (
          <span className="rounded-full bg-accord-night px-1.5 py-0.5 text-[10px] text-white">{selectedToolIds.length}</span>
        ) : null}
        <ChevronDown className="h-3.5 w-3.5 text-accord-muted" aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-40 w-80 rounded-2xl border border-accord-border bg-white p-2 shadow-accord-soft">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const selected = selectedToolIds.includes(tool.id);
            return (
              <button
                key={tool.id}
                type="button"
                disabled={!tool.enabled}
                onClick={() => onToggleTool(tool.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl p-3 text-left transition",
                  tool.enabled ? "hover:bg-accord-mist" : "cursor-not-allowed opacity-45",
                  selected && "bg-[#f1f2ff]"
                )}
              >
                <span className="mt-0.5 rounded-lg border border-accord-border bg-white p-2 text-accord-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-accord-text">{tool.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-accord-muted">{tool.description}</span>
                </span>
                {selected ? <Check className="mt-2 h-4 w-4 text-accord-primary" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
