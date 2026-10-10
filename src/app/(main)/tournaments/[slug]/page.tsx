"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useTournamentDetail, useSubmitResult, type TournamentDetail } from "@/hooks/use-tournaments";
import { useCurrentUser } from "@/hooks/use-auth";
import { useFavoriteTournament } from "@/hooks/use-favorite-tournament";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Collapsible } from "@/components/ui/collapsible";
import { SlotMeter } from "@/components/tournament/slot-meter";
import { CountdownBlocks } from "@/components/tournament/countdown-blocks";
import { posterForGame } from "@/components/home/game-card";
import { formatPaise, formatDateTime, gameModeLabel } from "@/lib/format";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import {
  ArrowLeft,
  Share2,
  Heart,
  Copy,
  Users,
  MapPin,
  Trophy,
  KeyRound,
  ShieldCheck,
  ImageIcon,
  Clock,
  Info,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

/** Single source of truth for the tournament's visual/behavioural state,
 * derived from real backend fields only (status + slots + dates) — never
 * hardcoded. Used by the hero status badge, the countdown card header and
 * the join CTA so all three always agree with each other. */
function deriveTournamentState(t: TournamentDetail) {
  const now = Date.now();
  const matchStarted = new Date(t.matchStartsAt).getTime() <= now;
  const registrationOpen =
    ["PUBLISHED", "REGISTRATION_OPEN"].includes(t.status) && new Date(t.registrationEndsAt).getTime() > now;
  const isCancelled = t.status === "CANCELLED";
  const isCompleted = t.status === "COMPLETED";
  const isLive = t.status === "LIVE" || (matchStarted && !isCompleted && !isCancelled);
  const isFull = t.slotsLeft <= 0;

  return { matchStarted, registrationOpen, isCancelled, isCompleted, isLive, isFull };
}

export default function TournamentDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { data: me } = useCurrentUser();
  const { data: t, isLoading, isError, refetch } = useTournamentDetail(slug);
  const submitResult = useSubmitResult(slug);
  const favorite = useFavoriteTournament(t?.id);

  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [placement, setPlacement] = useState("");
  const [kills, setKills] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [descExpanded, setDescExpanded] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-11 rounded-2xl" />
        <Skeleton className="h-56 sm:h-72 rounded-3xl" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-14 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  if (isError || !t) {
    return <ErrorState message="This tournament couldn't be loaded. It may have been removed." onRetry={() => refetch()} />;
  }

  const { matchStarted, registrationOpen, isCancelled, isCompleted, isLive, isFull } = deriveTournamentState(t);
  const totalBalance = me ? me.wallet.depositBalance + me.wallet.winningBalance + me.wallet.bonusBalance : 0;
  const insufficientBalance = Boolean(me) && t.format !== "FREE" && totalBalance < t.entryFee;
  const poster = t.bannerUrl || posterForGame(t.gameSlug, null);

  const statusBadge = isCancelled
    ? { label: "Cancelled", tone: "crimson" as const }
    : isCompleted
      ? { label: "Ended", tone: "neutral" as const }
      : isLive
        ? { label: "Live Now", tone: "crimson" as const }
        : isFull
          ? { label: "Tournament Full", tone: "crimson" as const }
          : registrationOpen
            ? { label: "Registration Open", tone: "signal" as const }
            : { label: "Registration Closed", tone: "neutral" as const };

  const countdownHeader = isCancelled
    ? "TOURNAMENT CANCELLED"
    : isCompleted
      ? "TOURNAMENT ENDED"
      : isLive
        ? "MATCH LIVE"
        : isFull
          ? "TOURNAMENT FULL"
          : "MATCH STARTS IN";
  const showCountdownDigits = !isCancelled && !isCompleted && !isLive;

  // Single source of truth for the primary + sticky CTA so both stay in sync.
  const cta = (() => {
    if (!me) return { label: "Login to Join", disabled: false, kind: "login" as const };
    if (t.isJoined) return { label: "Joined ✓", disabled: true, kind: "none" as const };
    if (isCancelled) return { label: "Tournament Cancelled", disabled: true, kind: "none" as const };
    if (isCompleted) return { label: "Tournament Ended", disabled: true, kind: "none" as const };
    if (isLive) return { label: "Match Live", disabled: true, kind: "none" as const };
    if (isFull) return { label: "Tournament Full", disabled: true, kind: "none" as const };
    if (!registrationOpen) return { label: "Registration Closed", disabled: true, kind: "none" as const };
    if (insufficientBalance) return { label: "Add Money to Join", disabled: false, kind: "addMoney" as const };
    return {
      label: `Join Now — ${t.format === "FREE" ? "Free" : formatPaise(t.entryFee)}`,
      disabled: false,
      kind: "join" as const,
    };
  })();

  const handleCtaClick = () => {
    if (cta.kind === "login") router.push("/login");
    else if (cta.kind === "addMoney") router.push("/wallet/deposit");
    else if (cta.kind === "join") router.push(`/tournaments/${slug}/register`); // registration screen: pick slot, accept rules, confirm
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

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const shareData = { title: t.title, text: `Join ${t.title} on XArena`, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      throw new Error("no-web-share");
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied to clipboard", tone: "success" });
      } catch {
        toast({ title: "Couldn't share", description: "Please copy the URL manually.", tone: "error" });
      }
    }
  };

  const description = t.description ?? "";
  const isLongDescription = description.length > 220;
  const shownDescription = !isLongDescription || descExpanded ? description : `${description.slice(0, 220).trimEnd()}…`;

  return (
    <div className="space-y-5 pb-28 sm:pb-6">
      {/* Tournament top bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="h-9 w-9 shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/80 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-lg font-bold text-white truncate">{t.gameName}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleShare}
            aria-label="Share tournament"
            className="h-9 w-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            onClick={favorite.toggle}
            aria-label={favorite.isFavorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={favorite.isFavorite}
            className={cn(
              "h-9 w-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center transition-colors",
              favorite.isFavorite ? "text-crimson" : "text-white/70 hover:text-white"
            )}
          >
            <Heart className={cn("h-4 w-4", favorite.isFavorite && "fill-current")} />
          </button>
        </div>
      </div>

      {/* Cinematic hero */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="relative h-64 sm:h-80 rounded-3xl overflow-hidden border border-white/10"
      >
        <div
          className="absolute inset-0"
          style={
            poster
              ? { backgroundImage: `url(${poster})`, backgroundSize: "cover", backgroundPosition: "50% 25%" }
              : { background: "linear-gradient(150deg, var(--color-violet-dim) 0%, var(--color-void) 70%)" }
          }
        />
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/55 to-black/10" />
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet/30 blur-3xl" />

        <div className="relative z-10 h-full flex flex-col justify-between p-4 sm:p-6">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={t.format === "FREE" ? "signal" : "gold"}>{t.format === "FREE" ? "Free Entry" : formatPaise(t.entryFee)}</Badge>
              <Badge tone="neutral">{t.gameName}</Badge>
              <Badge tone="violet">{gameModeLabel(t.mode)}</Badge>
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap",
                statusBadge.tone === "signal" && "bg-signal/15 text-signal border border-signal/30",
                statusBadge.tone === "crimson" && "bg-crimson/15 text-crimson border border-crimson/30",
                statusBadge.tone === "neutral" && "bg-white/10 text-white/70 border border-white/20"
              )}
            >
              {(isLive || (isFull && !isCompleted && !isCancelled)) && <span className="h-1.5 w-1.5 rounded-full bg-current live-dot" />}
              {statusBadge.label}
            </span>
          </div>

          <div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-1">{t.gameName}</p>
            <h1 className="text-white font-display font-black text-2xl sm:text-4xl leading-[1.05] drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
              {t.title}
            </h1>
            <p className="text-white/70 text-sm mt-1.5">
              {gameModeLabel(t.mode)}
              {t.roomSize > 1 && ` • Squad of ${t.roomSize}`}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Key stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="p-3 sm:p-4 text-center min-w-0">
          <div className="h-8 w-8 rounded-xl bg-gold/10 flex items-center justify-center mx-auto mb-1.5">
            <Trophy className="h-4 w-4 text-gold" />
          </div>
          <p className="text-xs sm:text-sm font-bold font-mono text-white truncate px-0.5">{formatPaise(t.prizePool)}</p>
          <p className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-wide">Prize Pool</p>
        </Card>
        <Card className="p-3 sm:p-4 text-center min-w-0">
          <div className="h-8 w-8 rounded-xl bg-cobalt/10 flex items-center justify-center mx-auto mb-1.5">
            <Users className="h-4 w-4 text-cobalt" />
          </div>
          <p className="text-xs sm:text-sm font-bold font-mono text-white truncate px-0.5">{t.slotsFilled} / {t.maxSlots}</p>
          <p className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-wide">Players Joined</p>
        </Card>
        <Card className="p-3 sm:p-4 text-center min-w-0">
          <div className="h-8 w-8 rounded-xl bg-violet/10 flex items-center justify-center mx-auto mb-1.5">
            <MapPin className="h-4 w-4 text-violet" />
          </div>
          <p className="text-xs sm:text-sm font-bold text-white truncate px-0.5">{t.map ?? "TBD"}</p>
          <p className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-wide">Map</p>
        </Card>
      </div>

      {/* Countdown + player progress */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="flex-1 min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/50 mb-2">
              <Clock className="h-3.5 w-3.5" /> {countdownHeader}
            </p>
            {showCountdownDigits ? (
              <>
                <CountdownBlocks target={t.matchStartsAt} />
                <p className="text-xs text-white/40 mt-2">{formatDateTime(t.matchStartsAt)}</p>
              </>
            ) : (
              <p className="text-sm font-semibold text-white/70">{formatDateTime(t.matchStartsAt)}</p>
            )}
          </div>

          <div className="h-px w-full sm:h-14 sm:w-px bg-white/10 shrink-0" />

          <div className="flex-1 min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/50 mb-2">
              <Users className="h-3.5 w-3.5" /> {t.slotsFilled} / {t.maxSlots} Players
            </p>
            <SlotMeter filled={t.slotsFilled} max={t.maxSlots} />
            <p className="text-xs text-white/40 mt-2">
              {isFull ? "No slots remaining" : `${t.slotsLeft} slot${t.slotsLeft === 1 ? "" : "s"} remaining`}
            </p>
          </div>
        </div>
      </Card>

      {/* Room details — only visible to joined participants once released */}
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

      {me && t.isJoined && t.mySlot && (
        <Card className="p-4 flex items-center justify-between gap-3 border-signal/30">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-signal">You&apos;re registered</p>
            <p className="text-sm font-bold text-white mt-0.5">
              {t.mySlot.slotLabel}
              {t.mySlot.teamSize > 1 ? ` · Player ${t.mySlot.positionLabel}` : ""}
            </p>
          </div>
          <Badge tone="signal">Slot confirmed</Badge>
        </Card>
      )}

      {/* Primary CTA (desktop / inline; mobile also gets the sticky bar below) */}
      {me && t.isJoined && matchStarted && !isCompleted && (
        <Button fullWidth size="lg" variant="secondary" onClick={() => setResultDialogOpen(true)}>
          <ImageIcon className="h-4 w-4" /> Submit Match Result
        </Button>
      )}
      <Button
        fullWidth
        size="lg"
        variant={cta.kind === "addMoney" ? "cta" : "primary"}
        disabled={cta.disabled}
        onClick={handleCtaClick}
        className="hidden sm:flex"
      >
        {cta.kind === "addMoney" && <Wallet className="h-4 w-4" />}
        {t.format !== "FREE" && cta.kind === "join" ? (
          <span className="flex items-center gap-2">
            <span className="font-mono">{formatPaise(t.entryFee)}</span>
            <span className="opacity-50">|</span>
            <span>Join Now →</span>
          </span>
        ) : (
          cta.label
        )}
      </Button>

      {/* About */}
      <Collapsible icon={Info} title="About" defaultOpen>
        <p className="text-sm text-white/60 leading-relaxed whitespace-pre-line">{shownDescription}</p>
        {isLongDescription && (
          <button
            onClick={() => setDescExpanded((v) => !v)}
            className="text-xs font-semibold text-violet mt-2 hover:text-cobalt"
          >
            {descExpanded ? "Show less" : "Read more"}
          </button>
        )}
      </Collapsible>

      {/* Prize distribution */}
      <Collapsible icon={Trophy} iconClassName="text-gold" title="Prize Distribution" defaultOpen>
        <div className="space-y-2">
          {t.prizeDistribution.map((p) => (
            <div key={p.position} className="flex items-center justify-between text-sm py-1">
              <span className="text-white/60 flex items-center gap-1.5">
                {p.position === 1 ? "🥇" : p.position === 2 ? "🥈" : p.position === 3 ? "🥉" : null} #{p.position} Place
              </span>
              <span className="font-mono font-bold text-gold">{formatPaise(p.amount)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-xl bg-gold/10 border border-gold/25 px-3 py-2.5 mt-3">
            <span className="text-xs font-bold uppercase tracking-wide text-gold">Total Prize Pool</span>
            <span className="font-mono font-black text-gold">{formatPaise(t.prizePool)}</span>
          </div>
        </div>
      </Collapsible>

      {/* Rules */}
      <Collapsible icon={ShieldCheck} title="Rules">
        <p className="text-sm text-white/60 leading-relaxed whitespace-pre-line">{t.rules}</p>
        {t.scoringSystem && (
          <>
            <h4 className="font-bold text-white text-xs mt-4 mb-1 uppercase tracking-wide text-white/40">Scoring</h4>
            <p className="text-sm text-white/60">{t.scoringSystem}</p>
          </>
        )}
      </Collapsible>

      {/* Participants */}
      <Collapsible icon={Users} title={`Participants (${t.participants.length}/${t.maxSlots})`}>
        {t.participants.length === 0 ? (
          <p className="text-sm text-white/40">No one has joined yet. Be the first!</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {t.participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full gradient-brand flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
                  {p.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    p.username[0]?.toUpperCase()
                  )}
                </div>
                <span className="text-sm text-white/80">{p.username}</span>
                {p.teamName && <span className="text-xs text-white/40">· {p.teamName}</span>}
              </div>
            ))}
          </div>
        )}
      </Collapsible>

      {/* Sticky mobile Join CTA — sits above the bottom nav, never overlaps it */}
      <div
        className="fixed inset-x-0 z-30 sm:hidden px-4"
        style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
      >
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Button
            fullWidth
            size="lg"
            variant={cta.kind === "addMoney" ? "cta" : "primary"}
            disabled={cta.disabled}
            onClick={handleCtaClick}
            className="shadow-[0_12px_32px_-8px_rgba(0,0,0,0.65)]"
          >
            {cta.kind === "addMoney" && <Wallet className="h-4 w-4" />}
            {t.format !== "FREE" && cta.kind === "join" ? (
              <span className="flex items-center gap-2">
                <span className="font-mono">{formatPaise(t.entryFee)}</span>
                <span className="opacity-50">|</span>
                <span>Join Now →</span>
              </span>
            ) : (
              cta.label
            )}
          </Button>
        </motion.div>
      </div>

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

      {!me && (
        <p className="text-center text-xs text-white/30">
          <Link href="/login" className="text-violet font-semibold">
            Log in
          </Link>{" "}
          to join tournaments and track your matches.
        </p>
      )}
    </div>
  );
}
