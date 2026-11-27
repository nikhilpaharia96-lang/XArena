import { db } from "@/server/db/client";
import { releaseDueRooms } from "@/server/lib/room-release";

/** Keeps scheduled room releases on time even when nobody has the app open. */
const g = globalThis as { __roomTimer?: ReturnType<typeof setInterval> };
if (!g.__roomTimer) {
  g.__roomTimer = setInterval(() => {
    try {
      releaseDueRooms(db);
    } catch (err) {
      console.error("[rooms] auto-release failed:", err);
    }
  }, 30_000);
}
