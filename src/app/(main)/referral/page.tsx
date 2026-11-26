"use client";

import { useRequireAuth } from "@/hooks/use-require-auth";
import { useReferral } from "@/hooks/use-referral";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPaise, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast-store";
import { Copy, Users, Gift, MessageCircle, Send, Check, Trophy } from "lucide-react";
import { cn } from "@/lib/cn";

export default function ReferralPage() {
  useRequireAuth();
  const { data, isLoading } = useReferral();

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard", tone: "success" });
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  const shareText = `Join me on XArena and get a ${formatPaise(data.config.friendRewardPaise)} bonus! Use my referral code ${data.referralCode} or sign up here: ${data.referralLink}`;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="h-14 w-14 rounded-2xl bg-gold/15 mx-auto flex items-center justify-center mb-3">
          <Gift className="h-7 w-7 text-gold" />
        </div>
        <h1 className="text-xl font-black text-white">Refer & Earn</h1>
        <p className="text-sm text-white/50 mt-1">Earn {formatPaise(data.config.referrerRewardPaise)} when a friend joins and adds {formatPaise(data.config.minDepositPaise)}</p>
      </div>

      <Card className="p-5 glow-border">
        <p className="text-xs text-white/50 uppercase tracking-wide mb-2">Your Referral Code</p>
        <div className="flex items-center justify-between bg-surface-2 rounded-xl px-4 py-3 mb-3">
          <span className="font-mono font-black text-2xl gradient-text tracking-widest">{data.referralCode}</span>
          <button onClick={() => copy(data.referralCode)}>
            <Copy className="h-4 w-4 text-white/50" />
          </button>
        </div>
        <Button fullWidth variant="secondary" onClick={() => copy(data.referralLink)}>
          <Copy className="h-4 w-4" /> Copy Referral Link
        </Button>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] font-semibold text-sm"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
        <a
          href={`https://t.me/share/url?url=${encodeURIComponent(data.referralLink)}&text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-[#0088cc]/15 border border-[#0088cc]/30 text-[#0088cc] font-semibold text-sm"
        >
          <Send className="h-4 w-4" /> Telegram
        </a>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-2xl font-black text-white font-mono">{data.qualified}</p>
          <p className="text-[10px] text-white/40 uppercase mt-1">Rewarded</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-2xl font-black text-white font-mono">{data.pending}</p>
          <p className="text-[10px] text-white/40 uppercase mt-1">Pending</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xl leading-8 font-black text-signal font-mono">{formatPaise(data.totalEarned)}</p>
          <p className="text-[10px] text-white/40 uppercase mt-1">Earned</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Trophy className="h-4 w-4 text-gold" />
          <h2 className="font-bold text-white text-sm">Milestone bonuses</h2>
        </div>
        <p className="text-xs text-white/50 mb-3">Extra one-time bonus as more friends join and add money.</p>
        <ul className="space-y-2">
          {data.milestones.map((m) => (
            <li key={m.count} className={cn("force-dark flex items-center gap-3 rounded-xl border px-3 py-2.5", m.reached ? "border-signal/40 bg-[#10261B]" : "border-[#26314F] bg-[#0B1224]")}>
              <span className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", m.reached ? "bg-signal text-black" : "bg-[#1B2440] text-white/50")}>
                {m.reached ? <Check className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{m.count} friends</p>
                <p className="text-xs text-white/55">{m.reached ? "Bonus credited" : `${m.count - data.qualified} more to go`}</p>
              </div>
              <span className="text-sm font-black text-gold">+{formatPaise(m.rewardPaise)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4 text-xs text-white/55 leading-relaxed">
        You earn {formatPaise(data.config.referrerRewardPaise)} and your friend gets {formatPaise(data.config.friendRewardPaise)} once their deposits reach {formatPaise(data.config.minDepositPaise)}.
        Rewards are added to your bonus balance (play only). Fake or self-referred accounts are not rewarded and may lead to account action.
      </Card>

      <div>
        <h2 className="font-bold text-white text-sm mb-3">Invite History</h2>
        {data.invites.length > 0 ? (
          <Card className="p-4 divide-y divide-white/5">
            {data.invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 py-3">
                <div className="h-9 w-9 rounded-full gradient-brand flex items-center justify-center text-xs font-bold text-white">
                  {inv.username[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{inv.username}</p>
                  <p className="text-xs text-white/40">Joined {formatDateTime(inv.createdAt)}</p>
                </div>
                {inv.bonusPaidAt ? (
                  <span className="text-sm font-mono font-bold text-signal">+{formatPaise(inv.bonusAmount)}</span>
                ) : (
                  <span className="text-[11px] font-semibold text-white/50">Waiting for deposit</span>
                )}
              </div>
            ))}
          </Card>
        ) : (
          <EmptyState icon={Users} title="No invites yet" description="Share your code to start earning." />
        )}
      </div>
    </div>
  );
}
