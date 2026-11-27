import { cn } from "@/lib/cn";
import React, { useId } from "react";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { error?: string; leading?: React.ReactNode }>(
  ({ className, error, id, leading, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;
    return (
      <div className="w-full">
        <div className="relative">
        {leading && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/45 [&>svg]:h-[18px] [&>svg]:w-[18px]">{leading}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : props["aria-describedby"]}
          className={cn(
            "w-full rounded-xl bg-surface-2 border border-white/10 px-4 h-12 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-violet/60 focus:ring-2 focus:ring-violet/20",
            leading && "pl-11",
            error && "border-crimson/60 focus:border-crimson focus:ring-crimson/20",
            className
          )}
          {...props}
        />
        </div>
        {error && (
          <p id={errorId} role="alert" className="mt-1.5 text-xs text-crimson">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
