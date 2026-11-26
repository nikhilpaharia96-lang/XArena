"use client";

import Link from "next/link";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useProfile } from "@/hooks/use-profile";
import { useLoyalty } from "@/hooks/use-loyalty";
import { LevelCard } from "@/components/rewards/level-card";
import { useLogout } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast-store";
import { useTheme } from "@/lib/theme";
import { Avatar, Panel, SectionTitle, SettingsRow } from "@/components/profile/parts";
import {
  Settings, User, ShieldCheck, Wallet, BadgeCheck, Bell, Globe, Moon, Sun, Lock,
  Headphones, FileText, Info, LogOut, ChevronRight, Copy, SlidersHorizontal, CircleHelp, Undo2,
} from "lucide-react";

export default function ProfilePage() {
  useRequireAuth();
  const { theme, setTheme } = useTheme();
  const { data, isLoading } = useProfile();
  const { data: loyalty } = useLoyalty();
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

  const { profile } = data;
  const name = profile.displayName ?? profile.username;
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
      </div>

      {loyalty && <LevelCard data={loyalty} href="/rewards" className="mt-3" />}

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
                        ? "flex items-center gap-1 rounded-lg bg-cobalt px-3 py-1.5 text-[#FFFFFF]"
                        : "flex items-center gap-1 rounded-lg px-3 py-1.5 text-white/60"
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
