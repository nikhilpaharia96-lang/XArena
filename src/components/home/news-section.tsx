"use client";

import { Megaphone } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { formatRelativeTime } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionHeader } from "./section-header";

/**
 * Real data: notifications of type ANNOUNCEMENT already exist in the
 * schema/API (Notification.type includes ANNOUNCEMENT). No new endpoint
 * needed. Signed-out visitors get an empty state, since notifications
 * require a session.
 */
export function NewsSection() {
  const { data: me } = useCurrentUser();
  const { data, isLoading } = useNotifications();
  const announcements = data?.notifications.filter((n) => n.type === "ANNOUNCEMENT").slice(0, 3) ?? [];

  return (
    <section>
      <SectionHeader title="News & Updates" href={me ? "/notifications" : undefined} />

      {!me ? (
        <EmptyState icon={Megaphone} title="Log in for the latest updates" description="Tournament announcements and platform news will show up here." className="py-8" />
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : announcements.length > 0 ? (
        <div className="space-y-2">
          {announcements.map((n) => (
            <div key={n.id} className="rounded-2xl bg-surface border border-white/8 p-3.5 flex gap-3">
              <div className="h-9 w-9 rounded-xl bg-violet/15 flex items-center justify-center shrink-0">
                <Megaphone className="h-4 w-4 text-violet" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{n.title}</p>
                <p className="text-xs text-white/50 line-clamp-1">{n.body}</p>
                <p className="text-[10px] text-white/35 mt-0.5">{formatRelativeTime(n.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Megaphone} title="Nothing new right now" description="Check back soon for announcements and platform updates." className="py-8" />
      )}
    </section>
  );
}
