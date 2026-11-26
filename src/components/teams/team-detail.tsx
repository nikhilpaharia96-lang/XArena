"use client";
import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Crown, Pencil, Trophy, UserMinus, UserPlus, X } from "lucide-react";
import {
  useCancelTeamInvite, useDisbandTeam, useInviteToTeam, useRemoveTeamMember, useTeamDetail, useTransferCaptain,
  useUpdateMyTeamDetails, useUpdateTeam, type TeamDetail,
} from "@/hooks/use-teams";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { UserAvatar, displayNameOf } from "@/components/friends/user-avatar";
import { ApiClientError } from "@/lib/api-client";
import { validateGameUid, validateIgn } from "@/lib/game-uid";
import { formatDateTimeFull } from "@/lib/format";
import { toast } from "@/lib/toast-store";

const errToast = (title: string) => (e: unknown) =>
  toast({ title, description: e instanceof ApiClientError ? e.message : "Try again.", tone: "error" });

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div>
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {hint && <p className="text-xs text-white/45">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Two-step button: first click asks, second click does it. */
function ConfirmButton({ label, confirmLabel, onConfirm, loading, tone = "danger" }: { label: React.ReactNode; confirmLabel: string; onConfirm: () => void; loading?: boolean; tone?: "danger" | "secondary" }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <Button size="sm" variant={tone} onClick={() => setAsking(true)}>{label}</Button>;
  return (
    <span className="inline-flex gap-1.5">
      <Button size="sm" variant="danger" loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      <Button size="sm" variant="secondary" disabled={loading} onClick={() => setAsking(false)}>Cancel</Button>
    </span>
  );
}

function EditTeamDialog({ d, onClose }: { d: TeamDetail; onClose: () => void }) {
  const [name, setName] = useState(d.team.name);
  const [tag, setTag] = useState(d.team.tag);
  const update = useUpdateTeam(d.team.id);
  return (
    <Dialog open onClose={onClose} title="Edit team">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({ name, tag }, { onSuccess: () => { toast({ title: "Team updated", tone: "success" }); onClose(); }, onError: errToast("Couldn't update team") });
        }}
      >
        <div className="grid grid-cols-[1fr_96px] gap-3">
          <div>
            <label htmlFor="t-name" className="mb-1.5 block text-xs font-semibold text-white/60">Team name</label>
            <Input id="t-name" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="t-tag" className="mb-1.5 block text-xs font-semibold text-white/60">Tag</label>
            <Input id="t-tag" value={tag} maxLength={5} onChange={(e) => setTag(e.target.value.toUpperCase())} />
          </div>
        </div>
        <Button type="submit" fullWidth loading={update.isPending}>Save</Button>
      </form>
    </Dialog>
  );
}

function MyDetailsDialog({ d, mine, onClose }: { d: TeamDetail; mine: TeamDetail["members"][number]; onClose: () => void }) {
  const [ign, setIgn] = useState(mine.ign ?? "");
  const [uid, setUid] = useState(mine.gameUid ?? "");
  const save = useUpdateMyTeamDetails(d.team.id);
  const ignErr = ign ? validateIgn(ign) : null;
  const uidErr = uid ? validateGameUid(d.team.game.slug, uid) : null;
  const valid = !validateIgn(ign) && !validateGameUid(d.team.game.slug, uid);
  return (
    <Dialog open onClose={onClose} title={`My ${d.team.game.name} details`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ ign: ign.trim(), gameUid: uid.trim() }, { onSuccess: () => { toast({ title: "Details saved", tone: "success" }); onClose(); }, onError: errToast("Couldn't save") });
        }}
      >
        <p className="text-xs text-white/50">Your teammates and the captain see these. They also prefill when you register for a tournament as this team.</p>
        <div>
          <label htmlFor="my-ign" className="mb-1.5 block text-xs font-semibold text-white/60">In-game name (IGN)</label>
          <Input id="my-ign" value={ign} maxLength={40} autoComplete="off" error={ignErr ?? undefined} onChange={(e) => setIgn(e.target.value)} />
        </div>
        <div>
          <label htmlFor="my-uid" className="mb-1.5 block text-xs font-semibold text-white/60">Game UID</label>
          <Input id="my-uid" value={uid} maxLength={40} autoComplete="off" error={uidErr ?? undefined} onChange={(e) => setUid(e.target.value)} />
        </div>
        <Button type="submit" fullWidth disabled={!valid} loading={save.isPending}>Save</Button>
      </form>
    </Dialog>
  );
}

