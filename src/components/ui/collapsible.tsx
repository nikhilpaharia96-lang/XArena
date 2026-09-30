"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Accessible expand/collapse card used by the tournament detail page's
 * About / Prize Distribution / Rules / Participants sections. Kept generic
 * (icon + title + trailing badge + children) so any section can opt in
 * without re-implementing open-state + animation + aria wiring.
 */
export function Collapsible({
  icon: Icon,
  iconClassName,
  title,
  trailing,
  defaultOpen = false,
  children,
  className,
}: {
  icon?: React.ElementType;
  iconClassName?: string;
  title: React.ReactNode;
  trailing?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={cn("glass rounded-2xl overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center justify-between gap-3 p-4 text-left min-h-11"
      >
        <span className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className={cn("h-4 w-4 shrink-0", iconClassName ?? "text-violet")} />}
          <span className="font-bold text-white text-sm truncate">{title}</span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {trailing}
          <ChevronDown
            aria-hidden
            className={cn("h-4 w-4 text-white/50 transition-transform duration-200", open && "rotate-180")}
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
