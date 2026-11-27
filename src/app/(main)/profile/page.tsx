"use client";

import { useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useProfile } from "@/hooks/use-profile";
import { useLoyalty } from "@/hooks/use-loyalty";
import { LevelCard } from "@/components/rewards/level-card";
import { useLogout } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast-store";
import { formatPaise } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { Avatar, Panel, SectionTitle, SettingsRow } from "@/components/profile/parts";
import {
  User, Wallet, Bell, Moon, Sun, Lock, Headphones, FileText, LogOut, Copy, SlidersHorizontal, CircleHelp, Undo2,
  Swords, Users, Gift, Pencil, BadgeCheck, Trophy, Target, Flame, Percent, Crosshair, type LucideIcon,
} from "lucide-react";

const QUICK: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/my-matches", label: "My Matches", icon: Swords },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/referral", label: "Refer", icon: Gift },
];

export default function ProfilePage() {
  useRequireAuth();
  const { theme, setTheme } = useTheme();
  const { data, isLoading } = useProfile();
  const { data: loyalty } = useLoyalty();
  const logout = useLogout();
  const [confirmLogout, setConfirmLogout] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-52 rounded-3xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const { profile, stats } = data;
  const name = profile.displayName ?? profile.username;
  const winRate = stats.matchesPlayed > 0 ? Math.round((stats.wins / stats.matchesPlayed) * 100) : 0;
  const since = new Date(profile.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  const copyUid = async () => {
    try {
      await navigator.clipboard.writeText(profile.uid);
      toast({ title: "User ID copied", tone: "success" });
    } catch {
      toast({ title: "Couldn't copy User ID", tone: "error" });
    }
  };

  const STATS: { label: string; value: string; icon: LucideIcon; tone: string }[] = [
    { label: "Matches", value: String(stats.matchesPlayed), icon: Swords, tone: "text-cobalt" },
    { label: "Wins", value: String(stats.wins), icon: Trophy, tone: "text-gold" },
    { label: "Win rate", value: `${winRate}%`, icon: Percent, tone: "text-signal" },
    { label: "Earnings", value: formatPaise(stats.totalEarnings), icon: Wallet, tone: "text-signal" },
    { label: "Kills", value: String(stats.kills), icon: Crosshair, tone: "text-crimson" },
    { label: "Streak", value: String(stats.currentStreak), icon: Flame, tone: "text-gold" },
  ];

  return (
    <div className="mx-auto w-full max-w-xl pb-6 space-y-4">
      {/* hero */}
      <div className="relative overflow-hidden rounded-3xl border border-cobalt/35 bg-surface shadow-[0_24px_50px_-28px_rgba(37,99,235,0.7)]">
        <div aria-hidden className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(135deg,#1D4ED8_0%,#1E3A8A_55%,#7C2D12_130%)]" />
        <div aria-hidden className="absolute -top-10 -right-8 h-40 w-40 rounded-full bg-gold/25 blur-[60px]" />
        <div className="relative px-4 pb-4 pt-10">
          <div className="flex items-end justify-between gap-3">
            <div className="relative">
              <Avatar url={profile.avatarUrl} name={name} size={84} className="ring-4 ring-surface" />
              {loyalty && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-black">
                  {loyalty.level.name}
                </span>
              )}
            </div>
            <Link href="/profile/account" className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-bold text-white active:bg-white/10">
              <Pencil className="h-4 w-4" /> Edit profile
            </Link>
          </div>
          <h1 className="mt-4 flex items-center gap-1.5 text-2xl font-black text-white">
            <span className="truncate">{name}</span>
            {profile.emailVerified && <BadgeCheck className="h-5 w-5 shrink-0 text-cobalt" aria-label="Email verified" />}
          </h1>
          <p className="text-sm text-white/60 truncate">@{profile.username} · Member since {since}</p>
          <button
            type="button"
            onClick={() => void copyUid()}
            aria-label="Copy user ID"
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-white/[0.06] px-3.5 text-xs text-white/70 active:bg-white/10"
          >
            User ID <span className="font-mono font-bold text-white">{profile.uid}</span> <Copy className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-2.5">
        {STATS.map((st) => (
          <div key={st.label} className="rounded-2xl border border-white/10 bg-surface p-3">
            <st.icon className={`h-4 w-4 ${st.tone}`} />
            <p className="mt-1.5 text-lg font-black font-mono tabular-nums text-white truncate">{st.value}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{st.label}</p>
          </div>
        ))}
      </div>
      {stats.matchesPlayed === 0 && (
        <Link href="/tournaments" className="flex items-center gap-2 rounded-2xl border border-dashed border-violet/40 bg-violet/[0.06] p-3.5 text-sm font-semibold text-white">
          <Target className="h-5 w-5 text-cobalt" /> Play your first tournament to start building your stats →
        </Link>
      )}

      {loyalty && <LevelCard data={loyalty} href="/rewards" />}

      {/* shortcuts */}
      <div className="grid grid-cols-4 gap-2">
        {QUICK.map((q) => (
          <Link key={q.href} href={q.href} className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-surface py-3 active:bg-white/[0.06]">
            <q.icon className="h-5 w-5 text-cobalt" />
            <span className="text-[11px] font-bold text-white/80">{q.label}</span>
          </Link>
        ))}
      </div>

      <div>
        <SectionTitle icon={User}>Account</SectionTitle>
        <Panel>
          <SettingsRow icon={User} chip="bg-cobalt/15 text-cobalt" title="Account Settings" subtitle="Edit profile, email, phone" href="/profile/account" />
          <SettingsRow icon={Wallet} chip="bg-gold/15 text-gold" title="Wallet & Payments" subtitle="Balance, deposits, withdrawals" href="/wallet" />
        </Panel>

        <SectionTitle icon={SlidersHorizontal}>App Preferences</SectionTitle>
        <Panel>
          <SettingsRow icon={Bell} chip="bg-crimson/15 text-crimson" title="Notifications" subtitle="Push alerts and your inbox" href="/notifications" />
          <SettingsRow
            icon={Moon}
            chip="bg-violet/20 text-cobalt"
            title="Theme"
            subtitle="Dark / Light mode"
            right={
              <div role="group" aria-label="Theme" className="flex rounded-xl bg-surface-2 border border-white/10 p-0.5 text-xs font-semibold">
                {([
                  { value: "dark", label: "Dark", Icon: Moon },
                  { value: "light", label: "Light", Icon: Sun },
                ] as const).map(({ value, label, Icon }) => {
                  const active = theme === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setTheme(value)}
                      className={
                        active
                          ? "flex h-10 items-center gap-1 rounded-lg bg-cobalt px-3 text-[#FFFFFF]"
                          : "flex h-10 items-center gap-1 rounded-lg px-3 text-white/60"
                      }
                    >
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </button>
                  );
                })}
              </div>
            }
          />
          <SettingsRow icon={Lock} chip="bg-violet/20 text-cobalt" title="Privacy Policy" subtitle="How we use and protect your data" href="/privacy" />
        </Panel>

        <SectionTitle icon={CircleHelp}>Support &amp; Info</SectionTitle>
        <Panel>
          <SettingsRow icon={Headphones} chip="bg-gold/15 text-gold" title="Help & Support" subtitle="Get help or contact support" href="/support" />
          <SettingsRow icon={FileText} chip="bg-cobalt/15 text-cobalt" title="Terms & Conditions" subtitle="Rules for using XArena" href="/terms" />
          <SettingsRow icon={Undo2} chip="bg-signal/15 text-signal" title="Refund Policy" subtitle="When and how refunds work" href="/refund" />
        </Panel>
      </div>

      <button
        type="button"
        onClick={() => {
          if (!confirmLogout) {
            setConfirmLogout(true);
            window.setTimeout(() => setConfirmLogout(false), 4000);
            return;
          }
          logout.mutate();
        }}
        disabled={logout.isPending}
        className="w-full h-14 rounded-xl border border-crimson/70 bg-crimson/10 text-crimson font-semibold flex items-center justify-center gap-2 disabled:opacity-50 active:bg-crimson/20"
      >
        <LogOut className="h-5 w-5" /> {logout.isPending ? "Logging out…" : confirmLogout ? "Tap again to log out" : "Logout"}
      </button>
      <p className="text-center text-[11px] text-white/45">Security (2FA), KYC and language options are coming soon.</p>
    </div>
  );
}
