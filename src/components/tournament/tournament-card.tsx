"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CalendarClock, Check, Lock, MapPin, Trophy, User, Users, Ban, Eye, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SlotMeter } from "./slot-meter";
import { CountdownTimer } from "./countdown-timer";
import { formatDateTime, formatPaise, gameModeLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { TournamentListItem } from "@/hooks/use-tournaments";
import { posterForGame } from "@/components/home/game-card";

type Kind = "live" | "upcoming" | "completed" | "cancelled";

interface StatusMeta {
  kind: Kind;
  label: string;
  tone: "crimson" | "cobalt" | "neutral" | "signal";
}

/** Each status gets its own frame, image treatment and CTA so a card can be
 * read at a glance: LIVE glows red, Upcoming is blue, Completed is muted,
 * Cancelled is greyed out. */
const STATUS_META: Record<string, StatusMeta> = {
  LIVE: { kind: "live", label: "Live", tone: "crimson" },
  REGISTRATION_OPEN: { kind: "upcoming", label: "Upcoming", tone: "cobalt" },
  REGISTRATION_CLOSED: { kind: "upcoming", label: "Starting Soon", tone: "cobalt" },
  PUBLISHED: { kind: "upcoming", label: "Upcoming", tone: "cobalt" },
  COMPLETED: { kind: "completed", label: "Completed", tone: "neutral" },
  CANCELLED: { kind: "cancelled", label: "Cancelled", tone: "neutral" },
};

const FRAME: Record<Kind, string> = {
  live: "border-crimson/50 shadow-[0_0_0_1px_rgba(239,68,68,0.2),0_10px_30px_-12px_rgba(239,68,68,0.45)]",
  upcoming: "border-white/10 hover:border-cobalt/40",
  completed: "border-white/8",
  cancelled: "border-white/8 opacity-80",
};

const ART_FILTER: Record<Kind, string> = {
  live: "",
  upcoming: "",
  completed: "grayscale-[0.55] brightness-90",
  cancelled: "grayscale brightness-75",
};

export function TournamentCard({ tournament, className }: { tournament: TournamentListItem; className?: string }) {
  const t = tournament;
  const meta: StatusMeta = STATUS_META[t.status] ?? { kind: "upcoming", label: t.status, tone: "neutral" };
  const { kind } = meta;
  const isFull = t.slotsLeft <= 0;
  const isSolo = t.mode === "SOLO" || t.mode === "ONE_V_ONE";
  const ModeIcon = isSolo ? User : Users;
  // Admin-set card image wins, then banner, then the game's poster; gradient if none exist.
  const art = t.thumbnailUrl || t.bannerUrl || posterForGame(t.gameSlug, null);

  // CTA reflects what tapping the card will actually do.
  let cta: { label: string; icon: React.ReactNode; style: string };
  if (kind === "live") {
    cta = { label: "Watch Live", icon: <Radio className="h-4 w-4" />, style: "bg-crimson text-white" };
  } else if (kind === "completed") {
    cta = { label: "View Results", icon: <Eye className="h-4 w-4" />, style: "bg-white/10 border border-white/15 text-white" };
  } else if (kind === "cancelled") {
    cta = { label: "Cancelled", icon: <Ban className="h-4 w-4" />, style: "bg-white/5 border border-white/10 text-white/50" };
  } else if (t.isJoined) {
    cta = { label: "Joined", icon: <Check className="h-4 w-4" />, style: "bg-signal/15 border border-signal/40 text-signal" };
  } else if (isFull) {
    cta = { label: "Slots Full", icon: <Lock className="h-4 w-4" />, style: "bg-white/5 border border-white/10 text-white/50" };
  } else {
    cta = { label: "Join Now", icon: <ArrowRight className="h-4 w-4" />, style: "gradient-cta text-white shadow-[0_8px_20px_-8px_rgba(249,115,22,0.7)]" };
  }

  return (
    <Link href={`/tournaments/${t.slug}`} className={cn("block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/60", className)}>
      <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.985 }} transition={{ duration: 0.15 }} className="h-full">
        <article className={cn("glass rounded-2xl overflow-hidden h-full flex flex-col border transition-colors", FRAME[kind])}>
          {/* Media */}
          <div className="force-dark relative aspect-[16/8] gradient-brand shrink-0">
            {art && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={art}
                alt=""
                loading="lazy"
                decoding="async"
                className={cn("absolute inset-0 h-full w-full object-cover", ART_FILTER[kind])}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/40" />

            <Badge tone={meta.tone} className="absolute top-2.5 left-2.5 z-10 !py-0.5 bg-[#0B1224]">
              {kind === "live" && <span className="h-1.5 w-1.5 rounded-full bg-crimson live-dot" />}
              {meta.label}
            </Badge>

            <span className="absolute top-2.5 right-2.5 z-10 inline-flex items-center gap-1.5 max-w-[60%] rounded-full bg-[#0B1224] border border-[#26314F] pl-1 pr-2.5 py-0.5">
              {t.gameIcon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.gameIcon} alt="" className="h-4 w-4 rounded-full object-cover" />
              ) : (
                <span className="h-4 w-4 rounded-full bg-white/15 flex items-center justify-center">
                  <Trophy className="h-2.5 w-2.5 text-white/80" />
                </span>
              )}
              <span className="truncate text-[11px] font-bold uppercase tracking-wider text-white/90">{t.gameName}</span>
            </span>

            {t.isJoined && kind !== "upcoming" && (
              <span className="absolute bottom-2.5 right-2.5 z-10">
                <Badge tone="signal" className="!py-0.5">
                  <Check className="h-3 w-3" /> Joined
                </Badge>
              </span>
            )}
          </div>

          {/* Body */}
          <div className="p-3.5 flex flex-col gap-3 flex-1">
            <div className="min-w-0">
              <h3 className={cn("font-bold text-sm leading-snug line-clamp-1", kind === "cancelled" ? "text-white/60" : "text-white")}>{t.title}</h3>
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-white/55">
                <span className="inline-flex items-center gap-1 rounded-md bg-white/8 px-1.5 py-0.5 font-semibold text-white/75">
                  <ModeIcon className="h-3 w-3" /> {gameModeLabel(t.mode)}
                </span>
                {t.map && (
                  <span className="inline-flex items-center gap-0.5 truncate">
                    <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{t.map}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Money row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/[0.04] border border-white/8 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-white/45">Prize Pool</p>
                <p className={cn("text-[15px] font-extrabold font-mono leading-tight mt-0.5", kind === "cancelled" ? "text-white/40 line-through" : "gradient-text")}>
                  {formatPaise(t.prizePool)}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/8 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-white/45">Entry Fee</p>
                <p className={cn("text-[15px] font-extrabold font-mono leading-tight mt-0.5", t.format === "FREE" ? "text-signal" : "text-gold")}>
                  {t.format === "FREE" ? "Free" : formatPaise(t.entryFee)}
                </p>
              </div>
            </div>

            {/* Schedule */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-white/60 min-w-0">
                <CalendarClock className="h-3.5 w-3.5 shrink-0 text-cobalt" />
                <span className="truncate">{formatDateTime(t.matchStartsAt)}</span>
              </span>
              {kind === "upcoming" && (
                <span className="shrink-0 font-semibold text-gold">
                  <CountdownTimer target={t.matchStartsAt} />
                </span>
              )}
              {kind === "live" && <span className="shrink-0 font-bold text-crimson">In progress</span>}
            </div>

            {/* Slots */}
            <div className="space-y-1.5 mt-auto">
              <SlotMeter filled={t.slotsFilled} max={t.maxSlots} />
              <p className="flex items-center gap-1 text-[11px] text-white/45">
                <Users className="h-3 w-3" /> {t.slotsFilled}/{t.maxSlots} joined
              </p>
            </div>

            <span className={cn("inline-flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-bold", cta.style)}>
              {cta.label} {cta.icon}
            </span>
          </div>
        </article>
      </motion.div>
    </Link>
  );
}
