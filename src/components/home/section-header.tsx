import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

/** Shared "Title ... View All →" row used across every home section.
 * A short brand accent bar anchors each section so the page reads as one system. */
export function SectionHeader({
  title,
  href,
  icon: Icon,
  badge,
  subtitle,
}: {
  title: string;
  href?: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4">
      <div className="min-w-0 flex items-stretch gap-2.5">
        <span aria-hidden className="w-1 rounded-full bg-gradient-to-b from-gold to-violet shrink-0" />
        <div className="min-w-0">
          <h2 className="text-[17px] sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5 leading-tight">
            {badge}
            {Icon && <Icon className="h-[18px] w-[18px] text-gold shrink-0" />}
            <span className="truncate">{title}</span>
          </h2>
          {subtitle && <p className="text-xs text-white/50 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className="shrink-0 inline-flex items-center gap-1 rounded-full bg-violet/10 border border-violet/25 px-3 h-8 text-xs font-bold text-cobalt hover:bg-violet/20 transition-colors"
        >
          View All <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
