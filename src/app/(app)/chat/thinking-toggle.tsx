"use client";

import { Brain } from "lucide-react";
import { cn } from "@/lib/utils";

type ThinkingToggleProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  compact?: boolean;
};

export function ThinkingToggle({ enabled, onChange, compact = false }: ThinkingToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border transition",
        compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm",
        enabled
          ? "border-accord-primary/30 bg-[#f1f2ff] text-accord-primary"
          : "border-accord-border bg-white text-accord-muted hover:text-accord-text"
      )}
      aria-pressed={enabled}
    >
      <Brain className="h-4 w-4" aria-hidden="true" />
      {enabled ? "Thinking on" : "Thinking off"}
    </button>
  );
}
