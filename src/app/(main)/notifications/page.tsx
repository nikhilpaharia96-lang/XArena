"use client";

import { useRequireAuth } from "@/hooks/use-require-auth";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/hooks/use-notifications";
import { NotificationItem } from "@/components/notifications/notification-item";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Bell } from "lucide-react";

export default function NotificationsPage() {
  useRequireAuth();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-white">Notifications</h1>
        {data && data.unreadCount > 0 && (
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="h-10 px-3 -mr-3 rounded-xl text-xs text-violet font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
          >
            Mark all read ({data.unreadCount})
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : data && data.notifications.length > 0 ? (
        <div className="space-y-2">
          {data.notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} onClick={() => !n.isRead && markRead.mutate(n.id)} />
          ))}
        </div>
      ) : (
        <EmptyState icon={Bell} title="No notifications yet" description="Tournament updates and wallet activity will show up here." />
      )}
    </div>
  );
}
