"use client";
import { useEffect, useRef } from "react";
import { useCurrentUser } from "@/hooks/use-auth";
import { subscribeAndSync, usePush } from "@/hooks/use-pwa";
import { usePwaStore } from "@/lib/pwa-store";
import { readPromptState, writePromptState } from "@/lib/pwa";

/** Mounted once in the root layout: registers the service worker, tracks installability, keeps push in sync. */
export function PwaProvider() {
  const { data: me } = useCurrentUser();
  const setInstallEvent = usePwaStore((s) => s.setInstallEvent);
  const setInstalled = usePwaStore((s) => s.setInstalled);
  const push = usePush();
  const synced = useRef(false);
  const userId = me?.user.id;

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
    if (window.__xarenaInstallEvent) setInstallEvent(window.__xarenaInstallEvent);
    const onInstallable = () => setInstallEvent(window.__xarenaInstallEvent ?? null);
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener("xarena:installable", onInstallable);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("xarena:installable", onInstallable);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [setInstallEvent, setInstalled]);

  // Opening the app from the home screen means it is installed: stop asking, whichever account is signed in.
  useEffect(() => {
    if (userId && window.matchMedia?.("(display-mode: standalone)").matches && !readPromptState(userId)?.installed) {
      writePromptState(userId, { installed: true });
    }
  }, [userId]);

  // Already allowed notifications on this device? Make sure the server has this device's subscription
  // (covers a new login on the same phone and subscriptions the push service rotated).
  useEffect(() => {
    if (synced.current || !userId || !push.serverEnabled || !push.publicKey || push.permission !== "granted") return;
    synced.current = true;
    subscribeAndSync(push.publicKey).catch(() => {
      synced.current = false;
    });
  }, [userId, push.serverEnabled, push.publicKey, push.permission]);

  return null;
}
