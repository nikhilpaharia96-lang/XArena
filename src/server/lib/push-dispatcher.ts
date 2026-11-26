import webpush from "web-push";
import { db } from "@/server/db/client";
import { drainOutbox, pushConfig, type PushSender } from "./push";

const TICK_MS = 5_000;

declare global {
  // Survives dev hot-reloads so we never run two timers.
  var __xarenaPushTimer: ReturnType<typeof setInterval> | undefined;
}

/** Started once from instrumentation.ts when the Node server boots. No-op without VAPID keys. */
export function startPushDispatcher() {
  if (globalThis.__xarenaPushTimer) return;
  const cfg = pushConfig();
  if (!cfg) {
    console.warn("[push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — push notifications are disabled.");
    return;
  }
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
  const send: PushSender = async (target, payload, options) => {
    await webpush.sendNotification(target, payload, { TTL: options.TTL, urgency: options.urgency });
  };

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const s = await drainOutbox(db, send);
      if (s.sent || s.failed || s.pruned) console.log(`[push] sent=${s.sent} failed=${s.failed} pruned=${s.pruned}`);
    } catch (e) {
      console.error("[push] dispatcher error", e);
    } finally {
      running = false;
    }
  };
  globalThis.__xarenaPushTimer = setInterval(tick, TICK_MS);
  globalThis.__xarenaPushTimer.unref?.();
  console.log("[push] dispatcher started");
}
