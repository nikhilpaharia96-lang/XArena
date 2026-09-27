import { Swords, Target, Crosshair, Trophy, Gamepad2 } from "lucide-react";

/**
 * Games in this app don't reliably have an iconUrl seeded, so we render a
 * themed lucide icon keyed by slug/name as a fallback. Real iconUrl (when
 * an admin sets one) always wins — see GameCard.
 */
export function GameTypeIcon({ slugOrName, className }: { slugOrName: string; className?: string }) {
  const s = slugOrName.toLowerCase();
  if (s.includes("cricket")) return <Trophy className={className} />;
  if (s.includes("valorant") || s.includes("cod") || s.includes("call of duty")) return <Crosshair className={className} />;
  if (s.includes("football") || s.includes("efootball")) return <Target className={className} />;
  if (s.includes("free-fire") || s.includes("free fire") || s.includes("bgmi") || s.includes("pubg")) return <Swords className={className} />;
  return <Gamepad2 className={className} />;
}
