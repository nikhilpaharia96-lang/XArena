"use client";

import Link from "next/link";
import { Megaphone } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { formatRelativeTime } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "./section-header";

/**
 * Real data: notifications of type ANNOUNCEMENT already exist in the
 * schema/API. No new endpoint needed. Signed-out visitors get an empty
 * state, since notifications require a session.
 */
export function NewsSection() {
  const { data: me } = useCurrentUser();
  const { data, isLoading } = useNotifications();
  const announcements = data?.notifications.filter((n) => n.type === "ANNOUNCEMENT").slice(0, 3) ?? [];

  return (
    <section>
      <SectionHeader title="Latest News & Updates" href={me ? "/notifications" : undefined} icon={Megaphone} />

      {!me ? (
        <EmptyState icon={Megaphone} title="Log in for the latest updates" description="Tournament announcements and platform news will show up here." className="py-8" />
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : announcements.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {announcements.map((n) => (
            <Link key={n.id} href="/notifications" className="rounded-2xl bg-surface border border-white/8 overflow-hidden flex flex-col">
              <div className="h-16 gradient-brand flex items-center justify-center">
                <Megaphone className="h-6 w-6 text-white/80" />
              </div>
              <div className="p-3.5">
                <p className="text-sm font-bold text-white leading-snug line-clamp-2">{n.title}</p>
                <p className="text-[10px] text-white/40 mt-1.5">{formatRelativeTime(n.createdAt)}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={Megaphone} title="Nothing new right now" description="Check back soon for announcements and platform updates." className="py-8" />
      )}
    </section>
  );
}
