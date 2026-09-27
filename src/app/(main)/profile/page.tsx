"use client";

import { useState } from "react";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { useLogout } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { toast } from "@/lib/toast-store";
import { formatPaise } from "@/lib/format";
import { Swords, Trophy, Target, Crosshair, LogOut, Pencil, Check, X } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
  useRequireAuth();
  const { data, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const logout = useLogout();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  const { profile, stats } = data;
  const winRate = stats.matchesPlayed > 0 ? ((stats.wins / stats.matchesPlayed) * 100).toFixed(0) : "0";

  const startEdit = () => {
    setDisplayName(profile.displayName ?? profile.username);
    setEditing(true);
  };

  const saveEdit = () => {
    updateProfile.mutate(
      { displayName },
      {
        onSuccess: () => {
          toast({ title: "Profile updated", tone: "success" });
          setEditing(false);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 gradient-brand opacity-20" />
        <div className="relative z-10">
          <div className="h-20 w-20 rounded-full gradient-brand mx-auto flex items-center justify-center text-3xl font-black text-white mb-3">
            {profile.username[0]?.toUpperCase()}
          </div>
          {editing ? (
            <div className="flex items-center gap-2 justify-center max-w-xs mx-auto">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-10 text-center" />
              <button onClick={saveEdit} className="h-10 w-10 rounded-xl bg-signal/20 flex items-center justify-center shrink-0">
                <Check className="h-4 w-4 text-signal" />
              </button>
              <button onClick={() => setEditing(false)} className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <X className="h-4 w-4 text-white/60" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-xl font-black text-white">{profile.displayName ?? profile.username}</h1>
              <button onClick={startEdit}>
                <Pencil className="h-3.5 w-3.5 text-white/40" />
              </button>
            </div>
          )}
          <p className="text-sm text-white/50 mt-1">@{profile.username}</p>
          <p className="text-xs text-white/30 font-mono mt-1">UID: {profile.uid}</p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Matches Played" value={stats.matchesPlayed} icon={Swords} tone="text-cobalt" />
        <StatCard label="Wins" value={stats.wins} icon={Trophy} tone="text-gold" />
        <StatCard label="Win Rate" value={`${winRate}%`} icon={Target} tone="text-signal" />
        <StatCard label="Total Kills" value={stats.kills} icon={Crosshair} tone="text-crimson" />
      </div>

      <Card className="p-4 flex items-center justify-between">
        <span className="text-sm text-white/50">Total Earnings</span>
        <span className="font-mono font-bold text-signal text-lg">{formatPaise(stats.totalEarnings)}</span>
      </Card>

      <div className="space-y-2">
        <Link href="/my-matches">
          <Card className="p-4 text-sm font-semibold text-white/80">My Matches</Card>
        </Link>
        <Link href="/referral">
          <Card className="p-4 text-sm font-semibold text-white/80">Refer & Earn</Card>
        </Link>
        <Link href="/support">
          <Card className="p-4 text-sm font-semibold text-white/80">Support</Card>
        </Link>
      </div>

      <Button variant="danger" fullWidth onClick={() => logout.mutate()} loading={logout.isPending}>
        <LogOut className="h-4 w-4" /> Log Out
      </Button>
    </div>
  );
}
