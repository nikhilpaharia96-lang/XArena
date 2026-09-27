"use client";

import { useRequireAuth } from "@/hooks/use-require-auth";
import { useNotifications, useMarkNotificationRead } from "@/hooks/use-notifications";
import { NotificationItem } from "@/components/notifications/notification-item";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Bell } from "lucide-react";

export default function NotificationsPage() {
  useRequireAuth();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-white">Notifications</h1>
        {data && data.unreadCount > 0 && <span className="text-xs text-violet font-semibold">{data.unreadCount} unread</span>}
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
