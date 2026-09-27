"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useAdminTournamentDetail, useTournamentAction } from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPaise, formatDateTime, statusLabel } from "@/lib/format";
import { toast } from "@/lib/toast-store";
import { ArrowLeft, KeyRound } from "lucide-react";

interface Participant {
  id: string;
  teamName: string | null;
  status: string;
  joinedAt: string;
  username: string;
  email: string;
}

export default function AdminTournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading } = useAdminTournamentDetail(id);
  const releaseRoom = useTournamentAction(id, "room");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [roomPassword, setRoomPassword] = useState("");

  if (isLoading || !data) {
    return <Skeleton className="h-96 rounded-2xl" />;
  }

  const t = data as unknown as {
    id: string; title: string; status: string; slug: string; entryFee: number; prizePool: number;
    maxSlots: number; slotsFilled: number; matchStartsAt: string; roomId: string | null; roomPassword: string | null;
    participants: Participant[];
  };

  const handleReleaseRoom = () => {
    if (!roomId || !roomPassword) {
      toast({ title: "Enter both room ID and password", tone: "error" });
      return;
    }
    releaseRoom.mutate(
      { roomId, roomPassword },
      {
        onSuccess: () => {
          toast({ title: "Room released to all participants", tone: "success" });
          setDialogOpen(false);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <Link href="/admin/tournaments" className="flex items-center gap-1.5 text-sm text-white/50">
        <ArrowLeft className="h-4 w-4" /> Back to Tournaments
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">{t.title}</h1>
          <p className="text-sm text-white/40 mt-1">
            <Badge tone="violet">{statusLabel(t.status)}</Badge>
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <KeyRound className="h-4 w-4" /> {t.roomId ? "Update Room" : "Release Room"}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="font-mono font-bold text-white">{formatPaise(t.entryFee)}</p>
          <p className="text-[11px] text-white/40 uppercase mt-1">Entry Fee</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="font-mono font-bold text-gold">{formatPaise(t.prizePool)}</p>
          <p className="text-[11px] text-white/40 uppercase mt-1">Prize Pool</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="font-mono font-bold text-white">{t.slotsFilled}/{t.maxSlots}</p>
          <p className="text-[11px] text-white/40 uppercase mt-1">Joined</p>
        </Card>
      </div>

      {t.roomId && (
        <Card className="p-4 flex items-center gap-4">
          <span className="text-sm text-white/50">Room ID: <span className="font-mono text-white font-bold">{t.roomId}</span></span>
          <span className="text-sm text-white/50">Password: <span className="font-mono text-white font-bold">{t.roomPassword}</span></span>
        </Card>
      )}

      <div>
        <h2 className="font-bold text-white text-sm mb-3">Participants ({t.participants.length})</h2>
        <Card className="divide-y divide-white/5">
          {t.participants.length === 0 ? (
            <p className="text-sm text-white/40 p-4">No one has joined yet.</p>
          ) : (
            t.participants.map((p) => (
              <div key={p.id} className="p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{p.username}</p>
                  <p className="text-xs text-white/40">{p.email}</p>
                </div>
                <span className="text-xs text-white/30">{formatDateTime(p.joinedAt)}</span>
              </div>
            ))
          )}
        </Card>
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Release Room Details">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-white/60 mb-1.5 block">Room ID</label>
            <Input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="123456789" />
          </div>
          <div>
            <label className="text-xs font-semibold text-white/60 mb-1.5 block">Password</label>
            <Input value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} placeholder="pass123" />
          </div>
          <p className="text-[11px] text-white/35">This will notify all {t.slotsFilled} joined participants instantly.</p>
          <Button fullWidth loading={releaseRoom.isPending} onClick={handleReleaseRoom}>
            Release to Participants
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
