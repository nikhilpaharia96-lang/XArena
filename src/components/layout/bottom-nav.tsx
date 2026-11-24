"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { House, Trophy, UsersRound, WalletCards, UserRound, type LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
}

// Exactly the 5 items the reference design specifies. Games, Leaderboard
// and tournament creation stay reachable via the top-bar nav, the mobile
// menu and the homepage sections — this bar intentionally doesn't carry
// them.
const items: NavItem[] = [
  { href: "/", label: "Home", icon: House, isActive: (p) => p === "/" },
  { href: "/tournaments", label: "Tournaments", icon: Trophy, isActive: (p) => p.startsWith("/tournaments") },
  { href: "/teams", label: "Teams", icon: UsersRound, isActive: (p) => p.startsWith("/teams") },
  { href: "/wallet", label: "Wallet", icon: WalletCards, isActive: (p) => p.startsWith("/wallet") },
  { href: "/profile", label: "Profile", icon: UserRound, isActive: (p) => p.startsWith("/profile") },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="nav-flat fixed bottom-0 left-0 right-0 z-40 sm:hidden safe-bottom">
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-col items-center justify-center gap-1 pt-2.5 pb-2 min-h-[60px] focus-visible:outline-none focus-visible:bg-white/5 active:opacity-70 transition-opacity"
            >
              {active && (
                <motion.span
                  layoutId="bottom-nav-indicator"
                  className="absolute top-0 h-[3px] w-9 rounded-b-full bg-gradient-to-r from-cobalt to-violet shadow-[0_2px_10px_rgba(59,130,246,0.7)]"
                  transition={{ type: "spring", stiffness: 500, damping: 36 }}
                />
              )}
              <Icon
                className="h-6 w-6 transition-colors"
                style={{ color: active ? "var(--color-nav-active)" : "var(--nav-flat-inactive)" }}
                strokeWidth={active ? 2.2 : 1.7}
              />
              <span
                className="text-[11px] leading-none font-semibold text-center transition-colors"
                style={{ color: active ? "var(--color-nav-active-label)" : "var(--nav-flat-inactive)" }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
