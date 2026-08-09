"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type AccordTheme = "light" | "dark";

export const ACCORD_THEME_KEY = "accord-theme";
export const ACCORD_THEME_EVENT = "accord-theme-change";

export function readStoredTheme(): AccordTheme {
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem(ACCORD_THEME_KEY) === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<AccordTheme>("light");

  useEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  function apply(next: AccordTheme) {
    setTheme(next);
    window.localStorage.setItem(ACCORD_THEME_KEY, next);
    window.dispatchEvent(new CustomEvent(ACCORD_THEME_EVENT, { detail: next }));
  }

  return (
    <div className="inline-flex rounded-md border border-accord-border p-0.5" role="radiogroup" aria-label="Interface theme">
      <ThemeOption
        label="Light"
        icon={<Sun className="h-3.5 w-3.5" aria-hidden="true" />}
        selected={theme === "light"}
        onSelect={() => apply("light")}
      />
      <ThemeOption
        label="Dark"
        icon={<Moon className="h-3.5 w-3.5" aria-hidden="true" />}
        selected={theme === "dark"}
        onSelect={() => apply("dark")}
      />
    </div>
  );
}

function ThemeOption({
  label,
  icon,
  selected,
  onSelect
}: {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[13px] font-medium transition-colors",
        selected ? "bg-accord-surface text-accord-text" : "text-accord-muted hover:text-accord-text"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
