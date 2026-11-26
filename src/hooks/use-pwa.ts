"use client";
import { useCallback, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-auth";
import { isIOS, isStandalone, urlBase64ToUint8Array } from "@/lib/pwa";
import { usePwaStore } from "@/lib/pwa-store";

const noopSubscribe = () => () => {};

/** Install state + the install action. */
export function useInstallApp() {
  const installEvent = usePwaStore((s) => s.installEvent);
  const setInstallEvent = usePwaStore((s) => s.setInstallEvent);
  const installedFlag = usePwaStore((s) => s.installed);
  // Browser-only facts: false on the server and during hydration, the real value afterwards.
  const standalone = useSyncExternalStore(noopSubscribe, isStandalone, () => false);
  const ios = useSyncExternalStore(noopSubscribe, isIOS, () => false);

  /** Resolves to what the player chose; "unavailable" when the browser has no install prompt (iOS uses steps instead). */
  const install = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!installEvent) return "unavailable";
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    setInstallEvent(null); // the event can only be used once
    return outcome;
  }, [installEvent, setInstallEvent]);

  const isInstalled = standalone || installedFlag;
  return {
    isStandalone: standalone,
    isInstalled,
    isIOS: ios,
    /** One-tap install is possible (Android / desktop Chrome & Edge). */
    canPrompt: !isInstalled && !!installEvent,
    /** iPhone/iPad Safari: no prompt exists, so we show "Share → Add to Home Screen". */
    needsIosSteps: !isInstalled && ios,
    install,
  };
}

interface PushConfig { enabled: boolean; publicKey: string | null }
type LocalPush = { supported: boolean; permission: NotificationPermission | "unsupported"; subscribed: boolean };

async function readLocalPush(): Promise<LocalPush> {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return { supported: false, permission: "unsupported", subscribed: false };
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return { supported: true, permission: Notification.permission, subscribed: !!sub };
}

/** Subscribes this device (re-using an existing subscription) and tells the server. Safe to call repeatedly. */
export async function subscribeAndSync(publicKey: string) {
  const reg = await navigator.serviceWorker.ready;
  const options = { userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) };
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe(options);
    } catch (e) {
      // A stale subscription made with an older key blocks a new one: drop it and retry once.
      if ((e as Error).name !== "InvalidStateError") throw e;
      await (await reg.pushManager.getSubscription())?.unsubscribe();
      sub = await reg.pushManager.subscribe(options);
    }
  }
  await api.post("/api/push/subscribe", sub.toJSON());
}

export function usePush() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  // Signed-out visitors never see notification UI, so don't even ask the server.
  const config = useQuery<PushConfig>({ queryKey: ["push", "config"], enabled: !!me, queryFn: () => api.get("/api/push/config"), staleTime: 10 * 60_000 });
  const local = useQuery<LocalPush>({ queryKey: ["push", "local"], enabled: !!me, queryFn: readLocalPush, staleTime: 0 });

  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ["push", "local"] }), [qc]);

  const enable = useCallback(async (): Promise<"ok" | "denied" | "unsupported" | "unavailable" | "error"> => {
    const publicKey = config.data?.publicKey;
    if (!config.data?.enabled || !publicKey) return "unavailable";
    if (!("serviceWorker" in navigator && "PushManager" in window && "Notification" in window)) return "unsupported";
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { await refresh(); return "denied"; }
      await subscribeAndSync(publicKey);
      await refresh();
      return "ok";
    } catch {
      await refresh();
      return "error";
    }
  }, [config.data, refresh]);

  const disable = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api.post("/api/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
      await sub.unsubscribe();
    }
    await refresh();
  }, [refresh]);

  const l = local.data;
  return {
    /** Server has VAPID keys configured. */
    serverEnabled: !!config.data?.enabled,
    publicKey: config.data?.publicKey ?? null,
    supported: !!l?.supported,
    permission: l?.permission ?? "unsupported",
    subscribed: !!l?.subscribed,
    loading: config.isLoading || local.isLoading,
    /** Worth showing the "turn on notifications" step: supported, configured, and the player hasn't decided yet. */
    canAsk: !!config.data?.enabled && !!l?.supported && l.permission === "default",
    enable,
    disable,
  };
}
