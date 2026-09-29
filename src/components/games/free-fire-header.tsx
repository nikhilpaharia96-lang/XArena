"use client";

import Link from "next/link";
import { ArrowLeft, Search, SlidersHorizontal } from "lucide-react";

const btn = "h-10 w-10 rounded-full bg-surface border border-white/8 flex items-center justify-center shrink-0";

/** In-page header: back, title, and optional search / filter actions. */
export function FreeFireHeader({
  title,
  backHref,
  onSearch,
  onFilter,
}: {
  title: string;
  backHref: string;
  onSearch?: () => void;
  onFilter?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <Link href={backHref} aria-label="Back" className={btn}>
        <ArrowLeft className="h-5 w-5 text-white" />
      </Link>
      <h1 className="flex-1 min-w-0 truncate text-xl font-black text-white">{title}</h1>
      {onSearch && (
        <button onClick={onSearch} aria-label="Search tournaments" className={btn}>
          <Search className="h-4 w-4 text-white" />
        </button>
      )}
      {onFilter && (
        <button onClick={onFilter} aria-label="Filters" className={btn}>
          <SlidersHorizontal className="h-4 w-4 text-white" />
        </button>
      )}
    </div>
  );
}
