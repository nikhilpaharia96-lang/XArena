"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRightLeft, Eye, Lock, LockOpen, Trash2, Users } from "lucide-react";
import {
  useAdminRegistrations,
  useRegistrationAction,
  type AdminBoardPosition,
  type AdminBoardSlot,
  type AdminOccupant,
  type AdminRegistrationBoard,
} from "@/hooks/use-admin";
import { ApiClientError } from "@/lib/api-client";
import { toast } from "@/lib/toast-store";
import { cn } from "@/lib/cn";
import { formatDateTime, formatPaise } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";

const errMsg = (e: unknown) => (e instanceof ApiClientError || e instanceof Error ? e.message : "Something went wrong.");

type Target = { slot: AdminBoardSlot; pos: AdminBoardPosition };

const cellStyle = {
  AVAILABLE: "bg-surface-2 border-white/15 text-white hover:border-violet/60",
  OCCUPIED: "bg-signal/10 border-signal/30 text-signal hover:border-signal/70",
  LOCKED: "bg-crimson/10 border-crimson/30 text-crimson hover:border-crimson/60",
} as const;

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <Card className="p-3 text-center">
      <p className={cn("text-lg font-black font-mono", tone ?? "text-white")}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-white/40 mt-0.5">{label}</p>
    </Card>
  );
}

const payTone = { PAID: "signal", UNPAID: "crimson", FREE: "neutral" } as const;

