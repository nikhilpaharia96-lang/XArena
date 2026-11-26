"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Users, LogIn, Trophy } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-auth";
import { useProfile, type ProfileData } from "@/hooks/use-profile";
import { useGames } from "@/hooks/use-tournaments";

type TournamentEntry = ProfileData["tournamentHistory"][number];
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FriendsPanel } from "@/components/friends/friends-panel";
import { TeamsPanel } from "@/components/teams/teams-panel";
import { useTeams } from "@/hooks/use-teams";
import { cn } from "@/lib/cn";

/**
 * XArena doesn't have a dedicated Team entity (no roster management,
 * invites, etc. in the schema/API) — squads are just a free-text
 * `teamName` captured per tournament entry (TournamentParticipant.teamName).
 * Rather than fabricate a team-management feature that doesn't exist on
 * the backend, this page gives an honest, real view: the squad names the
 * player has actually competed under, grouped from their tournament
 * history, with a link back into each tournament.
 */
function SquadsSection() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: games } = useGames();
  const { data: teamsData } = useTeams();
  const realTeamNames = useMemo(() => new Set((teamsData?.teams ?? []).map((x) => x.name.trim().toLowerCase())), [teamsData]);

  const gameNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of games ?? []) map.set(g.id, g.name);
    return map;
  }, [games]);

  const squads = useMemo(() => {
    const map = new Map<string, { teamName: string; entries: TournamentEntry[] }>();
    for (const entry of profile?.tournamentHistory ?? []) {
      if (!entry.teamName) continue;
      const key = entry.teamName.trim().toLowerCase();
      if (realTeamNames.has(key)) continue; // already shown above as a real team
      if (!map.has(key)) map.set(key, { teamName: entry.teamName, entries: [] });
      map.get(key)!.entries.push(entry);
    }
    return [...map.values()].sort((a, b) => b.entries.length - a.entries.length);
  }, [profile, realTeamNames]);

  const soloCount = (profile?.tournamentHistory ?? []).filter((e) => !e.teamName).length;

  if (!profileLoading && squads.length === 0) return null;

  return (
    <div className="space-y-5 pt-2">
      <div>
        <h2 className="text-sm font-bold text-white">Past tournament squads</h2>
        <p className="text-xs text-white/45">Squad names you&apos;ve entered tournaments under</p>
      </div>

      {profileLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : squads.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No squads yet"
          description="Join a squad-format tournament and enter a team name — it'll show up here."
          action={
            <Link href="/tournaments">
              <Button size="sm">Browse Tournaments</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {squads.map((squad) => (
            <Card key={squad.teamName} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-11 w-11 rounded-2xl gradient-brand flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {squad.teamName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm truncate">{squad.teamName}</p>
                  <p className="text-xs text-white/45">
                    {squad.entries.length} tournament{squad.entries.length === 1 ? "" : "s"} entered
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                {squad.entries.slice(0, 4).map((e) => (
                  <Link
                    key={e.id}
                    href={`/tournaments/${e.slug}`}
                    className="flex items-center justify-between rounded-xl bg-white/5 hover:bg-white/8 px-3 py-2 text-xs"
                  >
                    <span className="text-white/75 truncate flex items-center gap-1.5">
                      <Trophy className="h-3 w-3 text-gold shrink-0" />
                      {e.title}
                    </span>
                    <span className="text-white/40 shrink-0 ml-2">{gameNameById.get(e.gameId) ?? ""}</span>
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {soloCount > 0 && (
        <p className="text-xs text-white/35 text-center">
          Plus {soloCount} solo {soloCount === 1 ? "entry" : "entries"} with no team name.
        </p>
      )}
    </div>
  );
}

export default function TeamsPage() {
  const { data: me, isLoading: meLoading } = useCurrentUser();
  const [tab, setTab] = useState<"friends" | "teams">("friends");
  const { data: teamsData } = useTeams();
  const teamInvites = teamsData?.invites.length ?? 0;

  if (meLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!me) {
    return (
      <EmptyState
        icon={LogIn}
        title="Log in to see your teams"
        description="Add friends, chat with them and see the squads you've played with."
        action={
          <Link href="/login">
            <Button size="sm">Login</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-black text-white">My Teams</h1>
        <p className="text-sm text-white/45 mt-0.5">Friends, chat and your teams</p>
      </div>

      <div className="flex gap-2">
        {([["friends", "Friends & Chat"], ["teams", "My Teams"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn("h-9 rounded-full border px-4 text-xs font-semibold", tab === id ? "gradient-brand border-transparent text-white" : "border-white/10 bg-white/5 text-white/60")}
          >
            {label}
            {id === "teams" && teamInvites > 0 && <span className="ml-1.5 rounded-full bg-crimson px-1.5 text-[11px] font-bold text-white">{teamInvites}</span>}
          </button>
        ))}
      </div>

      {tab === "friends" ? <FriendsPanel meId={me.user.id} /> : <TeamsPanel meId={me.user.id} footer={<SquadsSection />} />}
    </div>
  );
}
