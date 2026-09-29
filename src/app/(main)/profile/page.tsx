"use client";

import Link from "next/link";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useProfile } from "@/hooks/use-profile";
import { useLogout } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast-store";
import { Avatar, Panel, SectionTitle, SettingsRow } from "@/components/profile/parts";
import {
  Settings, User, ShieldCheck, Wallet, BadgeCheck, Bell, Globe, Moon, Sun, Lock,
  Headphones, FileText, Info, LogOut, ChevronRight, Copy, Crown, SlidersHorizontal, CircleHelp,
} from "lucide-react";

const XP_PER_LEVEL = 1000;

export default function ProfilePage() {
  useRequireAuth();
  const { data, isLoading } = useProfile();
  const logout = useLogout();

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const { profile, stats } = data;
  const name = profile.displayName ?? profile.username;
  // Level is derived from activity: no separate XP column exists yet.
  const xp = stats.matchesPlayed * 20 + stats.wins * 80 + stats.kills * 2;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpInLevel = xp % XP_PER_LEVEL;

  const copyUid = async () => {
    try {
      await navigator.clipboard.writeText(profile.uid);
      toast({ title: "User ID copied", tone: "success" });
    } catch {
      toast({ title: "Couldn't copy User ID", tone: "error" });
    }
  };

  return (
    <div className="mx-auto w-full max-w-xl pb-6">
      <h1 className="flex items-center gap-2.5 text-3xl font-black text-white">
        <Settings className="h-7 w-7 text-cobalt" /> Settings
      </h1>
      <p className="text-sm text-white/60 mt-1">Manage your account, preferences and app settings</p>

      {/* profile summary */}
      <div className="mt-5 rounded-2xl bg-surface/80 border border-cobalt/30 shadow-[0_8px_30px_-12px_rgba(37,99,235,0.5)] overflow-hidden">
        <Link href="/profile/account" className="flex items-center gap-4 p-4">
          <Avatar url={profile.avatarUrl} name={name} size={72} />
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold text-white truncate">{name}</p>
            <p className="text-sm text-white/60 truncate">{profile.email}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/60">
              User ID: <span className="font-mono">{profile.uid}</span>
              <button
                type="button"
                aria-label="Copy user ID"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); void copyUid(); }}
                className="text-white/50 hover:text-white"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/50 shrink-0" />
        </Link>
        <div className="flex items-center gap-3 px-4 pb-3.5 text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-gold whitespace-nowrap">
            <Crown className="h-4 w-4" /> Level {level}
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={xpInLevel} aria-valuemax={XP_PER_LEVEL}>
            <div className="h-full rounded-full bg-cobalt" style={{ width: `${(xpInLevel / XP_PER_LEVEL) * 100}%` }} />
          </div>
          <span className="text-xs text-white/60 whitespace-nowrap">
            {xpInLevel.toLocaleString("en-IN")} / {XP_PER_LEVEL.toLocaleString("en-IN")} XP
          </span>
        </div>
      </div>

      <SectionTitle icon={User}>Account</SectionTitle>
      <Panel>
        <SettingsRow icon={User} chip="bg-cobalt/15 text-cobalt" title="Account Settings" subtitle="Edit profile, email, phone" href="/profile/account" />
        <SettingsRow icon={ShieldCheck} chip="bg-signal/15 text-signal" title="Security" subtitle="Change password, 2FA, devices" soon />
        <SettingsRow icon={Wallet} chip="bg-gold/15 text-gold" title="Wallet & Payments" subtitle="Manage wallet, payment methods" href="/wallet" />
        <SettingsRow icon={BadgeCheck} chip="bg-violet/20 text-cobalt" title="KYC Verification" subtitle="Verify your identity" soon />
      </Panel>

      <SectionTitle icon={SlidersHorizontal}>App Preferences</SectionTitle>
      <Panel>
        <SettingsRow icon={Bell} chip="bg-crimson/15 text-crimson" title="Notifications" subtitle="Manage push and email notifications" href="/notifications" />
        <SettingsRow icon={Globe} chip="bg-cobalt/15 text-cobalt" title="Language" subtitle="Choose your preferred language" soon />
        <SettingsRow
          icon={Moon}
          chip="bg-violet/20 text-cobalt"
          title="Theme"
          subtitle="Dark / Light mode"
          right={
            <div className="flex rounded-xl bg-surface-2 border border-white/10 p-0.5 text-xs font-semibold">
              <span className="flex items-center gap-1 rounded-lg bg-cobalt px-3 py-1.5 text-white"><Moon className="h-3.5 w-3.5" /> Dark</span>
              <button
                type="button"
                onClick={() => toast({ title: "Light mode is coming soon", tone: "info" })}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-white/60"
              >
                <Sun className="h-3.5 w-3.5" /> Light
              </button>
            </div>
          }
        />
        <SettingsRow icon={Lock} chip="bg-violet/20 text-cobalt" title="Privacy" subtitle="Privacy settings and data control" soon />
      </Panel>

      <SectionTitle icon={CircleHelp}>Support &amp; Info</SectionTitle>
      <Panel>
        <SettingsRow icon={Headphones} chip="bg-gold/15 text-gold" title="Help & Support" subtitle="Get help or contact support" href="/support" />
        <SettingsRow icon={FileText} chip="bg-cobalt/15 text-cobalt" title="Terms & Conditions" subtitle="Read our terms and policies" soon />
        <SettingsRow icon={Info} chip="bg-cobalt/15 text-cobalt" title="About XArena" subtitle="App version, legal info" soon />
      </Panel>

      <button
        type="button"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        className="mt-5 w-full h-14 rounded-xl border border-crimson/70 bg-crimson/10 text-crimson font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <LogOut className="h-5 w-5" /> {logout.isPending ? "Logging out…" : "Logout"}
      </button>
    </div>
  );
}
