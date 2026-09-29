"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * Profile fields the design shows but the User table doesn't store yet
 * (date of birth, gender, location, social handles, preferred games).
 * Kept per-user in localStorage until matching DB columns + API fields exist.
 */
export interface ProfileExtras {
  dob: string;
  gender: string;
  location: string;
  instagram: string;
  youtube: string;
  discord: string;
  preferredGames: string;
}

export const EMPTY_EXTRAS: ProfileExtras = {
  dob: "", gender: "", location: "", instagram: "", youtube: "", discord: "", preferredGames: "",
};

export function useProfileExtras(userId: string | undefined) {
  const key = userId ? `xarena:profile-extras:${userId}` : null;
  const [extras, setExtras] = useState<ProfileExtras>(EMPTY_EXTRAS);

  useEffect(() => {
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setExtras({ ...EMPTY_EXTRAS, ...JSON.parse(raw) });
    } catch {
      /* storage unavailable or corrupt: keep defaults */
    }
  }, [key]);

  const save = useCallback(
    (next: ProfileExtras) => {
      setExtras(next);
      if (!key) return;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* ignore quota / private mode */
      }
    },
    [key]
  );

  return { extras, save };
}
