import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/lib/mock-data";

const riskStyles: Record<RiskLevel, string> = {
  low: "border-[#C8C2FF] bg-[#C8C2FF]/20 text-[#5F58C7] dark:border-[#C8C2FF]/30 dark:bg-[#C8C2FF]/10 dark:text-[#D6D1FF]",
  medium: "border-[#8B7CFF]/50 bg-[#8B7CFF]/15 text-[#6E5BE8] dark:border-[#8B7CFF]/35 dark:bg-[#8B7CFF]/12 dark:text-[#B9AFFF]",
  high: "border-[#625BFF]/50 bg-[#625BFF]/12 text-[#4F48E0] dark:border-[#625BFF]/40 dark:bg-[#625BFF]/15 dark:text-[#A5A0FF]",
  critical: "border-[#271A6F]/40 bg-[#271A6F]/10 text-[#271A6F] dark:border-[#8B7CFF]/40 dark:bg-[#271A6F]/50 dark:text-[#C4BCFF]"
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium capitalize",
        riskStyles[level]
      )}
    >
      {level}
    </span>
  );
}
