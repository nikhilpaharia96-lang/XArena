import { cn } from "@/lib/cn";

type Tone = "violet" | "cobalt" | "signal" | "crimson" | "gold" | "neutral";

const toneClasses: Record<Tone, string> = {
  violet: "bg-violet/15 text-violet border-violet/30",
  cobalt: "bg-cobalt/15 text-cobalt border-cobalt/30",
  signal: "bg-signal/15 text-signal border-signal/30",
  crimson: "bg-crimson/15 text-crimson border-crimson/30",
  gold: "bg-gold/15 text-gold border-gold/30",
  neutral: "bg-white/8 text-white/70 border-white/15",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide", toneClasses[tone], className)}>
      {children}
    </span>
  );
}
