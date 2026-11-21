import Link from "next/link";
import { type LucideIcon } from "lucide-react";

/** Shared "Title ... View all" row used across every home section.
 *  `icon` is still accepted so existing call sites compile, but is no longer drawn —
 *  an icon in front of every heading is what made the page read as templated. */
export function SectionHeader({
  title,
  href,
  badge,
}: {
  title: string;
  href?: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-3 border-b border-white/10 pb-2">
      <h2 className="font-display text-xl font-bold uppercase tracking-wide text-white flex items-center gap-2 leading-none">
        <span className="h-4 w-1 rounded-sm bg-gold" aria-hidden />
        {badge}
        {title}
      </h2>
      {href && (
        <Link href={href} className="text-xs text-white/60 hover:text-white font-medium shrink-0 underline-offset-4 hover:underline">
          View all
        </Link>
      )}
    </div>
  );
}
