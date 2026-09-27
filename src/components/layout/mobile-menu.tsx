"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import {
  X,
  Trophy,
  Gamepad2,
  BarChart3,
  Gift,
  Wallet,
  User,
  LifeBuoy,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";
import { cn } from "@/lib/cn";

const links = [
  { href: "/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/leaderboard", label: "Leaderboard", icon: BarChart3 },
  { href: "/referral", label: "Refer & Earn", icon: Gift },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/support", label: "Support", icon: LifeBuoy },
];

export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: me } = useCurrentUser();
  const pathname = usePathname();
  const logout = useLogout();
  const isAdmin = me && ["ADMIN", "SUPER_ADMIN", "MODERATOR"].includes(me.user.role);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            className="fixed inset-y-0 left-0 z-[61] w-[82%] max-w-xs bg-surface border-r border-white/10 flex flex-col safe-top safe-bottom"
          >
            <div className="flex items-center justify-between px-5 h-16 border-b border-white/8">
              <Link href="/" onClick={onClose} className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl gradient-brand flex items-center justify-center font-display font-black text-white text-sm">
                  X
                </div>
                <span className="font-display font-extrabold text-lg tracking-tight text-white">XArena</span>
              </Link>
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="h-9 w-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {me && (
              <div className="px-5 py-4 border-b border-white/8 flex items-center gap-3">
                <div className="h-11 w-11 rounded-full gradient-brand flex items-center justify-center text-sm font-bold text-white overflow-hidden shrink-0">
                  {me.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={me.user.avatarUrl} alt={me.user.username} className="h-full w-full object-cover" />
                  ) : (
                    me.user.username[0]?.toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{me.user.displayName ?? me.user.username}</p>
                  <p className="text-xs text-white/50 truncate">@{me.user.username}</p>
                </div>
              </div>
            )}

            <nav className="flex-1 overflow-y-auto py-2 px-3">
              {links.map((l) => {
                const active = pathname.startsWith(l.href);
                const Icon = l.icon;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium",
                      active ? "bg-violet/12 text-violet" : "text-white/75 hover:bg-white/5"
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                    {l.label}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gold hover:bg-gold/10 mt-1"
                >
                  <ShieldCheck className="h-4.5 w-4.5" />
                  Admin Dashboard
                </Link>
              )}
            </nav>

            <div className="p-3 border-t border-white/8">
              {me ? (
                <button
                  onClick={() => {
                    onClose();
                    logout.mutate();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-crimson hover:bg-crimson/10"
                >
                  <LogOut className="h-4.5 w-4.5" />
                  Log out
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 rounded-xl gradient-brand h-11 text-sm font-semibold text-white"
                >
                  Login / Sign up
                </Link>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
