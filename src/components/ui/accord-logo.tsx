import Image from "next/image";
import { cn } from "@/lib/utils";

const ACCORD_LOCKUP = {
  src: "/brand/accord-logo-new.png",
  width: 1935,
  height: 455
};

const ACCORD_EMBLEM = {
  src: "/brand/accord-emblem-new.png",
  width: 576,
  height: 410
};

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
          src={ACCORD_LOCKUP.src}
          width={ACCORD_LOCKUP.width}
          height={ACCORD_LOCKUP.height}
          alt="Accord"
          priority
          className={cn("w-auto object-contain", compact ? "h-6" : "h-8")}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)} aria-label="Accord">
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl bg-white",
          tone === "dark"
            ? "shadow-accord-glow ring-1 ring-white/[0.18]"
            : "shadow-accord-panel ring-1 ring-accord-border"
        )}
      >
        <Image
          src={ACCORD_EMBLEM.src}
          width={ACCORD_EMBLEM.width}
          height={ACCORD_EMBLEM.height}
          alt=""
          priority
          className="h-7 w-auto object-contain"
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
