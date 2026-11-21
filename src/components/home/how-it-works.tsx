const STEPS = [
  { title: "Make an account", desc: "Phone or email, takes a minute." },
  { title: "Pick a game", desc: "Free Fire, BGMI, PUBG, COD Mobile and more." },
  { title: "Pay the entry, grab a slot", desc: "Your slot is locked once payment goes through." },
  { title: "Play and get paid", desc: "Winnings are credited to your wallet after results are checked." },
];

/** Static onboarding steps — app chrome, not data, so nothing is fetched. */
export function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works-title">
      <div className="mb-3 border-b border-white/10 pb-2">
        <h2 id="how-it-works-title" className="font-display text-xl font-bold uppercase tracking-wide text-white flex items-center gap-2 leading-none">
          <span className="h-4 w-1 rounded-sm bg-gold" aria-hidden />
          How it works
        </h2>
      </div>
      <ol className="divide-y divide-white/8 rounded-xl border border-white/10 bg-surface">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex items-baseline gap-4 px-4 py-3.5">
            <span className="font-display text-3xl font-bold leading-none text-white/25 tabular-nums w-7 shrink-0">{i + 1}</span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white">{s.title}</h3>
              <p className="mt-0.5 text-xs text-white/55 leading-relaxed">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
