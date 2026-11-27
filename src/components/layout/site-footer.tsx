import Link from "next/link";
import Image from "next/image";

const LINKS = [
  { href: "/tournaments", label: "Tournaments" },
  { href: "/games", label: "Games" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/referral", label: "Refer & Earn" },
  { href: "/support", label: "Support" },
];

const LEGAL = [
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refund", label: "Refund Policy" },
];

export function SiteFooter() {
  return (
    <footer className="site-footer mt-12 border-t border-white/10 pt-6 pb-2">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link href="/" aria-label="XArena home">
          <Image src="/images/xarena-logo.webp" alt="XArena" width={360} height={106} className="h-7 w-auto" />
        </Link>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-1">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-xs font-semibold text-white/60 hover:text-white py-3">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <nav aria-label="Legal" className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {LEGAL.map((l) => (
          <Link key={l.href} href={l.href} className="text-[11px] font-semibold text-white/55 hover:text-white py-3">
            {l.label}
          </Link>
        ))}
      </nav>
      <p className="mt-2 text-[11px] leading-relaxed text-white/45">
        <span className="font-bold text-white/70">18+ only.</span> Tournaments with an entry fee involve real money — play responsibly and only
        with what you can afford. Availability of paid contests can depend on your state&apos;s laws; please check the rules that apply to you
        before joining.
      </p>
      <p className="mt-2 text-[11px] text-white/35">© {new Date().getFullYear()} XArena. All rights reserved.</p>
    </footer>
  );
}
