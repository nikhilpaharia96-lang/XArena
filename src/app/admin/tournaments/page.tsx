"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  useAdminTournaments,
  useDeleteTournament,
  useToggleFeatured,
  useTournamentAction,
  type AdminTournamentRow,
} from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { StatCard } from "@/components/ui/stat-card";
import { formatPaise, formatDateTime, formatRelativeTime, statusLabel } from "@/lib/format";
import { toast } from "@/lib/toast-store";
import { Plus, Trophy, Copy, Ban, Send, Search, Star, Trash2, Pencil, RefreshCw, Users, Wallet, Radio, FileText } from "lucide-react";

type Tone = "signal" | "gold" | "crimson" | "violet" | "neutral";

const statusTone: Record<string, Tone> = {
  DRAFT: "neutral",
  PUBLISHED: "violet",
  REGISTRATION_OPEN: "gold",
  REGISTRATION_CLOSED: "gold",
  LIVE: "crimson",
  COMPLETED: "signal",
  CANCELLED: "neutral",
};

const STATUS_TABS = ["ALL", "DRAFT", "PUBLISHED", "REGISTRATION_OPEN", "LIVE", "COMPLETED", "CANCELLED"] as const;

type SortKey = "newest" | "starting" | "prize" | "fill";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "starting", label: "Starting soon" },
  { key: "prize", label: "Biggest prize" },
  { key: "fill", label: "Most filled" },
];

const CANCEL_REASONS = ["Not enough players joined", "Technical issue with the room", "Scheduling conflict", "Duplicate tournament"];

// Bad/legacy rows (null or invalid dates, missing fields) must never crash the whole page.
const validDate = (iso?: string | null) => Boolean(iso) && !Number.isNaN(new Date(iso as string).getTime());
const safeDateTime = (iso?: string | null) => (validDate(iso) ? formatDateTime(iso as string) : "—");
const safeRelative = (iso?: string | null) => {
  if (!validDate(iso)) return "";
  try {
    return formatRelativeTime(iso as string);
  } catch {
    return "";
  }
};
const safeLabel = (v?: string | null) => (v ? statusLabel(v) : "—");

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

