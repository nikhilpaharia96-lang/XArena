"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  LayoutDashboard,
  Trophy,
  Users,
  ArrowDownCircle,
  ArrowUpCircle,
  Landmark,
  QrCode,
  ShieldCheck,
  Image as ImageIcon,
  Megaphone,
  LifeBuoy,
  ScrollText,
  FileDown,
  Dices,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { useRequireAdmin } from "@/hooks/use-require-admin";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/tournaments", label: "Tournaments", icon: Trophy },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/deposit-requests", label: "Deposit Requests", icon: Landmark },
  { href: "/admin/payment-settings", label: "Payment Settings", icon: QrCode },
  { href: "/admin/deposits", label: "Razorpay Deposits", icon: ArrowDownCircle },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: ArrowUpCircle },
  { href: "/admin/providers", label: "Game Provider", icon: Dices },
  { href: "/admin/originals", label: "XArena Originals", icon: Dices },
  { href: "/admin/results", label: "Result Verification", icon: ShieldCheck },
  { href: "/admin/banners", label: "Hero Banners", icon: ImageIcon },
  { href: "/admin/notifications", label: "Broadcast", icon: Megaphone },
  { href: "/admin/tickets", label: "Support Tickets", icon: LifeBuoy },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/reports", label: "CSV Reports", icon: FileDown },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: me, isLoading } = useRequireAdmin();

  if (isLoading || !me) {
    return <div className="min-h-screen flex items-center justify-center text-white/40 text-sm">Loading admin panel...</div>;
  }

  return (
    <div className="min-h-screen flex bg-void">
      {/* Sidebar - desktop */}
      <aside className="admin-sidebar flex-col w-64 shrink-0 border-r border-white/8 glass p-4">
        <Link href="/admin" className="flex items-center gap-2 mb-8 px-2">
          <Image src="/images/xarena-mark.png" alt="" width={36} height={25} className="h-7 w-auto shrink-0" />
          <span className="font-display font-extrabold text-white">XArena Admin</span>
        </Link>
        <nav className="flex-1 space-y-1">
          {NAV.map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-medium transition-colors",
                  active ? "bg-violet/15 text-violet" : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <ThemeToggle className="h-10 w-10 rounded-xl flex items-center justify-center text-white/70 hover:bg-white/5" />
        <Link href="/" className="text-xs text-white/40 px-3 mt-4">← Back to app</Link>
      </aside>

      {/* Mobile top bar */}
      <div className="admin-topbar fixed top-0 left-0 right-0 z-40 glass border-b border-white/8 items-center justify-between px-4 h-14">
        <span className="flex items-center gap-2 font-display font-extrabold text-white">
          <Image src="/images/xarena-mark.png" alt="" width={36} height={25} className="h-6 w-auto shrink-0" />
          XArena Admin
        </span>
        <div className="flex items-center gap-1">
          <ThemeToggle className="h-10 w-10 rounded-xl flex items-center justify-center text-white/80" />
          <button aria-label="Menu" onClick={() => setMobileOpen(!mobileOpen)} className="h-10 w-10 flex items-center justify-center">
            <Menu className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="admin-menu fixed top-14 left-0 right-0 z-40 glass border-b border-white/8 p-3 space-y-1 max-h-[70vh] overflow-y-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-medium text-white/70 hover:bg-white/5"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>
      )}

      <main className="admin-main flex-1 min-w-0 p-4 lg:p-8 pt-20 lg:pt-8 max-w-7xl mx-auto w-full">{children}</main>
    </div>
  );
}
