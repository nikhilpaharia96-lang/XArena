"use client";
import { useState } from "react";
import { useBroadcastNotification } from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import { Megaphone } from "lucide-react";

export default function AdminNotificationsPage() {
  const broadcast = useBroadcastNotification();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState("all");

  const handleSend = () => {
    if (title.length < 1 || body.length < 1) {
      toast({ title: "Title and message are required", tone: "error" });
      return;
    }
    broadcast.mutate(
      { title, body, target },
      {
        onSuccess: (data) => {
          const d = data as { recipientCount: number };
          toast({ title: "Broadcast sent", description: `Delivered to ${d.recipientCount} users`, tone: "success" });
          setTitle(""); setBody("");
        },
        onError: (err) => toast({ title: "Failed to send", description: err instanceof ApiClientError ? err.message : "", tone: "error" }),
      }
    );
  };

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-black text-white flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-violet" /> Broadcast Notification
      </h1>
      <p className="text-sm text-white/40">
        Sends an in-app notification to the selected audience immediately. Push delivery via FCM requires Firebase credentials (see README).
      </p>

      <Card className="p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-white/60 mb-1.5 block">Audience</label>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full h-12 rounded-xl bg-surface-2 border border-white/10 px-4 text-sm text-white">
            <option value="all">All Users</option>
            <option value="active">Active Users Only</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-white/60 mb-1.5 block">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New feature announcement!" />
        </div>
        <div>
          <label className="text-xs font-semibold text-white/60 mb-1.5 block">Message</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="w-full rounded-xl bg-surface-2 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-violet/60" />
        </div>
        <Button fullWidth loading={broadcast.isPending} onClick={handleSend}>Send Broadcast</Button>
      </Card>
    </div>
  );
}
