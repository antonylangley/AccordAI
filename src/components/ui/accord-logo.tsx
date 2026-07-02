import Image from "next/image";
import { cn } from "@/lib/utils";

type AccordLogoProps = {
  className?: string;
  markOnly?: boolean;
  lockup?: boolean;
  framed?: boolean;
  compact?: boolean;
  tone?: "dark" | "light";
};

export function AccordLogo({
  className,
  markOnly = false,
  lockup = false,
  framed = false,
  compact = false,
  tone = "dark"
}: AccordLogoProps) {
  if (lockup) {
    return (
      <div
        className={cn(
          "inline-flex items-center",
          framed &&
            cn(
              "border border-white/10 bg-white shadow-accord-glow",
              compact ? "rounded-xl px-2.5 py-1.5" : "rounded-2xl px-3 py-2"
            ),
          className
        )}
        aria-label="Accord"
      >
        <Image
          src="/accord-logo.png"
          width={371}
          height={94}
          alt="Accord"
          priority
          className={cn("w-auto", compact ? "h-6" : "h-8")}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)} aria-label="Accord">
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          tone === "dark"
            ? "bg-white/[0.08] shadow-accord-glow ring-1 ring-white/[0.12]"
            : "bg-white shadow-accord-panel ring-1 ring-accord-border"
        )}
      >
        <Image
          src="/accord-mark.png"
          width={118}
          height={90}
          alt=""
          priority
          className="h-7 w-auto"
        />
      </div>
      {!markOnly ? (
        <div>
          <p className={cn("text-base font-semibold leading-5", tone === "dark" ? "text-white" : "text-accord-text")}>
            Accord
          </p>
          <p className={cn("text-xs", tone === "dark" ? "text-slate-400" : "text-accord-muted")}>
            AI governance
          </p>
        </div>
      ) : null}
    </div>
  );
}
