import { Trophy, Users, MapPin, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export interface PreviewData {
  title: string;
  gameName: string;
  categoryLabel: string | null;
  categoryCustom: boolean;
  entryFee: number;
  isFree: boolean;
  prizePool: number;
  maxSlots: number;
  map: string;
  bannerUrl: string | null;
  thumbnailUrl: string | null;
  matchStartsAt: string | null; // ISO
  status: string;
}

const inr = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(n || 0)}`;

/** Pure UI preview that mimics the public card + detail header. Never touches the API. */
export function TournamentPreview({ d }: { d: PreviewData }) {
  const cardImg = d.thumbnailUrl || d.bannerUrl;
  const statusTone = d.status === "DRAFT" ? "neutral" : d.status.includes("OPEN") ? "signal" : d.status === "LIVE" ? "crimson" : "violet";

  return (
    <div className="space-y-4" aria-label="Live tournament preview">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35 mb-2">Tournament card</p>
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-surface shadow-[0_20px_50px_-24px_rgba(37,99,235,0.45)]">
          <div className="relative h-28">
            {cardImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cardImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 gradient-brand" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />
            <span className="absolute left-3 top-3 rounded-full bg-gold px-2.5 py-1 text-[11px] font-black text-white">
              {d.isFree ? "FREE" : inr(d.entryFee)}
            </span>
            <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
              <span className="rounded-full bg-black/40 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/85">{d.gameName || "Game"}</span>
              {d.categoryLabel && (
                <span className="rounded-full bg-violet/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                  {d.categoryLabel}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-3 p-4">
            <div>
              <p className="text-[11px] text-white/40">{d.gameName || "Select a game"}</p>
              <h3 className="text-base font-black leading-tight text-white break-words">{d.title || "Tournament name"}</h3>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat icon={<Trophy className="h-3.5 w-3.5 text-gold" />} label="Prize Pool" value={inr(d.prizePool)} />
              <Stat icon={<Users className="h-3.5 w-3.5 text-cobalt" />} label="Players" value={`0/${d.maxSlots || 0}`} />
              <Stat icon={<MapPin className="h-3.5 w-3.5 text-violet" />} label="Map" value={d.map || "—"} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <Badge tone={statusTone}>{d.status.replace(/_/g, " ")}</Badge>
              {d.matchStartsAt && (
                <span className="inline-flex items-center gap-1 text-[11px] text-white/45">
                  <Clock className="h-3 w-3" /> {formatDateTime(d.matchStartsAt)}
                </span>
              )}
            </div>
            {d.categoryCustom && <p className="text-[10px] text-white/30">XArena custom category — not an official game mode.</p>}
          </div>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35 mb-2">Detail header</p>
        <div className="relative h-32 overflow-hidden rounded-3xl border border-white/10">
          {d.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-violet/40 via-surface to-gold/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          <p className="absolute bottom-3 left-4 right-4 text-sm font-black text-white truncate">{d.title || "Tournament name"}</p>
        </div>
      </div>
      <p className="text-[11px] text-white/30">Preview only — nothing is saved until you press Save or Create.</p>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-1.5 py-2 min-w-0">
      <div className="flex justify-center mb-0.5">{icon}</div>
      <p className="text-xs font-bold text-white truncate">{value}</p>
      <p className="text-[9px] uppercase tracking-wide text-white/35">{label}</p>
    </div>
  );
}
