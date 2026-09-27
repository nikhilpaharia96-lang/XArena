"use client";

import { cn } from "@/lib/cn";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import React from "react";

type Variant = "primary" | "cta" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref" | "children"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: "gradient-brand text-white shadow-[0_8px_24px_-8px_rgba(37,99,235,0.6)]",
  cta: "gradient-cta text-white shadow-[0_8px_24px_-8px_rgba(249,115,22,0.6)]",
  secondary: "bg-surface-2 text-white border border-white/10",
  outline: "bg-transparent border border-violet/40 text-violet hover:bg-violet/10",
  ghost: "bg-transparent text-white/70 hover:bg-white/5",
  danger: "bg-crimson text-white shadow-[0_8px_24px_-8px_rgba(239,68,68,0.6)]",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-xl",
  md: "h-11 px-5 text-sm rounded-2xl",
  lg: "h-14 px-6 text-base rounded-2xl",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, fullWidth, disabled, children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.12 }}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-semibold tracking-tight transition-colors disabled:opacity-50 disabled:pointer-events-none active:opacity-90",
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </motion.button>
    );
  }
);
Button.displayName = "Button";
