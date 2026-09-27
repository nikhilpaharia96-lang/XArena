import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

/** Shared "Title ... View All →" row used across every home section. */
export function SectionHeader({
  title,
  href,
  icon: Icon,
  badge,
}: {
  title: string;
  href?: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-base font-bold text-white flex items-center gap-1.5">
        {badge}
        {Icon && <Icon className="h-4 w-4 text-gold" />}
        {title}
      </h2>
      {href && (
        <Link href={href} className="text-xs text-violet font-semibold flex items-center gap-0.5 shrink-0">
          View All <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
