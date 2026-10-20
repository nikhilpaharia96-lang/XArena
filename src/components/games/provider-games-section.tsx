"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dices, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import { launchProviderGame, useProviderGames, type ProviderGame } from "@/hooks/use-provider-games";

const CATEGORY_LABELS: Record<string, string> = {
  slots: "Slots",
  live_casino: "Live Casino",
  sportsbook: "Sportsbook",
  other: "Other",
};

export function categoryLabel(c: string): string {
  return CATEGORY_LABELS[c] ?? c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

interface Embedded {
  url: string;
  title: string;
}

export function ProviderGamesSection() {
  const [category, setCategory] = useState<string | undefined>();
  const { data, isLoading } = useProviderGames(category);
  const [launching, setLaunching] = useState<string | null>(null);
  const [embedded, setEmbedded] = useState<Embedded | null>(null);
  const qc = useQueryClient();

  // Nothing to show (provider not configured / not synced yet): render nothing so the page is unchanged.
  if (!isLoading && (!data || (data.games.length === 0 && !category))) return null;

  const play = async (game: ProviderGame) => {
    if (launching) return;
    setLaunching(game.id);
    // Open the tab synchronously inside the click so popup blockers allow it,
    // then point it at the game once the backend returns the (single-use) URL.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    try {
      const r = await launchProviderGame(game.id);
      if (r.embeddable) {
        tab?.close();
        setEmbedded({ url: r.gameUrl, title: game.title });
      } else if (tab) {
        tab.location.href = r.gameUrl; // live casino / sportsbook: top-level only, never an iframe
      } else {
        window.location.assign(r.gameUrl); // popup blocked: navigate top-level instead
      }
    } catch (e) {
      tab?.close();
      toast({ title: "Couldn't start the game", description: e instanceof ApiClientError ? e.message : "Please try again.", tone: "error" });
    } finally {
      setLaunching(null);
    }
  };

  const closeEmbedded = () => {
    setEmbedded(null); // drop the single-use URL
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <Dices className="h-5 w-5 text-violet" /> Casino Games
        </h2>
      </div>

      {data && data.categories.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
          {[undefined, ...data.categories].map((c) => (
            <button
              key={c ?? "all"}
              onClick={() => setCategory(c)}
              className={cn(
                "shrink-0 h-9 px-4 rounded-full text-sm font-semibold border transition-colors",
                category === c ? "bg-violet/15 text-violet border-violet/40" : "bg-white/5 text-white/60 border-white/10 hover:text-white"
              )}
            >
              {c ? categoryLabel(c) : "All"}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {data?.games.map((g) => (
            <Card key={g.id} className="overflow-hidden flex flex-col">
              <div className="aspect-[4/3] bg-surface-2 relative">
                {g.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.imageUrl} alt={g.title} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center"><Dices className="h-8 w-8 text-white/20" /></div>
                )}
              </div>
              <div className="p-3 flex flex-col gap-2 flex-1">
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm truncate" title={g.title}>{g.title}</p>
                  <p className="text-[11px] text-white/45 truncate">{g.provider} · {categoryLabel(g.category)}</p>
                </div>
                <Button size="sm" className="mt-auto" fullWidth loading={launching === g.id} disabled={launching !== null} onClick={() => play(g)}>
                  Play
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {embedded && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col" role="dialog" aria-label={embedded.title}>
          <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-white/10">
            <p className="text-sm font-semibold text-white truncate">{embedded.title}</p>
            <button onClick={closeEmbedded} className="h-9 w-9 rounded-xl hover:bg-white/10 flex items-center justify-center" aria-label="Close game">
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
          <iframe
            src={embedded.url}
            title={embedded.title}
            className="flex-1 w-full border-0"
            allow="autoplay; fullscreen; payment; clipboard-write"
            allowFullScreen
            referrerPolicy="origin"
          />
        </div>
      )}
    </section>
  );
}
