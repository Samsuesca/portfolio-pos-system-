import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  padded?: boolean;
  children: ReactNode;
}

export function Card({
  hoverable = false,
  padded = true,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-stone-200/60",
        "shadow-sm",
        padded && "p-6",
        hoverable &&
          "transition-all duration-200 ease-out hover:shadow-md hover:-translate-y-px hover:border-stone-300",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
