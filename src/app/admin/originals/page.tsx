"use client";

import { useState } from "react";
import { Dices } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatPaiseExact } from "@/lib/format";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import {
  useOriginalsOverview,
  useUpdateOriginalConfig,
  useVoidRound,
  type AdminGameConfig,
  type GameStat,
} from "@/hooks/use-originals-admin";

const NAMES = { DICE: "Dice", COINFLIP: "Coin Flip", MINES: "Mines", CRASH: "Crash" } as const;

const rupees = (p: number) => String(p / 100);
const toPaise = (s: string) => Math.round(Number(s) * 100);

function ConfigCard({ cfg, stat24, statAll }: { cfg: AdminGameConfig; stat24?: GameStat; statAll?: GameStat }) {
  const update = useUpdateOriginalConfig();
  const [edge, setEdge] = useState(String(cfg.houseEdgeBps / 100));
  const [min, setMin] = useState(rupees(cfg.minBet));
  const [max, setMax] = useState(rupees(cfg.maxBet));
  const [cap, setCap] = useState(rupees(cfg.maxPayout));

  const save = (patch: Parameters<typeof update.mutate>[0]["patch"], okMsg: string) =>
    update.mutate(
      { game: cfg.gameKey, patch },
      {
        onSuccess: () => toast({ title: okMsg, tone: "success" }),
        onError: (e) => toast({ title: "Not saved", description: e instanceof ApiClientError ? e.message : "Please try again.", tone: "error" }),
      }
    );

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-white">{NAMES[cfg.gameKey]}</h3>
        <div className="flex items-center gap-2">
          <Badge tone={cfg.isEnabled ? "signal" : "neutral"}>{cfg.isEnabled ? "Live" : "Off"}</Badge>
          <Button size="sm" variant={cfg.isEnabled ? "secondary" : "primary"} loading={update.isPending} onClick={() => save({ isEnabled: !cfg.isEnabled }, cfg.isEnabled ? "Game switched off" : "Game is live")}>
            {cfg.isEnabled ? "Turn off" : "Turn on"}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-[11px] text-white/40">24h result (house)</p>
          <p className={`font-black ${(stat24?.ggr ?? 0) < 0 ? "text-crimson" : "text-white"}`}>{formatPaiseExact(stat24?.ggr ?? 0)}</p>
          <p className="text-[11px] text-white/40">{stat24?.rounds ?? 0} bets · {formatPaiseExact(stat24?.wagered ?? 0)} wagered</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-[11px] text-white/40">All-time result (house)</p>
          <p className={`font-black ${(statAll?.ggr ?? 0) < 0 ? "text-crimson" : "text-white"}`}>{formatPaiseExact(statAll?.ggr ?? 0)}</p>
          <p className="text-[11px] text-white/40">{statAll?.openRounds ?? 0} open · {formatPaiseExact(statAll?.openStake ?? 0)} at stake</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-[11px] text-white/50">House edge (%)</label><Input value={edge} onChange={(e) => setEdge(e.target.value)} inputMode="decimal" /></div>
        <div><label className="text-[11px] text-white/50">Min bet (₹)</label><Input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" /></div>
        <div><label className="text-[11px] text-white/50">Max bet (₹)</label><Input value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" /></div>
        <div><label className="text-[11px] text-white/50">Max payout per round (₹)</label><Input value={cap} onChange={(e) => setCap(e.target.value)} inputMode="decimal" /></div>
      </div>
      <Button
        fullWidth
        variant="outline"
        loading={update.isPending}
        onClick={() => save({ houseEdgeBps: Math.round(Number(edge) * 100), minBet: toPaise(min), maxBet: toPaise(max), maxPayout: toPaise(cap) }, "Limits saved")}
      >
        Save limits
      </Button>
    </Card>
  );
}

export default function AdminOriginalsPage() {
  const { data, isLoading } = useOriginalsOverview();
  const voidRound = useVoidRound();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-black text-white flex items-center gap-2"><Dices className="h-5 w-5 text-violet" /> XArena Originals</h1>
      <p className="text-xs text-white/50">
        In-house games share the player wallet. Games ship switched off. Max payout caps what one round can ever cost you; keep it small relative to your bankroll.
      </p>
      {isLoading || !data ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            {data.configs.map((c) => (
              // key on updatedAt so the form resets to saved values after a save
              <ConfigCard key={`${c.gameKey}-${c.updatedAt}`} cfg={c} stat24={data.stats24h.find((s) => s.gameKey === c.gameKey)} statAll={data.statsAllTime.find((s) => s.gameKey === c.gameKey)} />
            ))}
          </div>
          <Card className="p-5">
            <h3 className="font-black text-white mb-3">Recent rounds</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[11px] text-white/40">
                  <tr><th className="py-1 pr-3">Time</th><th className="pr-3">Player</th><th className="pr-3">Game</th><th className="pr-3">Bet</th><th className="pr-3">Payout</th><th className="pr-3">Status</th><th /></tr>
                </thead>
                <tbody>
                  {data.recent.map((r) => (
                    <tr key={r.id} className="border-t border-white/5 text-white/80">
                      <td className="py-1.5 pr-3 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                      <td className="pr-3">{r.username}</td>
                      <td className="pr-3">{NAMES[r.gameKey]}</td>
                      <td className="pr-3">{formatPaiseExact(r.betAmount)}</td>
                      <td className="pr-3">{formatPaiseExact(r.payoutAmount)}</td>
                      <td className="pr-3">{r.status}</td>
                      <td>
                        {r.status === "ACTIVE" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={voidRound.isPending}
                            onClick={() => {
                              if (window.confirm("Void this open round and refund the stake?")) {
                                voidRound.mutate(r.id, {
                                  onSuccess: () => toast({ title: "Round voided, stake refunded", tone: "success" }),
                                  onError: (e) => toast({ title: "Couldn't void", description: e instanceof ApiClientError ? e.message : "Try again.", tone: "error" }),
                                });
                              }
                            }}
                          >
                            Void
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
