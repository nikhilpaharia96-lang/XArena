"use client";

import { Lock, User, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SlotBoard, SlotState } from "@/hooks/use-tournaments";

export interface Selection {
  slotNumber: number;
  position: number;
}

const STATE_LABEL: Record<SlotState, string> = {
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  SELECTED: "Selected",
  LOCKED: "Locked",
  UNAVAILABLE: "Unavailable",
};

/** Visual language for the five slot states (also used by the legend). */
export const stateStyle: Record<SlotState, string> = {
  AVAILABLE: "bg-surface-2 border-white/15 text-white hover:border-violet/60 hover:bg-violet/10 cursor-pointer",
  SELECTED: "bg-gold/20 border-gold text-white ring-2 ring-gold/40 shadow-[0_0_20px_-6px_rgba(249,115,22,0.7)] cursor-pointer",
  OCCUPIED: "bg-white/[0.03] border-white/5 text-white/30 cursor-not-allowed",
  LOCKED: "bg-crimson/10 border-crimson/30 text-crimson/70 cursor-not-allowed",
  UNAVAILABLE: "bg-white/[0.03] border-white/5 text-white/25 cursor-not-allowed opacity-60",
};

export function SlotLegend() {
  const items: SlotState[] = ["AVAILABLE", "SELECTED", "OCCUPIED", "LOCKED"];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Slot legend">
      {items.map((s) => (
        <li key={s} className="flex items-center gap-1.5 text-[11px] text-white/50">
          <span className={cn("h-4 w-4 rounded-md border", stateStyle[s].split(" cursor")[0], "hover:bg-transparent")} aria-hidden />
          {STATE_LABEL[s]}
        </li>
      ))}
    </ul>
  );
}

interface Props {
  board: SlotBoard;
  selected: Selection | null;
  onSelect: (s: Selection | null) => void;
  disabled?: boolean;
}

/**
 * Renders the slot board straight from the server's data. Solo tournaments get a compact
 * grid of numbered slots; team formats get one card per team with Player A/B/C… rows.
 */
export function SlotPicker({ board, selected, onSelect, disabled }: Props) {
  const stateOf = (slot: number, pos: number, base: Exclude<SlotState, "SELECTED">): SlotState =>
    selected && selected.slotNumber === slot && selected.position === pos ? "SELECTED" : base;

  const pick = (slot: number, pos: number, st: SlotState) => {
    if (disabled || (st !== "AVAILABLE" && st !== "SELECTED")) return;
    onSelect(st === "SELECTED" ? null : { slotNumber: slot, position: pos });
  };

  if (board.layout.teamSize === 1) {
    return (
      <div className="grid grid-cols-4 min-[400px]:grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 gap-2" role="group" aria-label="Choose your slot">
        {board.slots.map((slot) => {
          const p = slot.positions[0];
          const st = stateOf(slot.slotNumber, 1, p.state);
          const mine = p.occupant?.mine;
          return (
            <button
              key={slot.slotNumber}
              type="button"
              disabled={disabled || (st !== "AVAILABLE" && st !== "SELECTED")}
              aria-pressed={st === "SELECTED"}
              aria-label={`${slot.label}, ${mine ? "your slot" : STATE_LABEL[st].toLowerCase()}`}
              onClick={() => pick(slot.slotNumber, 1, st)}
              className={cn(
                "relative h-12 min-w-0 rounded-xl border text-sm font-bold transition-all active:scale-95 grid place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet",
                stateStyle[st],
                mine && "border-signal/60 text-signal bg-signal/10"
              )}
            >
              {st === "LOCKED" ? <Lock className="h-4 w-4" /> : st === "OCCUPIED" ? <User className="h-4 w-4" /> : slot.slotNumber}
              {st === "SELECTED" && <Check className="absolute right-1 top-1 h-3 w-3 text-gold" />}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-label="Choose your team slot">
      {board.slots.map((slot) => (
        <div key={slot.slotNumber} className={cn("rounded-2xl border p-3 space-y-2", slot.locked ? "border-crimson/25 bg-crimson/5" : "border-white/10 bg-surface/60")}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-black text-white">{slot.label}</p>
            {slot.locked && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-crimson">
                <Lock className="h-3 w-3" /> Locked
              </span>
            )}
          </div>
          {slot.positions.map((p) => {
            const st = stateOf(slot.slotNumber, p.position, p.state);
            const mine = p.occupant?.mine;
            return (
              <button
                key={p.position}
                type="button"
                disabled={disabled || (st !== "AVAILABLE" && st !== "SELECTED")}
                aria-pressed={st === "SELECTED"}
                aria-label={`${slot.label}, player ${p.label}, ${mine ? "your slot" : STATE_LABEL[st].toLowerCase()}`}
                onClick={() => pick(slot.slotNumber, p.position, st)}
                className={cn(
                  "w-full min-h-[44px] rounded-xl border px-3 flex items-center justify-between gap-2 text-left transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet",
                  stateStyle[st],
                  mine && "border-signal/60 text-signal bg-signal/10"
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/10 text-[11px] font-black">{p.label}</span>
                  <span className="text-sm font-semibold truncate">
                    {st === "OCCUPIED" ? (mine ? "You" : p.occupant?.username ?? "Taken") : st === "SELECTED" ? "Your pick" : `Player ${p.label}`}
                  </span>
                </span>
                <span className="text-[11px] shrink-0">
                  {st === "LOCKED" ? <Lock className="h-3.5 w-3.5" /> : st === "SELECTED" ? <Check className="h-4 w-4 text-gold" /> : STATE_LABEL[st]}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
