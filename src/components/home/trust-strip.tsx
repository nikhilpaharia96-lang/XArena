import { BadgeCheck, Coins, ShieldCheck, Headset } from "lucide-react";

/** Only statements that are true of how XArena actually works:
 * results are verified by admins, deposits/withdrawals are reviewed by the
 * team, entry fees fund the prize pool (see FAQ), support is available. */
const ITEMS = [
  { icon: BadgeCheck, title: "Verified Results", text: "Every result is checked by admins", tone: "text-signal" },
  { icon: ShieldCheck, title: "Reviewed Payments", text: "Deposits & withdrawals checked", tone: "text-cobalt" },
  { icon: Coins, title: "Real Prize Pools", text: "Entry fees fund the prizes", tone: "text-gold" },
  { icon: Headset, title: "Player Support", text: "Help when you need it", tone: "text-cobalt" },
];

export function TrustStrip() {
  return (
    <section aria-label="Why play on XArena">
      <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ITEMS.map((i) => (
          <li key={i.title} className="rounded-2xl bg-surface border border-white/10 p-3.5 flex items-start gap-3">
            <span className="h-9 w-9 shrink-0 rounded-xl bg-white/5 flex items-center justify-center">
              <i.icon className={`h-[18px] w-[18px] ${i.tone}`} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-white leading-tight">{i.title}</p>
              <p className="text-[11px] text-white/55 leading-snug mt-0.5">{i.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
