"use client";

import { cn } from "@/lib/cn";

/**
 * The platform's signature visual motif: tournament capacity rendered as a
 * row of small blocks (like a bracket seed / ammo counter) rather than a
 * generic progress bar. Fills violet → crimson as slots deplete; the final
 * few slots pulse to create urgency. Capped at 20 visual blocks regardless
 * of maxSlots so a 500-slot mega event doesn't render 500 divs — each block
 * then represents a proportional chunk of capacity.
 */
export function SlotMeter({ filled, max, className }: { filled: number; max: number; className?: string }) {
  const blockCount = Math.min(max, 20);
  const filledBlocks = Math.round((filled / max) * blockCount);
  const slotsLeft = max - filled;
  const isCritical = slotsLeft > 0 && slotsLeft <= Math.max(3, Math.ceil(max * 0.05));

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex gap-[3px] flex-1">
        {Array.from({ length: blockCount }).map((_, i) => {
          const isFilled = i < filledBlocks;
          const isLastFilled = i === filledBlocks - 1;
          return (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                isFilled ? "bg-gradient-to-r from-violet to-cobalt" : "bg-white/10",
                isFilled && isCritical && isLastFilled && "animate-pulse bg-crimson"
              )}
            />
          );
        })}
      </div>
      <span className={cn("text-xs font-mono font-medium tabular-nums whitespace-nowrap", isCritical ? "text-crimson" : "text-white/60")}>
        {slotsLeft > 0 ? `${slotsLeft} left` : "Full"}
      </span>
    </div>
  );
}
