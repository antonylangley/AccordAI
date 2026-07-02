import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/lib/mock-data";

const riskStyles: Record<RiskLevel, string> = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-700 before:bg-emerald-500",
  medium: "border-amber-200 bg-amber-50 text-amber-700 before:bg-amber-500",
  high: "border-orange-200 bg-orange-50 text-orange-700 before:bg-orange-500",
  critical: "border-red-200 bg-red-50 text-red-700 before:bg-red-500"
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize tracking-[0.01em] before:h-1.5 before:w-1.5 before:rounded-full",
        riskStyles[level]
      )}
    >
      {level}
    </span>
  );
}
