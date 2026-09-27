import { ChevronRight, Gamepad2, UserPlus, Trophy, Zap } from "lucide-react";

const STEPS = [
  { icon: UserPlus, title: "Create Account", desc: "Quick & easy signup" },
  { icon: Gamepad2, title: "Choose Game", desc: "Pick your favorite game" },
  { icon: Trophy, title: "Join Tournament", desc: "Pay entry & confirm slot" },
  { icon: Zap, title: "Play & Win", desc: "Compete and earn rewards" },
];

/** Static onboarding steps — this is app chrome, not data, so it doesn't
 * fetch anything. Genuinely a sequence, which is why it's numbered. */
export function HowItWorks() {
  return (
    <section className="rounded-3xl bg-surface border border-white/8 p-5">
      <h2 className="flex items-center gap-1.5 text-base font-bold text-white">
        <Zap className="h-4 w-4 text-gold" /> How It Works
      </h2>
      <p className="text-xs text-white/50 mt-1 mb-4">Join a tournament in 4 simple steps</p>

      <div className="flex items-start">
        {STEPS.map((s, i) => (
          <div key={s.title} className="flex items-start flex-1">
            <div className="flex flex-col items-center text-center gap-2 flex-1 min-w-0">
              <div className="relative h-11 w-11 rounded-2xl bg-violet/15 border border-violet/25 flex items-center justify-center">
                <s.icon className="h-5 w-5 text-violet" />
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-gold text-void text-[9px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
              </div>
              <div className="px-0.5">
                <p className="text-[11px] font-bold text-white leading-tight">{s.title}</p>
                <p className="text-[10px] text-white/45 leading-tight mt-0.5">{s.desc}</p>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-white/20 mt-3 shrink-0 -mx-1" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
