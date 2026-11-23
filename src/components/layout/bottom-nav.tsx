"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
              className="flex flex-col items-center justify-center gap-1.5 pt-3 pb-2.5 min-h-[64px] focus-visible:outline-none focus-visible:bg-white/5 active:opacity-70 transition-opacity"
            >
              <Icon
                className="h-[26px] w-[26px] transition-colors"
                style={{ color: active ? "#FFFFFF" : "var(--nav-flat-inactive)" }}
                strokeWidth={active ? 2 : 1.7}
              />
              <span
                className="text-[12px] leading-none font-semibold text-center transition-colors"
                style={{ color: active ? "#FFFFFF" : "var(--nav-flat-inactive)" }}
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
