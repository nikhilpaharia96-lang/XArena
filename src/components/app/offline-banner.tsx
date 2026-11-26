"use client";
import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
};

/** Slim banner under the top bar while the phone has no connection. */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="sticky top-14 z-20 flex items-center justify-center gap-2 bg-amber-500/95 px-3 py-1.5 text-xs font-bold text-black">
      <WifiOff className="h-3.5 w-3.5" /> You&apos;re offline — showing what we have. We&apos;ll reconnect automatically.
    </div>
  );
}
