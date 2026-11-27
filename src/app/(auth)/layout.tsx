import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Headset, ShieldCheck, Trophy, Zap } from "lucide-react";

const TRUST = [
  { icon: ShieldCheck, label: "Secure login" },
  { icon: Trophy, label: "Verified results" },
  { icon: Headset, label: "Player support" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden flex flex-col items-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {/* Atmosphere: soft brand glows behind the card */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-violet/30 blur-[110px]" />
        <div className="absolute top-1/2 -right-24 h-72 w-72 rounded-full bg-gold/15 blur-[100px]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(var(--color-white)_1px,transparent_1px),linear-gradient(90deg,var(--color-white)_1px,transparent_1px)] [background-size:36px_36px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      </div>

      <div className="w-full max-w-sm flex-1 flex flex-col justify-center py-4">
        <div className="flex items-center justify-between mb-5">
          <Link href="/" className="inline-flex items-center gap-1 h-11 -ml-2 px-2 text-sm font-semibold text-white/60 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-bold text-gold">
            <Zap className="h-3 w-3" /> Instant payouts
          </span>
        </div>

        <Link href="/" aria-label="XArena home" className="flex justify-center mb-6">
          <Image src="/images/xarena-logo.webp" alt="XArena" width={360} height={106} priority className="h-11 w-auto drop-shadow-[0_6px_24px_rgba(37,99,235,0.45)]" />
        </Link>

        <div className="rounded-3xl p-px bg-gradient-to-b from-violet/50 via-white/10 to-white/5 shadow-[0_24px_60px_-28px_rgba(37,99,235,0.6)]">
          <div className="bg-surface rounded-[calc(1.5rem-1px)] p-5 sm:p-6">{children}</div>
        </div>

        <ul className="mt-5 grid grid-cols-3 gap-2">
          {TRUST.map((t) => (
            <li key={t.label} className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface/70 border border-white/10 py-3 px-1 text-center backdrop-blur">
              <t.icon className="h-4 w-4 text-signal" />
              <span className="text-[11px] font-semibold text-white/70 leading-tight">{t.label}</span>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-white/50">
          18+ only. Play responsibly. By continuing you agree to XArena&apos;s{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-white">Terms</Link> and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-white">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
