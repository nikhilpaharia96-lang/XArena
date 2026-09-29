"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast-store";

/** Section heading with a blue icon, used on both profile screens. */
export function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-lg font-bold text-white mt-6 mb-2 px-1">
      <Icon className="h-5 w-5 text-cobalt" /> {children}
    </h2>
  );
}

/** Rounded navy card that hosts a stack of rows separated by hairlines. */
export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl bg-surface/80 border border-white/10 overflow-hidden divide-y divide-white/8", className)}>
      {children}
    </div>
  );
}

interface RowProps {
  icon: LucideIcon;
  /** tailwind classes for the circular icon chip, e.g. "bg-signal/15 text-signal" */
  chip: string;
  title: string;
  subtitle: string;
  href?: string;
  /** shown as an info toast when the destination isn't built yet */
  soon?: boolean;
  right?: React.ReactNode;
}

/** One settings row: icon chip, title + subtitle, optional right slot, chevron. */
export function SettingsRow({ icon: Icon, chip, title, subtitle, href, soon, right }: RowProps) {
  const body = (
    <>
      <span className={cn("h-11 w-11 shrink-0 rounded-full flex items-center justify-center", chip)}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-[15px] font-semibold text-white">{title}</span>
        <span className="block text-xs text-white/55 truncate">{subtitle}</span>
      </span>
      {right}
      {!right || href ? <ChevronRight className="h-5 w-5 text-white/40 shrink-0" /> : null}
    </>
  );
  const cls = "flex items-center gap-3 px-3.5 py-3 hover:bg-white/[0.03] transition-colors w-full";

  if (href) return <Link href={href} className={cls}>{body}</Link>;
  if (soon) {
    return (
      <button type="button" className={cls} onClick={() => toast({ title: `${title} is coming soon`, tone: "info" })}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** Circular avatar: uploaded image, or gradient with initial. */
export function Avatar({ url, name, size = 72, className }: { url?: string | null; name: string; size?: number; className?: string }) {
  return (
    <span
      style={{ height: size, width: size }}
      className={cn("rounded-full gradient-brand ring-2 ring-cobalt/70 overflow-hidden flex items-center justify-center font-black text-white shrink-0", className)}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span style={{ fontSize: size * 0.42 }}>{name[0]?.toUpperCase()}</span>
      )}
    </span>
  );
}
