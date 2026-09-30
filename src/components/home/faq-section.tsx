"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { SectionHeader } from "./section-header";

const FAQS = [
  { q: "How to join a tournament?", a: "Open the tournament you want, check the entry fee and slots, then tap Join Now. Once payment is confirmed your slot is locked in." },
  { q: "How do payments work?", a: "Add money to your XArena wallet, and entry fees are deducted from it when you join a tournament. Prize winnings are credited back to the same wallet." },
  { q: "Can I create my own tournament?", a: "Tournament creation is currently handled by XArena admins to keep matches fair and verified. Use Create Tournament on the homepage to request one." },
  { q: "Is there any platform fee?", a: "Entry fees go straight into the prize pool. Any platform fee, if applicable, is shown upfront before you confirm payment — never hidden." },
  { q: "How to withdraw winnings?", a: "Go to Wallet → Withdraw, enter the amount and your payout details. Withdrawals are reviewed and processed by the XArena team." },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section>
      <SectionHeader title="Frequently Asked Questions" icon={HelpCircle} />
      <div className="rounded-2xl bg-surface border border-white/8 divide-y divide-white/8 overflow-hidden">
        {FAQS.map((f, i) => {
          const expanded = open === i;
          return (
            <div key={f.q}>
              <button
                onClick={() => setOpen(expanded ? null : i)}
                aria-expanded={expanded}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
              >
                <span className="text-sm font-semibold text-white">{f.q}</span>
                <ChevronDown className={`h-4 w-4 text-white/40 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
              {expanded && <p className="px-4 pb-4 text-xs text-white/55 leading-relaxed">{f.a}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
