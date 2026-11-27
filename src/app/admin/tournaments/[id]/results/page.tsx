"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiClientError } from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast-store";
import { formatPaise } from "@/lib/format";
import { matchPlayer, parseScoreboard, type RosterEntry } from "@/lib/scoreboard";
import { AlertTriangle, ArrowLeft, Trophy } from "lucide-react";

interface Roster extends RosterEntry {
  teamName: string | null;
  slotNumber: number | null;
}
interface Data {
  tournament: { id: string; title: string; status: string; roomSize: number };
  prizes: { position: number; amount: number }[];
  roster: Roster[];
}

export default function AdminResultsEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<Data>({ queryKey: ["admin", "tournament-results", id], queryFn: () => api.get<Data>(`/api/admin/tournaments/${id}/results`) });
  const [paste, setPaste] = useState("");
  const [killReward, setKillReward] = useState("0");
  const [rows, setRows] = useState<Record<string, { placement: string; kills: string }>>({});
  const [unmatched, setUnmatched] = useState<string[]>([]);

  const settle = useMutation({
    mutationFn: (body: unknown) => api.post<{ players: number; winners: number; paidPaise: number }>(`/api/admin/tournaments/${id}/results`, body),
    onSuccess: (r) => {
      toast({ title: "Results settled", description: `${r.winners} winners paid ${formatPaise(r.paidPaise)}`, tone: "success" });
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast({ title: "Could not settle", description: e instanceof ApiClientError ? e.message : "", tone: "error" }),
  });

  const prizeFor = useMemo(() => new Map((data?.prizes ?? []).map((p) => [p.position, p.amount])), [data]);

  if (isLoading || !data) return <Skeleton className="h-96 rounded-2xl" />;

  const applyPaste = () => {
    const { lines, bad } = parseScoreboard(paste);
    const next = { ...rows };
    const miss: string[] = [...bad.map((b) => `Could not read: ${b}`)];
    for (const l of lines) {
      const p = matchPlayer(l.name, data.roster);
      if (!p) miss.push(`Not registered in this tournament: ${l.name}`);
      else next[p.participantId] = { placement: String(l.placement), kills: String(l.kills) };
    }
    setRows(next);
    setUnmatched(miss);
  };

  const filled = data.roster.filter((r) => rows[r.participantId]?.placement);
  const kr = Number(killReward) || 0;
  const squad = data.tournament.roomSize > 1;
  const est = filled.reduce((sum, r) => {
    const v = rows[r.participantId];
    const pl = Number(v.placement);
    const teamKey = squad ? (r.slotNumber ?? r.teamName ?? r.participantId) : r.participantId;
    const sharers = filled.filter((o) => Number(rows[o.participantId].placement) === pl && (squad ? (o.slotNumber ?? o.teamName ?? o.participantId) : o.participantId) === teamKey).length || 1;
    return sum + Math.floor((prizeFor.get(pl) ?? 0) / sharers) + (Number(v.kills) || 0) * Math.round(kr * 100);
  }, 0);

  const submit = () => {
    if (filled.length === 0) return toast({ title: "Enter at least one placement", tone: "error" });
    if (!confirm(`Settle results for ${filled.length} players and pay about ${formatPaise(est)}? This cannot be undone.`)) return;
    settle.mutate({
      killRewardRupees: kr,
      rows: filled.map((r) => ({ participantId: r.participantId, placement: Number(rows[r.participantId].placement), kills: Number(rows[r.participantId].kills) || 0 })),
    });
  };

  const done = data.tournament.status === "COMPLETED" || settle.isSuccess;

  return (
    <div className="space-y-5">
      <Link href={`/admin/tournaments/${id}`} className="flex items-center gap-1.5 text-sm text-white/50">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2"><Trophy className="h-6 w-6 text-gold" /> Enter Results</h1>
        <p className="text-sm text-white/50 mt-1">{data.tournament.title}</p>
      </div>

      {done ? (
        <Card className="p-5 text-sm text-signal font-semibold">Results are settled and prizes are paid. This tournament is complete.</Card>
      ) : (
        <>
          <Card className="p-4 space-y-3">
            <h2 className="font-bold text-white text-sm">1. Paste the scoreboard (optional)</h2>
            <p className="text-xs text-white/50">One player per line: <span className="font-mono">placement, name, kills</span> (for example <span className="font-mono">1, ShadowStrike, 7</span>). Names are matched to each player&apos;s in-game name, game UID or username.</p>
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={5} className="w-full rounded-xl bg-surface-2 border border-white/10 p-3 text-sm text-white font-mono" placeholder={"1, ShadowStrike, 7\n2, NightOwl, 4"} />
            <Button variant="secondary" onClick={applyPaste} disabled={!paste.trim()}>Fill table</Button>
            {unmatched.length > 0 && (
              <ul className="space-y-1">
                {unmatched.map((u) => (
                  <li key={u} className="flex items-start gap-2 text-xs text-gold"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{u}</li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <h2 className="font-bold text-white text-sm">2. Check placement and kills</h2>
            <div className="flex items-center gap-2 text-xs text-white/60">
              Extra prize per kill (₹)
              <input value={killReward} onChange={(e) => setKillReward(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="w-20 h-8 rounded-lg bg-surface-2 border border-white/10 px-2 text-white text-sm" />
            </div>
            <div className="divide-y divide-white/5">
              {data.roster.map((r) => {
                const v = rows[r.participantId] ?? { placement: "", kills: "" };
                const set = (patch: Partial<typeof v>) => setRows((s) => ({ ...s, [r.participantId]: { ...v, ...patch } }));
                return (
                  <div key={r.participantId} className="py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{r.ign || r.username}</p>
                      <p className="text-[11px] text-white/40 truncate">
                        {r.username}{r.gameUid ? ` · UID ${r.gameUid}` : " · no game UID"}{r.teamName ? ` · ${r.teamName}` : ""}
                      </p>
                    </div>
                    <input aria-label={`Placement for ${r.username}`} value={v.placement} onChange={(e) => set({ placement: e.target.value.replace(/\D/g, "") })} placeholder="Rank" inputMode="numeric" className="w-14 h-9 rounded-lg bg-surface-2 border border-white/10 px-2 text-center text-white text-sm" />
                    <input aria-label={`Kills for ${r.username}`} value={v.kills} onChange={(e) => set({ kills: e.target.value.replace(/\D/g, "") })} placeholder="Kills" inputMode="numeric" className="w-14 h-9 rounded-lg bg-surface-2 border border-white/10 px-2 text-center text-white text-sm" />
                  </div>
                );
              })}
              {data.roster.length === 0 && <p className="py-3 text-sm text-white/50">No players joined this tournament.</p>}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <p className="text-sm text-white/70">{filled.length} of {data.roster.length} players filled. Estimated payout: <span className="font-bold text-signal">{formatPaise(est)}</span></p>
            <Button fullWidth variant="cta" loading={settle.isPending} onClick={submit}>Settle &amp; pay prizes</Button>
            <p className="text-[11px] text-white/40">Players you leave blank get no result. Prizes go to winning balance; squads split each placement prize equally.</p>
          </Card>
        </>
      )}
    </div>
  );
}
