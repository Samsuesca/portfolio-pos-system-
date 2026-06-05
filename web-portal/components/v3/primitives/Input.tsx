import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, ...rest },
  ref
) {
  const inputId = id || rest.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-medium tracking-wide uppercase text-stone-700"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          "w-full px-4 py-3 text-sm rounded-lg",
          "bg-white text-stone-900 placeholder:text-stone-400",
          "border border-stone-200",
          "transition-all duration-150 ease-out",
          "hover:border-stone-300",
          "focus:outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-400/20",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-error focus:border-error focus:ring-error/20",
          className
        )}
        {...rest}
      />
      {(hint || error) && (
        <span
          className={cn(
            "text-xs",
            error ? "text-error" : "text-stone-500"
          )}
        >
          {error || hint}
        </span>
      )}
    </div>
  );
});
