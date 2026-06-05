import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface EyebrowProps {
  children: ReactNode;
  dark?: boolean;
  dot?: boolean;
  className?: string;
}

export function Eyebrow({
  children,
  dark = false,
  dot = true,
  className,
}: EyebrowProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.18em] uppercase",
        dark ? "text-brand-400" : "text-brand-600",
        className
      )}
    >
      {dot && (
        <span
          aria-hidden="true"
          className="w-1.5 h-1.5 rounded-full bg-current"
        />
      )}
      {children}
    </span>
  );
}
