"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

/**
 * Mobile bottom sheet for the game / entry-fee / prize-pool filters on
 * /tournaments. On sm+ screens the same controls render inline instead
 * (see TournamentsListing), so this component only mounts on mobile.
 */
export function FilterSheet({
  open,
  onClose,
  onClear,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] bg-black/60 sm:hidden"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            className={cn(
              "fixed inset-x-0 bottom-0 z-[61] sm:hidden",
              "rounded-t-3xl bg-surface border-t border-white/10 safe-bottom max-h-[80vh] overflow-y-auto"
            )}
          >
            <div className="flex items-center justify-between px-5 h-14 border-b border-white/8">
              <span className="text-sm font-bold text-white">Filters</span>
              <button onClick={onClose} aria-label="Close filters" className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center">
                <X className="h-4 w-4 text-white/70" />
              </button>
            </div>
            <div className="p-5 space-y-5">{children}</div>
            <div className="p-5 pt-0 flex gap-3">
              <Button variant="secondary" fullWidth onClick={onClear}>
                Clear all
              </Button>
              <Button fullWidth onClick={onClose}>
                Show results
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
