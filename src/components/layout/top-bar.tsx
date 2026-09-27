"use client";

import Link from "next/link";
import { Bell, Wallet as WalletIcon } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { formatPaise } from "@/lib/format";

export function TopBar() {
  const { data: me } = useCurrentUser();
  const { data: notifData } = useNotifications();
  const unread = notifData?.unreadCount ?? 0;

  return (
    <header className="sticky top-0 z-30 glass border-b border-white/8">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 h-16">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl gradient-brand flex items-center justify-center font-display font-black text-white text-sm">
            X
          </div>
          <span className="font-display font-extrabold text-lg tracking-tight text-white hidden sm:inline">
            XArena
          </span>
        </Link>

        <nav className="hidden sm:flex items-center gap-1">
          {[
            { href: "/tournaments", label: "Tournaments" },
            { href: "/games", label: "Games" },
            { href: "/leaderboard", label: "Leaderboard" },
            { href: "/referral", label: "Refer & Earn" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="px-3 py-2 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/5">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {me ? (
            <>
              <Link
                href="/wallet"
                className="hidden xs:flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3 h-9 text-sm font-mono font-semibold text-signal"
              >
                <WalletIcon className="h-3.5 w-3.5" />
                {formatPaise(me.wallet.depositBalance + me.wallet.winningBalance + me.wallet.bonusBalance)}
              </Link>
              <Link href="/notifications" className="relative h-9 w-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <Bell className="h-4 w-4 text-white/70" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-crimson text-[9px] font-bold flex items-center justify-center text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <Link href="/profile" className="h-9 w-9 rounded-full gradient-brand flex items-center justify-center text-xs font-bold text-white">
                {me.user.username[0]?.toUpperCase()}
              </Link>
            </>
          ) : (
            <Link href="/login" className="rounded-xl gradient-brand px-4 h-9 flex items-center text-sm font-semibold text-white">
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
