"use client";

import { Star, Users } from "lucide-react";
import { SectionHeader } from "./section-header";

/**
 * PLACEHOLDER COPY — there's no review/rating feature in the schema yet,
 * so these aren't real submitted reviews. Swap this array for real player
 * feedback (or wire up an actual reviews table + admin moderation) before
 * this ships to real users — fabricated "customer" quotes on a real-money
 * platform are a trust issue, not just a design detail.
 */
const TESTIMONIALS = [
  { initials: "AK", name: "Arjun K.", quote: "Smooth tournaments and fair matches. Payouts landed in my wallet within minutes of the result." },
  { initials: "PS", name: "Priya S.", quote: "Clean UI, easy to join, and withdrawals are simple. My squad plays every weekend now." },
  { initials: "RM", name: "Rohit M.", quote: "Best tournament app I've used — real prizes, real players, genuinely competitive." },
];

export function Testimonials() {
  return (
    <section>
      <SectionHeader title="What Players Say" icon={Users} />
      <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x -mx-4 px-4">
        {TESTIMONIALS.map((t) => (
          <div key={t.name} className="shrink-0 w-[240px] snap-center rounded-2xl bg-surface border border-white/8 p-4">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="h-9 w-9 rounded-full gradient-brand flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                {t.initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{t.name}</p>
                <div className="flex items-center gap-0.5 mt-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-2.5 w-2.5 fill-gold text-gold" />
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-white/60 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
          </div>
        ))}
      </div>
    </section>
  );
}