export function RegistrationManager({ id }: { id: string }) {
  const { data: b, isLoading, isError, refetch } = useAdminRegistrations(id);
  const act = useRegistrationAction(id);

  const [target, setTarget] = useState<Target | null>(null);
  const [viewing, setViewing] = useState<AdminOccupant | null>(null);
  const [moving, setMoving] = useState<AdminOccupant | null>(null);
  const [removing, setRemoving] = useState<AdminOccupant | null>(null);

  const run = (input: Parameters<typeof act.mutate>[0], okMsg: string, after?: () => void) =>
    act.mutate(input, {
      onSuccess: (res) => {
        toast({ title: okMsg, description: res?.refunded ? `Refunded ${formatPaise(res.refunded)} to the player's wallet.` : undefined, tone: "success" });
        after?.();
      },
      onError: (e) => toast({ title: "Action failed", description: errMsg(e), tone: "error" }),
    });

  if (isLoading) return <Skeleton className="h-72 rounded-2xl" />;
  if (isError || !b) return <ErrorState message="Couldn't load registrations." onRetry={() => refetch()} />;

  const editable = b.editable;
  const teams = b.layout.teamSize > 1;
  const canToggleReg = editable && ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"].includes(b.tournament.status);

  const players = b.slots
    .flatMap((s) => s.positions.filter((p) => p.occupant).map((p) => ({ slot: s, pos: p, o: p.occupant! })))
    .sort((a, c) => a.slot.slotNumber - c.slot.slotNumber || a.pos.position - c.pos.position);

  return (
    <section className="space-y-5" aria-label="Registrations and slots">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-black text-white text-lg flex items-center gap-2"><Users className="h-5 w-5 text-violet" /> Registrations &amp; Slots</h2>
        {canToggleReg && (
          <Button
            size="sm"
            variant={b.registrationOpen ? "secondary" : "primary"}
            loading={act.isPending}
            onClick={() => run({ action: "registration", open: !b.registrationOpen }, b.registrationOpen ? "Registration closed" : "Registration reopened")}
          >
            {b.registrationOpen ? <><Lock className="h-3.5 w-3.5" /> Close registration</> : <><LockOpen className="h-3.5 w-3.5" /> Reopen registration</>}
          </Button>
        )}
      </div>

      {/* Overview — every number comes from the database */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Total capacity" value={b.counts.capacity} />
        <Stat label="Registered" value={b.counts.registered} tone="text-signal" />
        <Stat label="Available" value={b.counts.available} tone="text-gold" />
        <Stat label="Locked" value={b.counts.locked} tone="text-crimson" />
        <Card className="p-3 text-center col-span-2 sm:col-span-1 flex flex-col items-center justify-center">
          <Badge tone={b.registrationOpen ? "signal" : "neutral"}>{b.registrationOpen ? (b.canAcceptNow ? "Open" : "Open · not accepting") : "Closed"}</Badge>
          <p className="text-[10px] uppercase tracking-wide text-white/40 mt-1.5">Registration</p>
        </Card>
      </div>

      {!b.slotSelection && (
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-white/60">Slot selection is OFF — players are assigned automatically. You can still move or lock slots.</p>
      )}
      {b.counts.unassigned > 0 && (
        <p role="status" className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2.5 text-xs text-gold">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-px" /> {b.counts.unassigned} registration(s) counted on this tournament have no seat in the grid below
          {b.unseated.length ? " (listed under “Registered without a seat”)." : "."}
        </p>
      )}

      {/* Slot grid */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white">Slot grid</h3>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/50">
            {(["AVAILABLE", "OCCUPIED", "LOCKED"] as const).map((s) => (
              <li key={s} className="flex items-center gap-1.5"><span className={cn("h-3.5 w-3.5 rounded border", cellStyle[s].split(" hover")[0])} aria-hidden /> {s.charAt(0) + s.slice(1).toLowerCase()}</li>
            ))}
          </ul>
        </div>
        {b.slots.length === 0 ? (
          <p className="text-sm text-white/40">No slots configured for this tournament.</p>
        ) : !teams ? (
          <div className="grid grid-cols-5 min-[400px]:grid-cols-6 sm:grid-cols-10 gap-2">
            {b.slots.map((s) => (
              <button
                key={s.slotNumber}
                type="button"
                onClick={() => setTarget({ slot: s, pos: s.positions[0] })}
                aria-label={`Slot ${s.slotNumber}, ${s.positions[0].state.toLowerCase()}${s.positions[0].occupant ? `, ${s.positions[0].occupant.username}` : ""}`}
                className={cn("h-11 rounded-xl border text-xs font-bold grid place-items-center", cellStyle[s.positions[0].state])}
              >
                {s.positions[0].state === "LOCKED" ? <Lock className="h-3.5 w-3.5" /> : s.slotNumber}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {b.slots.map((s) => (
              <div key={s.slotNumber} className={cn("rounded-2xl border p-3 space-y-2", s.locked ? "border-crimson/25 bg-crimson/5" : "border-white/10")}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-white">{s.label}</p>
                  {s.locked ? <Badge tone="crimson">Locked</Badge> : null}
                </div>
                {s.positions.map((p) => (
                  <button
                    key={p.position}
                    type="button"
                    onClick={() => setTarget({ slot: s, pos: p })}
                    className={cn("w-full min-h-[44px] rounded-xl border px-3 flex items-center justify-between gap-2 text-left", cellStyle[p.state])}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/10 text-[11px] font-black">{p.label}</span>
                      <span className="text-sm font-semibold truncate">{p.occupant ? p.occupant.username : p.state === "LOCKED" ? "Locked" : "Available"}</span>
                    </span>
                    {p.state === "LOCKED" && <Lock className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Registered players */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-white">Registered Players ({players.length})</h3>
        {players.length === 0 ? (
          <Card className="p-4 text-sm text-white/40">No one has registered yet.</Card>
        ) : (
          <Card className="divide-y divide-white/5">
            {players.map(({ slot, pos, o }) => (
              <div key={o.participantId} className="p-3.5 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{o.username}</p>
                  <p className="text-xs text-white/45 truncate">IGN: {o.ign ?? "—"} · UID: <span className="font-mono">{o.gameUid ?? "—"}</span></p>
                </div>
                <div className="text-xs text-white/60">
                  <p>{slot.label}{teams ? ` · Player ${pos.label}` : ""}</p>
                  <p className="text-white/35">{formatDateTime(o.joinedAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={payTone[o.paymentStatus]}>{o.paymentStatus === "FREE" ? "Free" : `${o.paymentStatus === "PAID" ? "Paid" : "Unpaid"} ${formatPaise(o.entryFee)}`}</Badge>
                  <Badge tone="violet">{o.status}</Badge>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" aria-label={`View ${o.username}`} onClick={() => setViewing(o)}><Eye className="h-3.5 w-3.5" /></Button>
                  {editable && <Button size="sm" variant="ghost" aria-label={`Move ${o.username}`} onClick={() => setMoving(o)}><ArrowRightLeft className="h-3.5 w-3.5" /></Button>}
                  {editable && <Button size="sm" variant="ghost" aria-label={`Remove ${o.username}`} onClick={() => setRemoving(o)}><Trash2 className="h-3.5 w-3.5 text-crimson" /></Button>}
                </div>
              </div>
            ))}
          </Card>
        )}

        {teams && b.slots.some((s) => s.positions.some((p) => p.occupant)) && (
          <Card className="p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-white/50">By team</h4>
            {b.slots.filter((s) => s.positions.some((p) => p.occupant)).map((s) => (
              <div key={s.slotNumber}>
                <p className="text-sm font-bold text-white">{s.label}</p>
                {s.positions.map((p) => (
                  <p key={p.position} className="text-sm text-white/60 pl-3">
                    {p.label} — <span className={p.occupant ? "text-white" : "text-white/35"}>{p.occupant ? p.occupant.username : p.state === "LOCKED" ? "Locked" : "Available"}</span>
                  </p>
                ))}
              </div>
            ))}
          </Card>
        )}

        {b.unseated.length > 0 && (
          <Card className="p-4 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-gold">Registered without a seat ({b.unseated.length})</h4>
            {b.unseated.map((u) => (
              <div key={u.participantId} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-white truncate">{u.username}</span>
                {editable && (
                  <Button size="sm" variant="secondary" onClick={() => setMoving({ participantId: u.participantId, username: u.username, userId: u.userId, ign: u.ign, gameUid: u.gameUid, teamName: null, joinedAt: u.joinedAt, status: u.status, entryFee: 0, paymentStatus: "FREE" })}>
                    Assign seat
                  </Button>
                )}
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Slot dialog (click on any cell) */}
      <Dialog open={Boolean(target)} onClose={() => setTarget(null)} title={target ? `${target.slot.label}${teams ? ` · Player ${target.pos.label}` : ""}` : ""}>
        {target && (
          <div className="space-y-4">
            <Badge tone={target.pos.state === "OCCUPIED" ? "signal" : target.pos.state === "LOCKED" ? "crimson" : "neutral"}>{target.pos.state}</Badge>
            {target.pos.occupant ? (
              <div className="space-y-3">
                <PlayerDetails o={target.pos.occupant} />
                {editable && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => { setMoving(target.pos.occupant); setTarget(null); }}><ArrowRightLeft className="h-3.5 w-3.5" /> Move</Button>
                    <Button size="sm" variant="danger" onClick={() => { setRemoving(target.pos.occupant); setTarget(null); }}><Trash2 className="h-3.5 w-3.5" /> Remove</Button>
                  </div>
                )}
              </div>
            ) : target.slot.locked ? (
              <div className="space-y-3">
                <p className="text-sm text-white/60">This {teams ? "team slot" : "slot"} is locked and can&apos;t be picked by players.</p>
                {editable && <Button loading={act.isPending} onClick={() => run({ action: "unlock", slotNumber: target.slot.slotNumber }, "Slot unlocked", () => setTarget(null))}><LockOpen className="h-4 w-4" /> Unlock {target.slot.label}</Button>}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-white/60">Available. Locking {teams ? "this team" : "this slot"} stops players from selecting it.</p>
                {editable && (
                  <Button variant="secondary" loading={act.isPending} onClick={() => run({ action: "lock", slotNumber: target.slot.slotNumber }, "Slot locked", () => setTarget(null))}>
                    <Lock className="h-4 w-4" /> Lock {target.slot.label}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Dialog>

      <Dialog open={Boolean(viewing)} onClose={() => setViewing(null)} title="Player">
        {viewing && <PlayerDetails o={viewing} />}
      </Dialog>

      <MoveDialog board={b} player={moving} onClose={() => setMoving(null)} busy={act.isPending}
        onMove={(slotNumber, position) => moving && run({ action: "move", participantId: moving.participantId, slotNumber, position }, "Player moved", () => setMoving(null))} />

      <RemoveDialog player={removing} onClose={() => setRemoving(null)} busy={act.isPending} paid={b.tournament.entryFee > 0}
        onRemove={(refund) => removing && run({ action: "remove", participantId: removing.participantId, refund }, "Registration removed", () => setRemoving(null))} />
    </section>
  );
}

function PlayerDetails({ o }: { o: AdminOccupant }) {
  const rows: [string, React.ReactNode][] = [
    ["Player", o.username],
    ["In-game name", o.ign ?? "—"],
    ["Game UID", <span key="u" className="font-mono">{o.gameUid ?? "—"}</span>],
    ...(o.teamName ? ([["Team name", o.teamName]] as [string, React.ReactNode][]) : []),
    ["Payment", o.paymentStatus === "FREE" ? "Free entry" : `${o.paymentStatus === "PAID" ? "Paid" : "Unpaid"} · ${formatPaise(o.entryFee)}`],
    ["Status", o.status],
    ["Registered", formatDateTime(o.joinedAt)],
  ];
  return (
    <dl className="space-y-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-3 text-sm">
          <dt className="text-white/45">{k}</dt>
          <dd className="font-semibold text-white text-right break-all">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function MoveDialog({ board, player, onClose, onMove, busy }: { board: AdminRegistrationBoard; player: AdminOccupant | null; onClose: () => void; onMove: (slot: number, pos: number) => void; busy: boolean }) {
  const [slotNo, setSlotNo] = useState<number | null>(null);
  const [pos, setPos] = useState<number | null>(null);
  const free = useMemo(
    () => board.slots.map((s) => ({ ...s, free: s.locked ? [] : s.positions.filter((p) => p.state === "AVAILABLE") })).filter((s) => s.free.length > 0),
    [board]
  );
  const chosen = free.find((s) => s.slotNumber === slotNo);
  const close = () => { setSlotNo(null); setPos(null); onClose(); };

  return (
    <Dialog open={Boolean(player)} onClose={close} title="Move player">
      {player && (
        <div className="space-y-4">
          <p className="text-sm text-white/60">Choose a free {board.layout.teamSize > 1 ? "team and position" : "slot"} for <span className="font-semibold text-white">{player.username}</span>.</p>
          {free.length === 0 ? (
            <p className="text-sm text-gold">There are no free positions to move to.</p>
          ) : (
            <>
              <div>
                <label htmlFor="mv-slot" className="text-xs font-semibold text-white/60 mb-1.5 block">{board.layout.teamSize > 1 ? "Team" : "Slot"}</label>
                <select id="mv-slot" value={slotNo ?? ""} onChange={(e) => { setSlotNo(Number(e.target.value) || null); setPos(board.layout.teamSize === 1 ? 1 : null); }}
                  className="w-full h-12 rounded-xl bg-surface-2 border border-white/10 px-3 text-sm text-white">
                  <option value="">Select…</option>
                  {free.map((s) => <option key={s.slotNumber} value={s.slotNumber}>{s.label}</option>)}
                </select>
              </div>
              {board.layout.teamSize > 1 && chosen && (
                <div>
                  <label htmlFor="mv-pos" className="text-xs font-semibold text-white/60 mb-1.5 block">Position</label>
                  <select id="mv-pos" value={pos ?? ""} onChange={(e) => setPos(Number(e.target.value) || null)} className="w-full h-12 rounded-xl bg-surface-2 border border-white/10 px-3 text-sm text-white">
                    <option value="">Select…</option>
                    {chosen.free.map((p) => <option key={p.position} value={p.position}>Player {p.label}</option>)}
                  </select>
                </div>
              )}
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={close}>Cancel</Button>
            <Button size="sm" disabled={!slotNo || !pos} loading={busy} onClick={() => slotNo && pos && onMove(slotNo, pos)}>Move player</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function RemoveDialog({ player, onClose, onRemove, busy, paid }: { player: AdminOccupant | null; onClose: () => void; onRemove: (refund: boolean) => void; busy: boolean; paid: boolean }) {
  const [refund, setRefund] = useState(true);
  return (
    <Dialog open={Boolean(player)} onClose={onClose} title="Remove registration">
      {player && (
        <div className="space-y-4">
          <p className="text-sm text-white/70"><span className="font-semibold text-white">{player.username}</span> will be removed and their slot freed for other players.</p>
          {paid && (
            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 cursor-pointer min-h-[44px]">
              <input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} className="mt-0.5 h-5 w-5 accent-orange-500" />
              <span className="text-sm text-white/80">Refund the entry fee to the player&apos;s wallet</span>
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Keep</Button>
            <Button variant="danger" size="sm" loading={busy} onClick={() => onRemove(paid && refund)}><Trash2 className="h-3.5 w-3.5" /> Remove</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
