"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, Wallet, User, Gamepad2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { motion } from "framer-motion";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/games", label: "Games", icon: Gamepad2, center: true },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden">
      <div className="glass border-t border-white/10 px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-end justify-between px-1 pt-2 pb-2 relative">
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;

            if (item.center) {
              return (
                <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 -mt-6">
                  <motion.div
                    whileTap={{ scale: 0.9 }}
                    className="h-14 w-14 rounded-2xl gradient-brand flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(124,92,246,0.7)] border-4 border-void"
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </motion.div>
                  <span className={cn("text-[10px] font-medium", active ? "text-violet" : "text-white/50")}>{item.label}</span>
                </Link>
              );
            }

            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 py-1.5 px-3 min-w-[56px]">
                <Icon className={cn("h-5 w-5", active ? "text-violet" : "text-white/45")} />
                <span className={cn("text-[10px] font-medium", active ? "text-violet" : "text-white/45")}>{item.label}</span>
                {active && <span className="absolute -bottom-0 h-0.5 w-8 rounded-full gradient-brand" />}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
