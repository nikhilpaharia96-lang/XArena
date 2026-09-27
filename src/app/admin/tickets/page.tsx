"use client";
import { useState } from "react";
import { useAdminSupportTickets, useUpdateTicket } from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast-store";
import { LifeBuoy } from "lucide-react";

const priorityTone: Record<string, "crimson" | "gold" | "cobalt" | "neutral"> = {
  URGENT: "crimson", HIGH: "gold", MEDIUM: "cobalt", LOW: "neutral",
};

function TicketRow({ t }: { t: { id: string; subject: string; message: string; status: string; priority: string; createdAt: string; username: string; email: string } }) {
  const update = useUpdateTicket(t.id);
  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-white">{t.subject}</p>
          <p className="text-xs text-white/40">{t.username} ({t.email}) · {formatDateTime(t.createdAt)}</p>
        </div>
        <Badge tone={priorityTone[t.priority] ?? "neutral"}>{t.priority}</Badge>
      </div>
      <p className="text-sm text-white/60 mt-2">{t.message}</p>
      <select
        value={t.status}
        onChange={(e) => update.mutate({ status: e.target.value }, { onSuccess: () => toast({ title: "Ticket updated", tone: "success" }) })}
        className="mt-3 h-9 rounded-lg bg-surface-2 border border-white/10 px-3 text-xs text-white"
      >
        {["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
      </select>
    </div>
  );
}

export default function AdminTicketsPage() {
  const [status, setStatus] = useState<string | undefined>(undefined);
  const { data, isLoading } = useAdminSupportTickets(status);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-white">Support Tickets</h1>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {[undefined, "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => (
          <button key={s ?? "all"} onClick={() => setStatus(s)} className={`px-3.5 h-8 rounded-full text-xs font-semibold whitespace-nowrap border ${status === s ? "gradient-brand text-white border-transparent" : "bg-white/5 text-white/60 border-white/10"}`}>
            {s ? s.replace("_", " ") : "All"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : data && data.length > 0 ? (
        <Card className="divide-y divide-white/5">{data.map((t) => <TicketRow key={t.id} t={t} />)}</Card>
      ) : (
        <EmptyState icon={LifeBuoy} title="No tickets found" />
      )}
    </div>
  );
}
