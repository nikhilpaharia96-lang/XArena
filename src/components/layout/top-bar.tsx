"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bell, Search, Menu, Plus, Wallet as WalletIcon } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { formatPaise } from "@/lib/format";
import { cn } from "@/lib/cn";
import { MobileMenu } from "./mobile-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const navLinks = [
  { href: "/tournaments", label: "Tournaments" },
  { href: "/games", label: "Games" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/referral", label: "Refer & Earn" },
];

const iconBtn =
  "relative h-10 w-10 rounded-full flex items-center justify-center text-white/80 hover:bg-white/8 active:bg-white/12 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/60";

export function TopBar() {
  const { data: me } = useCurrentUser();
  const { data: notifData } = useNotifications();
  const pathname = usePathname();
  const unread = notifData?.unreadCount ?? 0;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="app-topbar sticky top-0 z-30 border-b border-white/[0.07] safe-top">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-2 pl-1.5 pr-3 sm:px-4 h-14 sm:h-16">
          <div className="flex items-center gap-0.5 sm:gap-3 min-w-0">
            <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className={cn(iconBtn, "sm:hidden")}>
              <Menu className="h-[22px] w-[22px]" />
            </button>
            <Link href="/" aria-label="XArena home" className="flex items-center shrink-0">
              <Image
                src="/images/xarena-logo.webp"
                alt="XArena"
                width={360}
                height={106}
                priority
                className="h-7 max-[379px]:h-6 w-auto sm:h-9"
              />
            </Link>
          </div>

          <nav aria-label="Main" className="hidden sm:flex items-center gap-1">
            {navLinks.map((l) => {
              const active = pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors",
                    active ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/5"
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
            <ThemeToggle className={cn(iconBtn, "max-sm:hidden")} />
            <Link href="/search" aria-label="Search" className={cn(iconBtn, "max-[349px]:hidden")}>
              <Search className="h-5 w-5" />
            </Link>
            {me ? (
              <>
                <Link
                  href="/wallet"
                  aria-label="Wallet balance, add money"
                  className="mx-0.5 flex items-center gap-1.5 rounded-full bg-white/[0.07] border border-white/10 pl-2.5 pr-1 h-9 max-[379px]:pl-2 hover:bg-white/10 active:bg-white/12 transition-colors"
                >
                  <WalletIcon className="h-4 w-4 text-signal" />
                  <span className="text-[13px] font-mono font-bold text-white tabular-nums">
                    {formatPaise(me.wallet.depositBalance + me.wallet.winningBalance + me.wallet.bonusBalance)}
                  </span>
                  <span className="h-7 w-7 rounded-full gradient-brand flex items-center justify-center">
                    <Plus className="h-4 w-4 text-white" strokeWidth={2.75} />
                  </span>
                </Link>
                <Link
                  href="/notifications"
                  aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
                  className={iconBtn}
                >
                  <Bell className="h-5 w-5" />
                  {unread > 0 && (
                    <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-crimson text-[9px] font-bold flex items-center justify-center text-white ring-2 ring-[var(--topbar-bg)]">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
                <Link
                  href="/profile"
                  aria-label="Profile"
                  className="ml-0.5 h-9 w-9 rounded-full gradient-brand flex items-center justify-center text-xs font-bold text-white overflow-hidden ring-2 ring-white/15"
                >
                  {me.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={me.user.avatarUrl} alt={me.user.username} className="h-full w-full object-cover" />
                  ) : (
                    me.user.username[0]?.toUpperCase()
                  )}
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="ml-1 rounded-full gradient-brand px-5 h-9 flex items-center text-sm font-semibold text-white"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
