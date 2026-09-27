"use client";

import { use, useState } from "react";
import { useTournamentDetail, useJoinTournament, useSubmitResult } from "@/hooks/use-tournaments";
import { useCurrentUser } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { SlotMeter } from "@/components/tournament/slot-meter";
import { CountdownTimer } from "@/components/tournament/countdown-timer";
import { formatPaise, formatDateTime, gameModeLabel } from "@/lib/format";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import { Copy, Users, MapPin, Trophy, KeyRound, ShieldCheck, ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function TournamentDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { data: me } = useCurrentUser();
  const { data: t, isLoading, isError, refetch } = useTournamentDetail(slug);
  const join = useJoinTournament(slug);
  const submitResult = useSubmitResult(slug);

  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [placement, setPlacement] = useState("");
  const [kills, setKills] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  if (isError || !t) return <ErrorState onRetry={() => refetch()} />;

  const handleJoin = () => {
    if (!me) {
      router.push("/login");
      return;
    }
    join.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "You're in! 🎮", description: "Room details will appear here closer to match time.", tone: "success" });
        setJoinDialogOpen(false);
      },
      onError: (err) => {
        toast({
          title: "Couldn't join",
          description: err instanceof ApiClientError ? err.message : "Please try again.",
          tone: "error",
        });
        setJoinDialogOpen(false);
      },
    });
  };

  const handleSubmitResult = () => {
    if (!screenshotUrl || !kills) {
      toast({ title: "Missing info", description: "Screenshot URL and kills are required.", tone: "error" });
      return;
    }
    submitResult.mutate(
      { placement: placement ? Number(placement) : undefined, kills: Number(kills), screenshotUrl },
      {
        onSuccess: () => {
          toast({ title: "Result submitted!", description: "An admin will verify it shortly.", tone: "success" });
          setResultDialogOpen(false);
        },
        onError: (err) => {
          toast({ title: "Submission failed", description: err instanceof ApiClientError ? err.message : "Try again.", tone: "error" });
        },
      }
    );
  };

  const copyRoom = () => {
    navigator.clipboard.writeText(`Room ID: ${t.roomId}\nPassword: ${t.roomPassword}`);
    toast({ title: "Copied to clipboard", tone: "success" });
  };

  const matchStarted = new Date(t.matchStartsAt) < new Date();
  const registrationOpen = ["PUBLISHED", "REGISTRATION_OPEN"].includes(t.status) && new Date(t.registrationEndsAt) > new Date();

  return (
    <div className="space-y-5 pb-6">
      {/* Hero */}
      <div className="relative h-48 rounded-3xl gradient-brand overflow-hidden flex flex-col justify-end p-5">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="relative z-10 flex items-center gap-2 mb-2">
          <Badge tone={t.format === "FREE" ? "signal" : "gold"}>{t.format === "FREE" ? "Free Entry" : formatPaise(t.entryFee)}</Badge>
          <Badge tone="neutral">{t.gameName}</Badge>
          <Badge tone="violet">{gameModeLabel(t.mode)}</Badge>
        </div>
        <h1 className="relative z-10 text-2xl font-black text-white leading-tight">{t.title}</h1>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="p-3 sm:p-4 text-center min-w-0">
          <Trophy className="h-4 w-4 text-gold mx-auto mb-1" />
          <p className="text-xs sm:text-sm font-bold font-mono text-white truncate px-0.5">{formatPaise(t.prizePool)}</p>
          <p className="text-[9px] sm:text-[10px] text-white/40 uppercase">Prize Pool</p>
        </Card>
        <Card className="p-3 sm:p-4 text-center min-w-0">
          <Users className="h-4 w-4 text-cobalt mx-auto mb-1" />
          <p className="text-xs sm:text-sm font-bold font-mono text-white truncate px-0.5">{t.slotsFilled}/{t.maxSlots}</p>
          <p className="text-[9px] sm:text-[10px] text-white/40 uppercase">Players</p>
        </Card>
        <Card className="p-3 sm:p-4 text-center min-w-0">
          <MapPin className="h-4 w-4 text-violet mx-auto mb-1" />
          <p className="text-xs sm:text-sm font-bold text-white truncate px-0.5">{t.map ?? "TBD"}</p>
          <p className="text-[9px] sm:text-[10px] text-white/40 uppercase">Map</p>
        </Card>
      </div>

      <Card className="p-4">
        <SlotMeter filled={t.slotsFilled} max={t.maxSlots} />
        <div className="flex items-center justify-between mt-3 text-sm">
          <span className="text-white/50">Match starts</span>
          <div className="text-right">
            <p className="text-white font-semibold">{formatDateTime(t.matchStartsAt)}</p>
            <CountdownTimer target={t.matchStartsAt} />
          </div>
        </div>
      </Card>

      {/* Room details - only visible to joined participants once released */}
      {t.isJoined && (
        <Card className="p-4 glow-border">
          <div className="flex items-center gap-2 mb-3">
            <KeyRound className="h-4 w-4 text-signal" />
            <h3 className="font-bold text-white text-sm">Match Room</h3>
          </div>
          {t.roomId ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-surface-2 rounded-xl px-3 py-2">
                <span className="text-xs text-white/50">Room ID</span>
                <span className="font-mono font-bold text-white">{t.roomId}</span>
              </div>
              <div className="flex items-center justify-between bg-surface-2 rounded-xl px-3 py-2">
                <span className="text-xs text-white/50">Password</span>
                <span className="font-mono font-bold text-white">{t.roomPassword}</span>
              </div>
              <Button variant="secondary" size="sm" fullWidth onClick={copyRoom}>
                <Copy className="h-3.5 w-3.5" /> Copy Room Details
              </Button>
            </div>
          ) : (
            <p className="text-sm text-white/50">Room details will be released closer to match time. Check back soon!</p>
          )}
        </Card>
      )}

      {/* Join / Submit result actions */}
      {me && t.isJoined && matchStarted && (
        <Button fullWidth size="lg" variant="secondary" onClick={() => setResultDialogOpen(true)}>
          <ImageIcon className="h-4 w-4" /> Submit Match Result
        </Button>
      )}
      {!t.isJoined && registrationOpen && t.slotsLeft > 0 && (
        <Button fullWidth size="lg" onClick={() => setJoinDialogOpen(true)}>
          Join Tournament — {t.format === "FREE" ? "Free" : formatPaise(t.entryFee)}
        </Button>
      )}
      {!t.isJoined && t.slotsLeft <= 0 && (
        <Button fullWidth size="lg" disabled>
          Tournament Full
        </Button>
      )}

      {/* Description */}
      <Card className="p-4">
        <h3 className="font-bold text-white text-sm mb-2">About</h3>
        <p className="text-sm text-white/60 leading-relaxed whitespace-pre-line">{t.description}</p>
      </Card>

      {/* Prize distribution */}
      <Card className="p-4">
        <h3 className="font-bold text-white text-sm mb-3 flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-gold" /> Prize Distribution
        </h3>
        <div className="space-y-2">
          {t.prizeDistribution.map((p) => (
            <div key={p.position} className="flex items-center justify-between text-sm">
              <span className="text-white/60">#{p.position} Place</span>
              <span className="font-mono font-bold text-gold">{formatPaise(p.amount)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Rules */}
      <Card className="p-4">
        <h3 className="font-bold text-white text-sm mb-2 flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-violet" /> Rules
        </h3>
        <p className="text-sm text-white/60 leading-relaxed whitespace-pre-line">{t.rules}</p>
        {t.scoringSystem && (
          <>
            <h4 className="font-bold text-white text-xs mt-4 mb-1 uppercase tracking-wide text-white/40">Scoring</h4>
            <p className="text-sm text-white/60">{t.scoringSystem}</p>
          </>
        )}
      </Card>

      {/* Participants */}
      <Card className="p-4">
        <h3 className="font-bold text-white text-sm mb-3">Participants ({t.participants.length})</h3>
        {t.participants.length === 0 ? (
          <p className="text-sm text-white/40">No one has joined yet — be the first!</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {t.participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full gradient-brand flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {p.username[0]?.toUpperCase()}
                </div>
                <span className="text-sm text-white/80">{p.username}</span>
                {p.teamName && <span className="text-xs text-white/40">· {p.teamName}</span>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Join confirmation dialog */}
      <Dialog open={joinDialogOpen} onClose={() => setJoinDialogOpen(false)} title="Confirm Join">
        <p className="text-sm text-white/60 mb-4">
          {t.format === "FREE"
            ? "This tournament is free to join."
            : `Joining will deduct ${formatPaise(t.entryFee)} from your wallet.`}
        </p>
        <Button fullWidth loading={join.isPending} onClick={handleJoin}>
          Confirm & Join
        </Button>
      </Dialog>

      {/* Result submission dialog */}
      <Dialog open={resultDialogOpen} onClose={() => setResultDialogOpen(false)} title="Submit Result">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-white/60 mb-1.5 block">Placement (optional)</label>
            <Input type="number" placeholder="1" value={placement} onChange={(e) => setPlacement(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-white/60 mb-1.5 block">Kills</label>
            <Input type="number" placeholder="10" value={kills} onChange={(e) => setKills(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-white/60 mb-1.5 block">Screenshot URL</label>
            <Input placeholder="https://..." value={screenshotUrl} onChange={(e) => setScreenshotUrl(e.target.value)} />
            <p className="text-[11px] text-white/35 mt-1">
              Upload your result screenshot to an image host and paste the link. Direct upload will be enabled once Firebase Storage is configured.
            </p>
          </div>
          <Button fullWidth loading={submitResult.isPending} onClick={handleSubmitResult}>
            Submit Result
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
