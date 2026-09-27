"use client";
import { useState } from "react";
import { useAdminAuditLogs } from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";
import { ScrollText } from "lucide-react";

export default function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminAuditLogs(page);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-white">Audit Logs</h1>
      <p className="text-sm text-white/40 -mt-4">Every admin mutation (bans, wallet adjustments, tournament changes, approvals) is recorded here.</p>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : data && data.logs.length > 0 ? (
        <>
          <Card className="divide-y divide-white/5">
            {data.logs.map((log) => (
              <div key={log.id} className="p-3.5 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-white">{log.action.replace(/_/g, " ")}</p>
                  <p className="text-xs text-white/40">
                    {log.actorUsername ?? "System"} {log.targetType && `→ ${log.targetType}`} {log.ipAddress && `· ${log.ipAddress}`}
                  </p>
                </div>
                <span className="text-xs text-white/30">{formatDateTime(log.createdAt)}</span>
              </div>
            ))}
          </Card>
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-xs text-white/40">Page {data.pagination.page} of {data.pagination.totalPages}</span>
              <Button variant="secondary" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState icon={ScrollText} title="No audit logs yet" />
      )}
    </div>
  );
}
