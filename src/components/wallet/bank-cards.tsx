"use client";

import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { BankAccountItem } from "@/hooks/use-wallet";

/** A saved bank account. Tap to select it as the payout destination; the red X removes it. */
export function BankCard({
  bank,
  selected,
  onSelect,
  onDelete,
  deleting,
}: {
  bank: BankAccountItem;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  deleting?: boolean;
}) {
  const fields: [string, string][] = [
    ["IFSC/SWIFT", bank.ifsc],
    ["Bank name", bank.bankName],
    ["Account holder name", bank.accountHolder],
    ["Account no", bank.accountNumber],
  ];
  return (
    <div
      className={cn(
        "relative rounded-3xl p-1 transition-all",
        selected ? "ring-2 ring-gold shadow-[0_0_0_4px_rgba(249,115,22,0.15)]" : "ring-1 ring-white/10"
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className="block w-full text-left rounded-[22px] gradient-brand px-4 pt-3 pb-1 text-white"
      >
        <span className="flex items-center justify-between pr-9 pb-2 border-b border-white/70">
          <span className="text-xl font-black tracking-wide">BANK {bank.slot}</span>
          {selected && <span className="text-[10px] font-black uppercase tracking-wider bg-white/25 rounded-full px-2 py-0.5">Selected</span>}
        </span>
        {fields.map(([label, value]) => (
          <span key={label} className="block py-2 border-b border-white/15 last:border-0">
            <span className="block text-[10px] uppercase tracking-wide text-white/55">{label}</span>
            <span className="block text-[15px] font-bold break-all">{value}</span>
          </span>
        ))}
      </button>
      <button
        type="button"
        aria-label={`Remove bank ${bank.slot}`}
        disabled={deleting}
        onClick={onDelete}
        className="absolute top-3.5 right-4 h-8 w-8 rounded-full bg-crimson text-white flex items-center justify-center shadow-lg disabled:opacity-50"
      >
        <X className="h-4 w-4" strokeWidth={3} />
      </button>
    </div>
  );
}

export function EmptyBankSlot({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-white/15 bg-white/[0.02] py-10 px-6 flex">
      <button
        type="button"
        onClick={onAdd}
        className="mx-auto w-full max-w-[280px] h-12 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-black tracking-wide flex items-center justify-center gap-2 transition-colors"
      >
        <Plus className="h-4 w-4" strokeWidth={3} /> TAP TO ADD A BANK
      </button>
    </div>
  );
}
