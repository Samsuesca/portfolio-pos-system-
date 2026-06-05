import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type BadgeVariant = "brand" | "stone" | "success" | "warning" | "error";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const VARIANTS: Record<BadgeVariant, string> = {
  brand: "bg-brand-100 text-brand-700",
  stone: "bg-stone-100 text-stone-700",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  error: "bg-error/10 text-error",
};

export function Badge({ children, variant = "stone", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5",
        "text-[11px] font-semibold tracking-wider uppercase rounded-full",
        VARIANTS[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