export function TeamDetailView({ teamId, meId, onBack }: { teamId: string; meId: string; onBack: () => void }) {
  const { data: d, isLoading, isError, refetch, error } = useTeamDetail(teamId);
  const invite = useInviteToTeam(teamId);
  const cancelInvite = useCancelTeamInvite();
  const remove = useRemoveTeamMember(teamId);
  const transfer = useTransferCaptain(teamId);
  const disband = useDisbandTeam(teamId);
  const [editing, setEditing] = useState(false);
  const [editingMe, setEditingMe] = useState(false);

  // Kicked / team disbanded while open → the detail call 404s: go back to the list.
  if (isError && error instanceof ApiClientError && error.statusCode === 404) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="text-sm text-white/60">This team no longer exists or you are not a member.</p>
        <Button size="sm" onClick={onBack}>Back to my teams</Button>
      </div>
    );
  }
  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !d) return <div className="space-y-3"><Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>;

  const isCaptain = d.myRole === "CAPTAIN";
  const mine = d.members.find((m) => m.user.id === meId)!;
  const ready = d.members.filter((m) => m.ign && m.gameUid).length;
  const done = (title: string) => () => toast({ title, tone: "success" });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} aria-label="Back to teams" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/5">
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl gradient-brand text-sm font-black text-white">{d.team.tag}</div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-black text-white">{d.team.name}</h2>
          <p className="text-xs text-white/45">{d.team.game.name} · {d.members.length}/{d.team.maxMembers} players</p>
        </div>
        {isCaptain && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
        )}
      </div>

      <Section title="Roster" hint={`${ready} of ${d.members.length} players have set their in-game name and UID.`}>
        <div className="space-y-2">
          {d.members.map((m) => {
            const me = m.user.id === meId;
            return (
              <Card key={m.user.id} className="p-3">
                <div className="flex items-center gap-3">
                  <UserAvatar user={m.user} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-bold text-white">
                      {displayNameOf(m.user)}{me && <span className="text-white/40">(you)</span>}
                      {m.role === "CAPTAIN" && <Badge tone="gold"><Crown className="h-3 w-3" /> Captain</Badge>}
                    </p>
                    {m.ign && m.gameUid ? (
                      <p className="truncate text-xs text-white/55">IGN <b className="text-white/80">{m.ign}</b> · UID <span className="font-mono">{m.gameUid}</span></p>
                    ) : (
                      <p className="flex items-center gap-1 text-xs text-gold"><AlertTriangle className="h-3 w-3" /> Game details not set</p>
                    )}
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap justify-end gap-1.5">
                  {me && <Button size="sm" variant="secondary" onClick={() => setEditingMe(true)}><Pencil className="h-3.5 w-3.5" /> My details</Button>}
                  {isCaptain && !me && (
                    <>
                      <ConfirmButton tone="secondary" label={<><Crown className="h-3.5 w-3.5" /> Make captain</>} confirmLabel="Hand over captaincy" loading={transfer.isPending}
                        onConfirm={() => transfer.mutate(m.user.id, { onSuccess: done("Captaincy handed over"), onError: errToast("Couldn't hand over") })} />
                      <ConfirmButton label={<><UserMinus className="h-3.5 w-3.5" /> Remove</>} confirmLabel="Remove" loading={remove.isPending}
                        onConfirm={() => remove.mutate(m.user.id, { onSuccess: done("Member removed"), onError: errToast("Couldn't remove") })} />
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      {isCaptain && (
        <Section title="Invite players" hint={d.members.length >= d.team.maxMembers ? "Your team is full." : "Only your friends can be invited. They'll get a notification and must accept."}>
          {d.invites.length > 0 && (
            <div className="space-y-2">
              {d.invites.map((i) => (
                <div key={i.inviteId} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-3 py-2.5">
                  <UserAvatar user={i.user} size={36} />
                  <p className="min-w-0 flex-1 truncate text-sm text-white">{displayNameOf(i.user)} <span className="text-xs text-white/40">· invite pending</span></p>
                  <Button size="sm" variant="secondary" aria-label={`Cancel invite for ${i.user.username}`} loading={cancelInvite.isPending && cancelInvite.variables === i.inviteId}
                    onClick={() => cancelInvite.mutate(i.inviteId, { onError: errToast("Couldn't cancel") })}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
          {d.inviteableFriends.length > 0 ? (
            <div className="space-y-2">
              {d.inviteableFriends.map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-3 py-2.5">
                  <UserAvatar user={f} size={36} />
                  <p className="min-w-0 flex-1 truncate text-sm text-white">{displayNameOf(f)} <span className="text-xs text-white/40">@{f.username}</span></p>
                  <Button size="sm" disabled={d.members.length >= d.team.maxMembers} loading={invite.isPending && invite.variables === f.id}
                    onClick={() => invite.mutate(f.id, { onSuccess: done(`Invite sent to ${f.username}`), onError: errToast("Couldn't invite") })}>
                    <UserPlus className="h-4 w-4" /> Invite
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            d.invites.length === 0 && <p className="text-sm text-white/45">No friends to invite yet. Add players in the <b>Friends &amp; Chat</b> tab first.</p>
          )}
        </Section>
      )}

      <Section title="Tournaments" hint="Entries made under this team">
        {d.tournaments.length > 0 ? (
          <div className="space-y-2">
            {d.tournaments.map((t) => (
              <Link key={t.id} href={`/tournaments/${t.slug}`} className="block rounded-2xl bg-white/[0.03] px-3 py-2.5 hover:bg-white/5">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-white"><Trophy className="h-3.5 w-3.5 shrink-0 text-gold" />{t.title}</p>
                <p className="mt-0.5 text-xs text-white/45">{formatDateTimeFull(t.matchStartsAt)} · Registered: {t.players.join(", ")}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-white/[0.03] p-4 text-center">
            <p className="text-sm text-white/50">No tournaments yet. Every player joins individually — pick this team under &ldquo;Play as team&rdquo; while registering.</p>
            <Link href="/tournaments" className="mt-2 inline-block text-xs font-semibold text-violet">Browse tournaments</Link>
          </div>
        )}
      </Section>

      <Section title={isCaptain ? "Danger zone" : "Leave team"}>
        {isCaptain ? (
          <div className="flex flex-wrap items-center gap-3">
            <ConfirmButton label="Disband team" confirmLabel="Yes, disband" loading={disband.isPending}
              onConfirm={() => disband.mutate(undefined, { onSuccess: () => { toast({ title: "Team disbanded", tone: "success" }); onBack(); }, onError: errToast("Couldn't disband") })} />
            <p className="text-xs text-white/40">Removes the team for everyone. To leave instead, hand over captaincy first.</p>
          </div>
        ) : (
          <ConfirmButton label="Leave team" confirmLabel="Yes, leave" loading={remove.isPending}
            onConfirm={() => remove.mutate(meId, { onSuccess: () => { toast({ title: "You left the team", tone: "success" }); onBack(); }, onError: errToast("Couldn't leave") })} />
        )}
      </Section>

      {editing && <EditTeamDialog d={d} onClose={() => setEditing(false)} />}
      {editingMe && <MyDetailsDialog d={d} mine={mine} onClose={() => setEditingMe(false)} />}
    </div>
  );
}
