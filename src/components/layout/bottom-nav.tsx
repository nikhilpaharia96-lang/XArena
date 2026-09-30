"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, Plus, BarChart3, User, Gamepad2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { motion } from "framer-motion";
import { useCurrentUser } from "@/hooks/use-auth";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/leaderboard", label: "Leaderboard", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const { data: me } = useCurrentUser();
  const isAdmin = me && ["ADMIN", "SUPER_ADMIN", "MODERATOR"].includes(me.user.role);

  // The centre action is a real, connected route: privileged accounts jump
  // straight into tournament creation, everyone else jumps into game/mode
  // discovery (there is no public "create tournament" flow in this app yet
  // — only admins/moderators can create tournaments, so we never point a
  // regular player at a page that would 403 them).
  const center = isAdmin
    ? { href: "/admin/tournaments/new", label: "Create", icon: Plus }
    : { href: "/games", label: "Games", icon: Gamepad2 };

  const centerActive = pathname.startsWith(center.href);

  return (
    <nav aria-label="Primary" className="fixed bottom-0 left-0 right-0 z-40 sm:hidden safe-bottom bg-void/85 backdrop-blur-xl border-t border-white/10">
      <div className="px-2">
        <div className="flex items-end justify-between px-1 pt-2 pb-2 relative">
          {items.slice(0, 2).map((item) => (
            <NavItem key={item.href} item={item} active={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)} />
          ))}

          <Link href={center.href} aria-current={centerActive ? "page" : undefined} className="flex flex-col items-center gap-1 -mt-6">
            <motion.div
              whileTap={{ scale: 0.9 }}
              className={cn(
                "h-14 w-14 rounded-2xl flex items-center justify-center border-4 border-void transition-shadow duration-200",
                isAdmin
                  ? "gradient-cta shadow-[0_8px_24px_-6px_rgba(249,115,22,0.7)]"
                  : centerActive
                    ? "gradient-brand ring-2 ring-cobalt/70 shadow-[0_0_28px_-2px_rgba(59,130,246,0.95)]"
                    : "gradient-brand shadow-[0_8px_24px_-6px_rgba(37,99,235,0.7)]"
              )}
            >
              <center.icon className="h-6 w-6 text-white" />
            </motion.div>
            <span className={cn("text-[10px] font-medium transition-colors", centerActive ? "text-gold font-semibold" : "text-white/50")}>
              {center.label}
            </span>
          </Link>

          {items.slice(2).map((item) => (
            <NavItem key={item.href} item={item} active={pathname.startsWith(item.href)} />
          ))}
        </div>
      </div>
    </nav>
  );
}

function NavItem({ item, active }: { item: { href: string; label: string; icon: typeof Home }; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className="flex flex-col items-center gap-1 py-1.5 px-3 min-w-[56px] relative">
      <Icon className={cn("h-5 w-5 transition-colors", active ? "text-violet" : "text-white/45")} />
      <span className={cn("text-[10px] font-medium", active ? "text-violet" : "text-white/45")}>{item.label}</span>
      {active && <span className="absolute -bottom-0 h-0.5 w-8 rounded-full gradient-brand" />}
    </Link>
  );
}
