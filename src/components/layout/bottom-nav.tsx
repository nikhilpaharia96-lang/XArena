"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Trophy, UsersRound, WalletCards, UserRound, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

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
    <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden safe-bottom px-3 pb-2.5">
      <div className="nav-float rounded-[28px] grid grid-cols-5">
        {items.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/60 rounded-[28px]"
            >
              {active && (
                <motion.span
                  layoutId="bottom-nav-glow"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className="absolute top-1.5 h-8 w-8 rounded-full bg-[var(--color-nav-active)]/18 blur-[2px]"
                />
              )}
              <motion.span
                initial={false}
                animate={{ scale: active ? 1.05 : 1, opacity: active ? 1 : 0.9 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="relative"
              >
                <Icon
                  className={cn("h-[23px] w-[23px]", active && "h-[25px] w-[25px]")}
                  style={{ color: active ? "var(--color-nav-active)" : "var(--color-nav-inactive)" }}
                  strokeWidth={active ? 2.25 : 1.9}
                />
              </motion.span>
              <span
                className={cn(
                  "relative text-[10.5px] xs:text-[11px] leading-tight text-center px-0.5",
                  active ? "font-bold" : "font-medium"
                )}
                style={{ color: active ? "var(--color-nav-active-label)" : "var(--color-nav-inactive)" }}
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
