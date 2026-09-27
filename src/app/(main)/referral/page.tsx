"use client";

import { useRequireAuth } from "@/hooks/use-require-auth";
import { useReferral } from "@/hooks/use-referral";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPaise, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast-store";
import { Copy, Users, Gift, MessageCircle, Send } from "lucide-react";

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

  const shareText = `Join me on XArena and get a bonus! Use my referral code ${data.referralCode} or sign up here: ${data.referralLink}`;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="h-14 w-14 rounded-2xl bg-gold/15 mx-auto flex items-center justify-center mb-3">
          <Gift className="h-7 w-7 text-gold" />
        </div>
        <h1 className="text-xl font-black text-white">Refer & Earn</h1>
        <p className="text-sm text-white/50 mt-1">Earn ₹50 for every friend who joins</p>
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

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-black text-white font-mono">{data.totalInvites}</p>
          <p className="text-[11px] text-white/40 uppercase mt-1">Friends Invited</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-black text-signal font-mono">{formatPaise(data.totalEarned)}</p>
          <p className="text-[11px] text-white/40 uppercase mt-1">Total Earned</p>
        </Card>
      </div>

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
                <span className="text-sm font-mono font-bold text-signal">+{formatPaise(inv.bonusAmount)}</span>
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
