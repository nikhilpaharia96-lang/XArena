"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, CheckCircle2, Gamepad2, Info, Lock, ScrollText, Ticket, Trophy, Users, Wallet } from "lucide-react";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useJoinTournament, useSlotBoard, useTournamentDetail, type JoinResult } from "@/hooks/use-tournaments";
import { ApiClientError } from "@/lib/api-client";
import { toast } from "@/lib/toast-store";
import { cn } from "@/lib/cn";
import { formatPaise, gameModeLabel } from "@/lib/format";
import { validateGameUid, validateIgn } from "@/lib/game-uid";
import { posterForGame } from "@/components/home/game-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Collapsible } from "@/components/ui/collapsible";
import { SlotLegend, SlotPicker, type Selection } from "@/components/tournament/slot-picker";

const shortId = (id: string) => id.replace(/^tourn_/, "").slice(-8).toUpperCase();

function Section({ icon: Icon, title, hint, children }: { icon: React.ElementType; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet/15 text-violet">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-black text-white leading-tight">{title}</h2>
          {hint && <p className="text-[11px] text-white/40 mt-0.5">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function RegisterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { data: me } = useRequireAuth();
  const { data: t, isLoading: tLoading, isError: tError, refetch: refetchT } = useTournamentDetail(slug);
  const { data: board, isLoading: bLoading, isError: bError, refetch: refetchBoard } = useSlotBoard(slug);
  const join = useJoinTournament(slug);

  // Fields start from the player's saved info (last registration for this game / username) and
  // only become local state once the player edits them — no effect needed to copy server data.
  const [ignEdit, setIgnEdit] = useState<string | null>(null);
  const [uidEdit, setUidEdit] = useState<string | null>(null);
  const ign = ignEdit ?? board?.profile.ign ?? "";
  const gameUid = uidEdit ?? board?.profile.gameUid ?? "";
  const setIgn = (v: string) => setIgnEdit(v);
  const setGameUid = (v: string) => setUidEdit(v);

  const [teamName, setTeamName] = useState("");
  const [picked, setSelected] = useState<Selection | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [touched, setTouched] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [success, setSuccess] = useState<JoinResult | null>(null);

  // A pick only counts while that seat is still AVAILABLE on the live board. If someone else
  // takes it (or an admin locks it) the selection is dropped automatically.
  const pickedStillFree = Boolean(
    board && picked && board.slots.find((s) => s.slotNumber === picked.slotNumber)?.positions.find((x) => x.position === picked.position)?.state === "AVAILABLE"
  );
  const selected = pickedStillFree ? picked : null;
  const lostNotice = picked && !pickedStillFree ? "The slot you picked was just taken. Please choose another slot." : null;

  const gameSlug = t?.gameSlug ?? "";
  const ignError = touched || ign ? validateIgn(ign) : null;
  const uidError = touched || gameUid ? validateGameUid(gameSlug, gameUid) : null;

  const totalBalance = me ? me.wallet.depositBalance + me.wallet.winningBalance + me.wallet.bonusBalance : 0;
  const isPaid = Boolean(t) && t!.entryFee > 0;
  const insufficient = isPaid && totalBalance < t!.entryFee;

  const needsSlot = Boolean(board?.slotSelection);
  const detailsValid = !validateIgn(ign) && !validateGameUid(gameSlug, gameUid);
  const canConfirm = Boolean(board?.registration.open) && detailsValid && accepted && (!needsSlot || selected !== null) && !insufficient && !join.isPending;

  const selectionLabel = useMemo(() => {
    if (!board || !selected) return null;
    const slot = board.slots.find((s) => s.slotNumber === selected.slotNumber);
    const pos = slot?.positions.find((p) => p.position === selected.position);
    return `${slot?.label ?? ""}${board.layout.teamSize > 1 ? ` · Player ${pos?.label}` : ""}`;
  }, [board, selected]);

  const onConfirm = () => {
    setTouched(true);
    setNotice(null);
    if (!canConfirm) return;
    join.mutate(
      {
        slotNumber: selected?.slotNumber,
        position: selected?.position,
        ign: ign.trim(),
        gameUid: gameUid.trim(),
        teamName: teamName.trim() || undefined,
        acceptRules: accepted,
      },
      {
        onSuccess: (res) => setSuccess(res),
        onError: (err) => {
          const code = err instanceof ApiClientError ? err.code : undefined;
          const message = err instanceof ApiClientError ? err.message : "Network problem. Check your connection and try again.";
          if (code === "SLOT_TAKEN" || code === "SLOT_LOCKED") {
            setSelected(null);
            setNotice(message); // e.g. "Team 3 · Player B was just taken. Please choose another slot."
            void refetchBoard();
          } else {
            toast({ title: "Couldn't complete registration", description: message, tone: "error" });
            if (code === "TOURNAMENT_FULL" || code === "REGISTRATION_CLOSED" || code === "ALREADY_JOINED") void refetchBoard();
          }
        },
      }
    );
  };

  // ---------------- loading / error ----------------
  if (tLoading || bLoading || me === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 rounded-2xl" />
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }
  if (tError || !t) return <ErrorState message="This tournament couldn't be loaded. It may have been removed." onRetry={() => refetchT()} />;
  if (bError || !board) return <ErrorState message="Couldn't load the slots. Check your connection and try again." onRetry={() => refetchBoard()} />;

  const poster = t.bannerUrl || posterForGame(t.gameSlug, null);

  // ---------------- success ----------------
  if (success) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 text-center pt-4">
        <motion.div initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-signal/15 ring-8 ring-signal/10">
          <CheckCircle2 className="h-10 w-10 text-signal" />
        </motion.div>
        <div>
          <h1 className="text-2xl font-black text-white">✓ Successfully Joined</h1>
          <p className="text-sm text-white/50 mt-1">Your slot is locked in. Good luck!</p>
        </div>
        <Card className="p-4 text-left space-y-3">
          {[
            ["Tournament", success.tournamentTitle],
            ["Tournament ID", shortId(success.tournamentId)],
            [success.teamSize > 1 ? "Team" : "Slot", success.slotLabel],
            ...(success.teamSize > 1 ? [["Position", `Player ${success.positionLabel}`]] : [["Position", `#${success.slotNumber}`]]),
            ["Entry Fee", success.entryFee > 0 ? formatPaise(success.entryFee) : "Free"],
            ["Registration", "Confirmed"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-white/45">{k}</span>
              <span className={cn("font-semibold text-right", k === "Registration" ? "text-signal" : "text-white")}>{v}</span>
            </div>
          ))}
        </Card>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href={`/tournaments/${slug}`}>
            <Button fullWidth size="lg">View Tournament</Button>
          </Link>
          <Link href="/my-matches">
            <Button fullWidth size="lg" variant="secondary">My Matches</Button>
          </Link>
        </div>
      </motion.div>
    );
  }

  // ---------------- blocked states ----------------
  const block = board.registration;
  if (!block.open) {
    const joined = block.blockCode === "ALREADY_JOINED";
    return (
      <div className="space-y-4">
        <Link href={`/tournaments/${slug}`} className="inline-flex items-center gap-1.5 text-sm text-white/50 min-h-[44px]">
          <ArrowLeft className="h-4 w-4" /> Back to tournament
        </Link>
        <EmptyState
          icon={joined ? CheckCircle2 : block.blockCode === "TOURNAMENT_FULL" ? Users : Lock}
          title={joined ? "You're already registered" : block.blockCode === "TOURNAMENT_FULL" ? "Tournament is full" : "Registration is closed"}
          description={
            joined && block.mySlot
              ? `You hold ${block.mySlot.slotLabel}${block.mySlot.positionLabel && board.layout.teamSize > 1 ? ` · Player ${block.mySlot.positionLabel}` : ""}.`
              : (block.blockMessage ?? "This tournament isn't accepting registrations right now.")
          }
          action={
            <Link href={`/tournaments/${slug}`}>
              <Button size="sm">View Tournament</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (board.layout.teamCount === 0) {
    return <EmptyState icon={Users} title="No slots available" description="This tournament has no slots configured yet. Please check back later." />;
  }

  const stepCta = insufficient ? "Add Money to Join" : needsSlot && !selected ? "Select a slot to continue" : !accepted ? "Accept the rules to continue" : !detailsValid ? "Enter your game details" : "Confirm & Join";

  const ctaButton = (
    <Button
      fullWidth
      size="lg"
      variant="cta"
      loading={join.isPending}
      disabled={!insufficient && !canConfirm}
      onClick={insufficient ? () => router.push("/wallet/deposit") : onConfirm}
      className="shadow-[0_12px_32px_-8px_rgba(0,0,0,0.65)]"
    >
      {insufficient && <Wallet className="h-4 w-4" />}
      {stepCta}
      {canConfirm && isPaid && <span className="font-mono opacity-80">· {formatPaise(t.entryFee)}</span>}
    </Button>
  );

  return (
    <div className="space-y-6 pb-44 sm:pb-8">
      <Link href={`/tournaments/${slug}`} className="inline-flex items-center gap-1.5 text-sm text-white/50 min-h-[44px]">
        <ArrowLeft className="h-4 w-4" /> Back to tournament
      </Link>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/25" />
        <div className="relative p-4 sm:p-5 pt-24 sm:pt-28 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="violet">{t.gameName}</Badge>
            <Badge tone="neutral">{gameModeLabel(t.mode)}</Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white leading-tight break-words">{t.title}</h1>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-black/40 backdrop-blur px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-white/45">Tournament ID</p>
              <p className="text-xs font-mono font-bold text-white mt-0.5 truncate">{shortId(t.id)}</p>
            </div>
            <div className="rounded-xl bg-black/40 backdrop-blur px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-white/45">Entry Fee</p>
              <p className="text-xs font-bold text-gold mt-0.5">{isPaid ? formatPaise(t.entryFee) : "Free"}</p>
            </div>
            <div className="rounded-xl bg-black/40 backdrop-blur px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-white/45">Prize Pool</p>
              <p className="text-xs font-bold text-white mt-0.5 flex items-center justify-center gap-1">
                <Trophy className="h-3 w-3 text-gold" /> {formatPaise(t.prizePool)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Player details */}
      <Section icon={Gamepad2} title="Player Details" hint={board.profile.gameUid ? "Filled from your last registration — edit if needed." : "Enter the details you play with in the game."}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ign" className="text-xs font-semibold text-white/60 mb-1.5 block">In-game Name (IGN) *</label>
            <Input id="ign" value={ign} maxLength={40} autoComplete="off" error={ignError ?? undefined} onChange={(e) => setIgn(e.target.value)} onBlur={() => setTouched(true)} placeholder="Your in-game name" />
          </div>
          <div>
            <label htmlFor="uid" className="text-xs font-semibold text-white/60 mb-1.5 block">Game UID *</label>
            <Input id="uid" value={gameUid} maxLength={40} inputMode={["free-fire-max", "bgmi", "pubg-mobile", "cod-mobile"].includes(gameSlug) ? "numeric" : "text"} autoComplete="off" error={uidError ?? undefined} onChange={(e) => setGameUid(e.target.value)} onBlur={() => setTouched(true)} placeholder="e.g. 123456789" />
          </div>
          {board.layout.teamSize > 1 && (
            <div className="sm:col-span-2">
              <label htmlFor="team" className="text-xs font-semibold text-white/60 mb-1.5 block">Team name (optional)</label>
              <Input id="team" value={teamName} maxLength={40} onChange={(e) => setTeamName(e.target.value)} placeholder="Your squad's name" />
            </div>
          )}
        </div>
      </Section>

      {/* Slots */}
      <Section
        icon={Users}
        title={needsSlot ? (board.layout.teamSize > 1 ? "Select your team & position" : "Select your slot") : "Slot assignment"}
        hint={`${board.counts.available} of ${board.counts.capacity} ${board.layout.teamSize > 1 ? "positions" : "slots"} available${board.counts.locked ? ` · ${board.counts.locked} locked` : ""}`}
      >
        {(notice ?? lostNotice) && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2.5 text-xs text-gold">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-px" /> {notice ?? lostNotice}
          </div>
        )}
        {needsSlot ? (
          <>
            <SlotLegend />
            <SlotPicker board={board} selected={selected} onSelect={(s) => { setSelected(s); setNotice(null); }} disabled={join.isPending} />
          </>
        ) : (
          <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
            <Info className="h-4 w-4 shrink-0 mt-px text-violet" /> Slots are assigned automatically in join order. You&apos;ll see yours once you&apos;re registered.
          </div>
        )}
      </Section>

      {/* Rules */}
      <Section icon={ScrollText} title="Rules & Terms">
        <Collapsible title="Tournament rules" icon={ScrollText}>
          <p className="text-sm text-white/70 whitespace-pre-line leading-relaxed">{t.rules}</p>
        </Collapsible>
        <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-surface/60 p-3.5 cursor-pointer min-h-[44px]">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded accent-orange-500" />
          <span className="text-sm text-white/80">I agree to the tournament rules and terms</span>
        </label>
      </Section>

      {/* Wallet */}
      {isPaid && (
        <Card className={cn("p-4 flex items-center justify-between gap-3", insufficient && "border-crimson/40")}>
          <div className="flex items-center gap-3 min-w-0">
            <Ticket className="h-5 w-5 shrink-0 text-gold" />
            <div className="min-w-0">
              <p className="text-xs text-white/45">Wallet balance</p>
              <p className="text-sm font-bold text-white font-mono">{formatPaise(totalBalance)}</p>
            </div>
          </div>
          {insufficient ? (
            <p role="alert" className="text-xs text-crimson text-right">Insufficient balance. Add {formatPaise(t.entryFee - totalBalance)} more to join.</p>
          ) : (
            <p className="text-xs text-white/40 text-right">{formatPaise(t.entryFee)} will be charged after your slot is reserved.</p>
          )}
        </Card>
      )}

      {/* Desktop CTA */}
      <div className="hidden sm:block space-y-2">
        {selectionLabel && <p className="text-center text-xs text-white/50">Selected: <span className="text-white font-semibold">{selectionLabel}</span></p>}
        {ctaButton}
      </div>

      {/* Mobile sticky CTA — above the bottom nav, respects the safe area */}
      <div className="fixed inset-x-0 z-30 sm:hidden px-4" style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}>
        <div className="rounded-3xl border border-white/10 bg-void/95 backdrop-blur p-3 space-y-2 shadow-[0_-12px_32px_-12px_rgba(0,0,0,0.8)]">
          {selectionLabel && <p className="text-center text-xs text-white/60">Selected: <span className="text-white font-semibold">{selectionLabel}</span></p>}
          {ctaButton}
        </div>
      </div>
    </div>
  );
}
