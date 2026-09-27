import { cn } from "@/lib/cn";
import React from "react";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { error?: string }>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            "w-full rounded-xl bg-surface-2 border border-white/10 px-4 h-12 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-violet/60 focus:ring-2 focus:ring-violet/20",
            error && "border-crimson/60 focus:border-crimson focus:ring-crimson/20",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs text-crimson">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
