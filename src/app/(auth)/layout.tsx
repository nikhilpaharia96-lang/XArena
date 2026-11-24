import Image from "next/image";
import Link from "next/link";
import { Headset, ShieldCheck, Trophy } from "lucide-react";

const TRUST = [
  { icon: ShieldCheck, label: "Secure login" },
  { icon: Trophy, label: "Verified results" },
  { icon: Headset, label: "Player support" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <Link href="/" aria-label="XArena home" className="flex justify-center mb-6">
          <Image src="/images/xarena-logo.webp" alt="XArena" width={360} height={106} priority className="h-10 w-auto" />
        </Link>

        <div className="bg-surface border border-white/10 rounded-3xl p-5 sm:p-6 shadow-[0_16px_36px_-24px_rgba(0,0,0,0.9)]">{children}</div>

        <ul className="mt-5 grid grid-cols-3 gap-2">
          {TRUST.map((t) => (
            <li key={t.label} className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface border border-white/10 py-3 px-1 text-center">
              <t.icon className="h-4 w-4 text-signal" />
              <span className="text-[11px] font-semibold text-white/70 leading-tight">{t.label}</span>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-white/45">
          18+ only. Play responsibly. By continuing you agree to play fair and follow XArena&apos;s rules.
        </p>
      </div>
    </div>
  );
}
