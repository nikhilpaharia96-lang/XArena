"use client";
import Link from "next/link";
import { ArrowDownToLine, ChevronRight, Gift, Plus, Radio, Swords, Trophy } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { formatPaise, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

const ACTIONS = [
  { href: "/wallet/deposit", label: "Add Money", icon: Plus, accent: "gradient-cta text-white" },
  { href: "/wallet/withdraw", label: "Withdraw", icon: ArrowDownToLine, accent: "bg-white/[0.07] text-white" },
  { href: "/my-matches", label: "My Matches", icon: Swords, accent: "bg-white/[0.07] text-white" },
  { href: "/referral", label: "Refer & Earn", icon: Gift, accent: "bg-white/[0.07] text-white" },
];

/** Returning players land on what they need first: balance, one-tap actions and their next match. */
export function PlayerDashboard() {
  const { data: me } = useCurrentUser();
  const { data: profile } = useProfile();
  if (!me) return null;

  const w = me.wallet;
  const total = w.depositBalance + w.winningBalance + w.bonusBalance;
  const next = [...(profile?.tournamentHistory ?? [])]
    .filter((h) => h.status !== "COMPLETED" && h.status !== "CANCELLED")
    .sort((a, b) => (a.status === "LIVE" ? -1 : b.status === "LIVE" ? 1 : new Date(a.matchStartsAt).getTime() - new Date(b.matchStartsAt).getTime()))[0];
  const name = me.user.displayName || me.user.username;

  return (
    <section aria-label="Your dashboard" className="space-y-3">
      <div className="rounded-3xl p-px bg-gradient-to-br from-violet/60 via-white/10 to-gold/40">
        <div className="rounded-[calc(1.5rem-1px)] bg-surface p-4">
          <p className="text-sm text-white/60">Hi, <span className="font-bold text-white">{name}</span> 👋</p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-white/50">Total balance</p>
          <p className="text-3xl font-black font-mono text-white tabular-nums">{formatPaise(total)}</p>
          <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
            {[["Deposit", w.depositBalance], ["Winnings", w.winningBalance], ["Bonus", w.bonusBalance]].map(([l, v]) => (
              <div key={l as string} className="rounded-xl bg-white/[0.05] py-1.5">
                <p className="text-[11px] text-white/50">{l}</p>
                <p className="text-sm font-bold font-mono text-white tabular-nums">{formatPaise(v as number)}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {ACTIONS.map((a) => (
              <Link key={a.href} href={a.href} className="flex flex-col items-center gap-1.5 rounded-2xl py-2.5 active:scale-95 transition-transform">
                <span className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", a.accent)}>
                  <a.icon className="h-5 w-5" strokeWidth={2.4} />
                </span>
                <span className="text-[11px] font-bold text-white/80 text-center leading-tight">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {next ? (
        <Link href={`/tournaments/${next.slug}`} className="flex items-center gap-3 rounded-2xl bg-surface border border-white/10 p-3.5 active:bg-white/[0.06]">
          <span className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", next.status === "LIVE" ? "bg-crimson/20" : "gradient-brand")}>
            {next.status === "LIVE" ? <Radio className="h-5 w-5 text-crimson" /> : <Trophy className="h-5 w-5 text-white" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-gold">{next.status === "LIVE" ? "Live now" : "Your next match"}</span>
            <span className="block text-sm font-bold text-white truncate">{next.title}</span>
            <span className="block text-xs text-white/55">{formatDateTime(next.matchStartsAt)}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-white/30 shrink-0" aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}
