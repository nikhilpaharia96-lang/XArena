"use client";
import { Bell, Trophy, Wallet, Gift, KeyRound, Megaphone } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { NotificationRow } from "@/hooks/use-notifications";

const iconMap: Record<string, typeof Bell> = {
  TOURNAMENT_REMINDER: Bell,
  ROOM_RELEASED: KeyRound,
  DEPOSIT_PENDING: Wallet,
  DEPOSIT_SUCCESS: Wallet,
  DEPOSIT_REJECTED: Wallet,
  WITHDRAW_SUCCESS: Wallet,
  WITHDRAW_REJECTED: Wallet,
  RESULT_PUBLISHED: Trophy,
  WINNER_ANNOUNCEMENT: Trophy,
  REFERRAL_BONUS: Gift,
  ANNOUNCEMENT: Megaphone,
  SYSTEM: Bell,
};

export function NotificationItem({ notification, onClick }: { notification: NotificationRow; onClick?: () => void }) {
  const Icon = iconMap[notification.type] ?? Bell;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-start gap-3 p-4 rounded-2xl transition-colors",
        notification.isRead ? "bg-white/[0.02]" : "bg-violet/[0.08] border border-violet/20"
      )}
    >
      <div className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-violet" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{notification.title}</p>
        <p className="text-xs text-white/50 mt-0.5">{notification.body}</p>
        <p className="text-[10px] text-white/30 mt-1">{formatRelativeTime(notification.createdAt)}</p>
      </div>
      {!notification.isRead && <span className="h-2 w-2 rounded-full bg-violet shrink-0 mt-1" />}
    </button>
  );
}
