"use client";

import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { BankAccountItem } from "@/hooks/use-wallet";

/** A saved bank account. Tap to select it as the payout destination; the X removes it. */
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
  return (
    <div
      className={cn(
        "relative rounded-2xl p-0.5 transition-all",
        selected ? "ring-2 ring-gold shadow-[0_0_0_4px_rgba(249,115,22,0.15)]" : "ring-1 ring-white/10"
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className="block w-full text-left rounded-[14px] gradient-brand px-4 py-3 pr-14 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <span className="flex items-center gap-2 pb-2 border-b border-white/30">
          <span className="text-base font-black tracking-wide">BANK {bank.slot}</span>
          {selected && (
            <span className="text-[10px] font-black uppercase tracking-wider bg-white/25 rounded-full px-2 py-0.5">Selected</span>
          )}
        </span>
        <span className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2.5">
          <Field label="Bank name" value={bank.bankName} />
          <Field label="IFSC" value={bank.ifsc} />
          <Field label="Account holder" value={bank.accountHolder} wide />
          <Field label="Account no" value={bank.accountNumber} wide />
        </span>
      </button>
      <button
        type="button"
        aria-label={`Remove bank ${bank.slot}`}
        disabled={deleting}
        onClick={onDelete}
        className="absolute top-1.5 right-2 h-10 w-10 rounded-full bg-black/25 hover:bg-crimson text-white flex items-center justify-center disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="h-4 w-4" strokeWidth={3} />
      </button>
    </div>
  );
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <span className={cn("block min-w-0", wide && "col-span-2")}>
      <span className="block text-[10px] uppercase tracking-wide text-white/65">{label}</span>
      <span className="block text-sm font-bold break-words">{value}</span>
    </span>
  );
}

export function EmptyBankSlot({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="w-full rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] hover:bg-white/[0.05] h-14 text-white/80 text-sm font-bold flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
    >
      <Plus className="h-4 w-4" strokeWidth={3} /> Add a bank account
    </button>
  );
}
