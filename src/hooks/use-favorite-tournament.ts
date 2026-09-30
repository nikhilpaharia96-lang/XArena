"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "xarena:favorite-tournaments";

function readFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Client-only favorite/wishlist toggle. There is no backend favorites table
 * yet, so this intentionally stores a per-device list in localStorage rather
 * than inventing a fake API — it never affects tournament or join data,
 * purely a personal UI convenience that persists across visits.
 */
export function useFavoriteTournament(tournamentId: string | undefined) {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    // Deferred so this stays an async sync-from-external-storage effect
    // rather than a synchronous setState call in the effect body — avoids
    // an SSR/client hydration mismatch on the heart icon's filled state.
    const id = setTimeout(() => setFavorites(readFavorites()), 0);
    return () => clearTimeout(id);
  }, []);

  const isFavorite = Boolean(tournamentId && favorites.includes(tournamentId));

  const toggle = useCallback(() => {
    if (!tournamentId) return;
    setFavorites((prev) => {
      const next = prev.includes(tournamentId) ? prev.filter((id) => id !== tournamentId) : [...prev, tournamentId];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage unavailable (private mode, etc.) — favorite just won't persist.
      }
      return next;
    });
  }, [tournamentId]);

  return { isFavorite, toggle };
}
