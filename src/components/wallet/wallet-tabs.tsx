import Link from "next/link";
import { cn } from "@/lib/cn";

/** DEPOSIT | WITHDRAW switcher shown at the top of both money pages. */
export function WalletTabs({ active }: { active: "deposit" | "withdraw" }) {
  const tab = (key: "deposit" | "withdraw", label: string, href: string) => (
    <Link
      href={href}
      replace
      aria-current={active === key ? "page" : undefined}
      className={cn(
        "flex-1 text-center py-3.5 text-sm font-black tracking-wide border-b-2 transition-colors focus-visible:outline-none focus-visible:bg-white/5",
        active === key ? "text-white border-gold" : "text-white/60 border-transparent"
      )}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex rounded-2xl overflow-hidden bg-surface border border-white/10">
      {tab("deposit", "DEPOSIT", "/wallet/deposit")}
      {tab("withdraw", "WITHDRAW", "/wallet/withdraw")}
    </div>
  );
}