function FillBar({ filled, max }: { filled: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round(((filled ?? 0) / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${pct >= 100 ? "bg-signal" : "gradient-brand"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-mono text-white/50 whitespace-nowrap">
        {filled ?? 0}/{max ?? 0}
      </span>
    </div>
  );
}

function CancelDialog({ t, onClose }: { t: AdminTournamentRow | null; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const cancel = useTournamentAction(t?.id ?? "", "cancel");
  const refund = t ? (t.entryFee ?? 0) * (t.slotsFilled ?? 0) : 0;
  const valid = reason.trim().length >= 5;

  const close = () => {
    setReason("");
    onClose();
  };

  return (
    <Dialog open={Boolean(t)} onClose={close} title="Cancel tournament">
      {t && (
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            <span className="font-semibold text-white">{t.title}</span> cancel hoga.
            {refund > 0
              ? ` ${t.slotsFilled} players ko total ${formatPaise(refund)} refund hoga.`
              : " Koi paid participant nahi hai, refund ki zaroorat nahi."}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {CANCEL_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className="px-2.5 h-7 rounded-full text-[11px] border border-white/10 bg-white/5 text-white/60 hover:text-white"
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Reason (min 5 characters)"
            className="w-full rounded-xl bg-surface-2 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-violet/60"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={close}>
              Keep it
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={!valid}
              loading={cancel.isPending}
              onClick={() =>
                cancel.mutate(
                  { reason: reason.trim() },
                  {
                    onSuccess: () => {
                      toast({ title: "Tournament cancelled", tone: "success" });
                      close();
                    },
                    onError: (e) => toast({ title: errMsg(e), tone: "error" }),
                  }
                )
              }
            >
              <Ban className="h-3.5 w-3.5" /> Cancel tournament
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function DeleteDialog({ t, onClose }: { t: AdminTournamentRow | null; onClose: () => void }) {
  const del = useDeleteTournament();
  return (
    <Dialog open={Boolean(t)} onClose={onClose} title="Delete tournament">
      {t && (
        <div className="space-y-4">
          <p className="text-sm text-white/70">
            <span className="font-semibold text-white">{t.title}</span> permanently delete ho jayega. Ye undo nahi hoga.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={del.isPending}
              onClick={() =>
                del.mutate(t.id, {
                  onSuccess: () => {
                    toast({ title: "Tournament deleted", tone: "success" });
                    onClose();
                  },
                  onError: (e) => toast({ title: errMsg(e), tone: "error" }),
                })
              }
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function TournamentRowActions({
  t,
  onCancel,
  onDelete,
}: {
  t: AdminTournamentRow;
  onCancel: (t: AdminTournamentRow) => void;
  onDelete: (t: AdminTournamentRow) => void;
}) {
  const publish = useTournamentAction(t.id, "publish");
  const clone = useTournamentAction(t.id, "clone");
  const feature = useToggleFeatured();
  const featured = Boolean(t.isFeatured);
  const editable = !["LIVE", "COMPLETED"].includes(t.status);
  const cancellable = !["COMPLETED", "CANCELLED"].includes(t.status);
  const deletable = t.slotsFilled === 0 && ["DRAFT", "CANCELLED"].includes(t.status);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {t.status === "DRAFT" && (
        <Button
          size="sm"
          variant="secondary"
          loading={publish.isPending}
          onClick={() =>
            publish.mutate(undefined, {
              onSuccess: () => toast({ title: "Published", tone: "success" }),
              onError: (e) => toast({ title: errMsg(e), tone: "error" }),
            })
          }
        >
          <Send className="h-3.5 w-3.5" /> Publish
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        aria-label={featured ? "Remove from featured" : "Mark as featured"}
        title={featured ? "Remove from featured" : "Mark as featured"}
        loading={feature.isPending}
        onClick={() =>
          feature.mutate(
            { id: t.id, isFeatured: !featured },
            {
              onSuccess: () => toast({ title: featured ? "Removed from featured" : "Marked as featured", tone: "success" }),
              onError: (e) => toast({ title: errMsg(e), tone: "error" }),
            }
          )
        }
      >
        <Star className={`h-3.5 w-3.5 ${featured ? "fill-gold text-gold" : ""}`} />
      </Button>
      {editable && (
        <Link href={`/admin/tournaments/${t.id}`} aria-label="Edit / manage" title="Manage">
          <Button size="sm" variant="ghost" aria-label="Manage">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </Link>
      )}
      <Button
        size="sm"
        variant="ghost"
        aria-label="Clone as draft"
        title="Clone as draft"
        loading={clone.isPending}
        onClick={() =>
          clone.mutate(undefined, {
            onSuccess: () => toast({ title: "Cloned as draft", tone: "success" }),
            onError: (e) => toast({ title: errMsg(e), tone: "error" }),
          })
        }
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      {cancellable && (
        <Button size="sm" variant="ghost" aria-label="Cancel tournament" title="Cancel tournament" onClick={() => onCancel(t)}>
          <Ban className="h-3.5 w-3.5 text-crimson" />
        </Button>
      )}
      {deletable && (
        <Button size="sm" variant="ghost" aria-label="Delete" title="Delete" onClick={() => onDelete(t)}>
          <Trash2 className="h-3.5 w-3.5 text-crimson" />
        </Button>
      )}
    </div>
  );
}

export default function AdminTournamentsPage() {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>("ALL");
  const [search, setSearch] = useState("");
  const [game, setGame] = useState("ALL");
  const [sort, setSort] = useState<SortKey>("newest");
  const [cancelTarget, setCancelTarget] = useState<AdminTournamentRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminTournamentRow | null>(null);

  // Fetch everything once; status counts, search, game filter and sort all run client-side.
  const { data, isLoading, isError, error, refetch, isFetching } = useAdminTournaments();

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: data?.length ?? 0 };
    for (const t of data ?? []) c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [data]);

  const games = useMemo(() => Array.from(new Set((data ?? []).map((t) => t.gameName))).sort(), [data]);

  const stats = useMemo(() => {
    const rows = data ?? [];
    const active = rows.filter((t) => !["CANCELLED", "DRAFT"].includes(t.status));
    return {
      live: rows.filter((t) => t.status === "LIVE").length,
      drafts: rows.filter((t) => t.status === "DRAFT").length,
      players: active.reduce((n, t) => n + (t.slotsFilled ?? 0), 0),
      collected: active.reduce((n, t) => n + (t.slotsFilled ?? 0) * (t.entryFee ?? 0), 0),
    };
  }, [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (data ?? []).filter(
      (t) =>
        (status === "ALL" || t.status === status) &&
        (game === "ALL" || t.gameName === game) &&
        (!q ||
          (t.title ?? "").toLowerCase().includes(q) ||
          (t.gameName ?? "").toLowerCase().includes(q) ||
          (t.slug ?? "").toLowerCase().includes(q))
    );
    const fill = (t: AdminTournamentRow) => (t.maxSlots ? (t.slotsFilled ?? 0) / t.maxSlots : 0);
    const sorters: Record<SortKey, (a: AdminTournamentRow, b: AdminTournamentRow) => number> = {
      newest: (a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
      starting: (a, b) => (a.matchStartsAt ?? "").localeCompare(b.matchStartsAt ?? ""),
      prize: (a, b) => (b.prizePool ?? 0) - (a.prizePool ?? 0),
      fill: (a, b) => fill(b) - fill(a),
    };
    return [...list].sort(sorters[sort]);
  }, [data, status, game, search, sort]);

  const filtersActive = status !== "ALL" || game !== "ALL" || search.trim() !== "";
  const resetFilters = () => {
    setStatus("ALL");
    setGame("ALL");
    setSearch("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">Tournaments</h1>
          <p className="text-xs text-white/40 mt-0.5">Create, publish and manage every tournament.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" aria-label="Refresh" onClick={() => refetch()} loading={isFetching && !isLoading}>
            {!(isFetching && !isLoading) && <RefreshCw className="h-4 w-4" />}
          </Button>
          <Link href="/admin/tournaments/new">
            <Button>
              <Plus className="h-4 w-4" /> New Tournament
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Live now" value={stats.live} icon={Radio} tone="text-crimson" />
        <StatCard label="Drafts" value={stats.drafts} icon={FileText} tone="text-white/60" />
        <StatCard label="Players joined" value={stats.players} icon={Users} tone="text-violet" />
        <StatCard label="Entry fees collected" value={formatPaise(stats.collected)} icon={Wallet} tone="text-signal" />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, game or slug"
            className="w-full rounded-xl bg-surface-2 border border-white/10 pl-10 pr-4 h-10 text-sm text-white placeholder:text-white/35 outline-none focus:border-violet/60"
          />
        </div>
        <select
          value={game}
          onChange={(e) => setGame(e.target.value)}
          className="h-10 rounded-xl bg-surface-2 border border-white/10 px-3 text-sm text-white outline-none"
          aria-label="Filter by game"
        >
          <option value="ALL">All games</option>
          {games.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-10 rounded-xl bg-surface-2 border border-white/10 px-3 text-sm text-white outline-none"
          aria-label="Sort"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3.5 h-8 rounded-full text-xs font-semibold whitespace-nowrap border flex items-center gap-1.5 ${
              status === s ? "gradient-brand text-white border-transparent" : "bg-white/5 text-white/60 border-white/10"
            }`}
          >
            {s === "ALL" ? "All" : statusLabel(s)}
            <span className={`font-mono text-[10px] ${status === s ? "text-white/80" : "text-white/35"}`}>{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={errMsg(error)} onRetry={() => refetch()} />
      ) : rows.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-white/35">
            Showing {rows.length} of {data?.length ?? 0}
          </p>
          {rows.map((t) => (
            <Card key={t.id} className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {Boolean(t.isFeatured) && <Star className="h-3.5 w-3.5 fill-gold text-gold shrink-0" />}
                  <Link href={`/admin/tournaments/${t.id}`} className="font-bold text-white text-sm hover:text-violet truncate">
                    {t.title}
                  </Link>
                  <Badge tone={statusTone[t.status] ?? "neutral"}>{statusLabel(t.status)}</Badge>
                  <Badge tone={t.format === "FREE" ? "signal" : "cobalt"}>{t.format === "FREE" ? "Free" : "Paid"}</Badge>
                </div>
                <p className="text-xs text-white/40">
                  {t.gameName} · {safeLabel(t.mode)} · {t.format === "FREE" ? "Free entry" : `${formatPaise(t.entryFee)} entry`} ·{" "}
                  {formatPaise(t.prizePool)} pool
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  Starts {safeDateTime(t.matchStartsAt)}
                  {!["COMPLETED", "CANCELLED"].includes(t.status) && safeRelative(t.matchStartsAt) && (
                    <span className="text-white/30"> ({safeRelative(t.matchStartsAt)})</span>
                  )}
                </p>
              </div>
              <FillBar filled={t.slotsFilled} max={t.maxSlots} />
              <TournamentRowActions t={t} onCancel={setCancelTarget} onDelete={setDeleteTarget} />
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Trophy}
          title={filtersActive ? "No tournaments match your filters" : "No tournaments yet"}
          description={filtersActive ? "Try a different search or clear the filters." : "Create your first tournament to get started."}
          action={
            filtersActive ? (
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : (
              <Link href="/admin/tournaments/new">
                <Button size="sm">
                  <Plus className="h-4 w-4" /> New Tournament
                </Button>
              </Link>
            )
          }
        />
      )}

      <CancelDialog t={cancelTarget} onClose={() => setCancelTarget(null)} />
      <DeleteDialog t={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}
