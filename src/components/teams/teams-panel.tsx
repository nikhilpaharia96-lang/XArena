"use client";
import { useState } from "react";
import { Check, ChevronRight, Crown, Plus, X } from "lucide-react";
import { useCreateTeam, useRespondToTeamInvite, useTeams, type TeamSummary } from "@/hooks/use-teams";
import { useGames } from "@/hooks/use-tournaments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { UserAvatar } from "@/components/friends/user-avatar";
import { TeamDetailView } from "./team-detail";
import { ApiClientError } from "@/lib/api-client";
import { validateGameUid, validateIgn } from "@/lib/game-uid";
import { formatRelativeTime } from "@/lib/format";
import { toast } from "@/lib/toast-store";
import { Users } from "lucide-react";

const errToast = (title: string) => (e: unknown) =>
  toast({ title, description: e instanceof ApiClientError ? e.message : "Try again.", tone: "error" });

function CreateTeamDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { data: games } = useGames();
  const create = useCreateTeam();
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [gameId, setGameId] = useState("");
  const [ign, setIgn] = useState("");
  const [uid, setUid] = useState("");

  const game = games?.find((g) => g.id === gameId);
  const ignErr = ign ? validateIgn(ign) : null;
  const uidErr = uid && game ? validateGameUid(game.slug, uid) : null;
  const canSubmit = name.trim().length >= 3 && tag.trim().length >= 2 && !!gameId && !ignErr && !uidErr;

  return (
    <Dialog open onClose={onClose} title="Create team">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          create.mutate(
            { name, tag, gameId, ign: ign.trim() || undefined, gameUid: uid.trim() || undefined },
            { onSuccess: (r) => { toast({ title: "Team created", tone: "success" }); onCreated(r.id); }, onError: errToast("Couldn't create team") }
          );
        }}
      >
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <div>
            <label htmlFor="c-name" className="mb-1.5 block text-xs font-semibold text-white/60">Team name *</label>
            <Input id="c-name" value={name} maxLength={24} autoComplete="off" placeholder="e.g. Team Phoenix" onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="c-tag" className="mb-1.5 block text-xs font-semibold text-white/60">Tag *</label>
            <Input id="c-tag" value={tag} maxLength={5} autoComplete="off" placeholder="PHX" onChange={(e) => setTag(e.target.value.toUpperCase())} />
          </div>
        </div>
        <div>
          <label htmlFor="c-game" className="mb-1.5 block text-xs font-semibold text-white/60">Game *</label>
          <select id="c-game" value={gameId} onChange={(e) => setGameId(e.target.value)}
            className="h-12 w-full rounded-xl border border-white/10 bg-surface-2 px-4 text-sm text-white outline-none focus:border-violet/60">
            <option value="">Select the game your team plays</option>
            {(games ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <p className="mt-1.5 text-xs text-white/40">You can be in one team per game.</p>
        </div>
        {gameId && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="c-ign" className="mb-1.5 block text-xs font-semibold text-white/60">Your IGN (optional)</label>
              <Input id="c-ign" value={ign} maxLength={40} autoComplete="off" error={ignErr ?? undefined} onChange={(e) => setIgn(e.target.value)} />
            </div>
            <div>
              <label htmlFor="c-uid" className="mb-1.5 block text-xs font-semibold text-white/60">Your Game UID (optional)</label>
              <Input id="c-uid" value={uid} maxLength={40} autoComplete="off" error={uidErr ?? undefined} onChange={(e) => setUid(e.target.value)} />
            </div>
          </div>
        )}
        <Button type="submit" fullWidth disabled={!canSubmit} loading={create.isPending}>Create team</Button>
      </form>
    </Dialog>
  );
}

function TeamCard({ t, onOpen }: { t: TeamSummary; onOpen: () => void }) {
  const open = Math.max(0, t.maxMembers - t.memberCount);
  return (
    <button onClick={onOpen} className="w-full text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt active:scale-[0.99] transition-transform">
      <Card className="p-4 transition-colors hover:bg-white/5">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl gradient-brand text-base font-black text-white shadow-[0_8px_20px_-10px_rgba(37,99,235,0.9)]">{t.tag}</div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[15px] font-bold text-white">
              <span className="truncate">{t.name}</span>
              {t.myRole === "CAPTAIN" && <Badge tone="gold"><Crown className="h-3 w-3" /> Captain</Badge>}
            </p>
            <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-semibold text-white/70">{t.game.name}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-white/30" />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-2">
              {t.members.slice(0, 5).map((m) => <UserAvatar key={m.id} user={m} size={28} className="ring-2 ring-surface" />)}
            </div>
            {Array.from({ length: Math.min(open, Math.max(0, 4 - t.members.length)) }).map((_, i) => (
              <span key={i} aria-hidden className="grid h-7 w-7 place-items-center rounded-full border border-dashed border-white/25 text-white/35"><Plus className="h-3 w-3" /></span>
            ))}
          </div>
          <p className="text-xs font-semibold text-white/60">
            {t.memberCount}/{t.maxMembers} players{open > 0 ? <span className="text-gold"> · {open} slot{open === 1 ? "" : "s"} open</span> : <span className="text-signal"> · Full squad</span>}
          </p>
        </div>
      </Card>
    </button>
  );
}

export function TeamsPanel({ meId, footer }: { meId: string; footer?: React.ReactNode }) {
  const { data, isLoading, isError, refetch } = useTeams();
  const respond = useRespondToTeamInvite();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (openId) return <TeamDetailView key={openId} teamId={openId} meId={meId} onBack={() => setOpenId(null)} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-white/60">Your squads and the game they play</p>
        <Button size="sm" className="shrink-0 whitespace-nowrap h-10" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Create team</Button>
      </div>

      {data && data.invites.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/40">Team invites ({data.invites.length})</h2>
          {data.invites.map((i) => (
            <Card key={i.inviteId} className="flex items-center gap-3 p-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl gradient-brand text-xs font-black text-white">{i.team.tag}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{i.team.name}</p>
                <p className="truncate text-xs text-white/45">{i.team.game.name} · from @{i.invitedBy.username} · {formatRelativeTime(i.createdAt)}</p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" loading={respond.isPending && respond.variables?.id === i.inviteId && respond.variables.action === "accept"}
                  onClick={() => respond.mutate({ id: i.inviteId, action: "accept" }, { onSuccess: (r) => { toast({ title: `Joined ${i.team.name}`, tone: "success" }); if (r.teamId) setOpenId(r.teamId); }, onError: errToast("Couldn't join") })}>
                  <Check className="h-4 w-4" /> Join
                </Button>
                <Button size="sm" variant="secondary" aria-label="Decline invite" disabled={respond.isPending}
                  onClick={() => respond.mutate({ id: i.inviteId, action: "decline" }, { onError: errToast("Couldn't decline") })}><X className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
        </section>
      )}

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : data && data.teams.length > 0 ? (
        <div className="space-y-2.5">{data.teams.map((t) => <TeamCard key={t.id} t={t} onOpen={() => setOpenId(t.id)} />)}</div>
      ) : (
        <div className="rounded-3xl border border-dashed border-violet/40 bg-violet/[0.06] p-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl gradient-brand"><Users className="h-7 w-7 text-white" /></span>
          <p className="mt-3 text-base font-black text-white">Build your squad</p>
          <p className="mt-1 text-sm text-white/60">Create a team for your game, invite friends and enter tournaments together.</p>
          <Button className="mt-4" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Create team</Button>
        </div>
      )}

      {footer}
      {creating && <CreateTeamDialog onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setOpenId(id); }} />}
    </div>
  );
}
