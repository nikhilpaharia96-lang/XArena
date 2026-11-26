"use client";
import { useState } from "react";
import { BellOff, BellRing } from "lucide-react";
import { usePush, useInstallApp } from "@/hooks/use-pwa";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast-store";

/** Row on the Notifications page to turn phone/browser push on or off. Hidden when the server has no push keys. */
export function PushToggle() {
  const push = usePush();
  const app = useInstallApp();
  const [busy, setBusy] = useState(false);

  if (push.loading || !push.serverEnabled) return null;

  const on = push.subscribed && push.permission === "granted";
  let hint = "Get match, room ID and wallet alerts even when XArena is closed.";
  let action: React.ReactNode = null;

  if (!push.supported) {
    hint = app.isIOS && !app.isStandalone
      ? "On iPhone, first add XArena to your Home Screen (Share → Add to Home Screen), then open it from there to enable notifications."
      : "This browser doesn't support push notifications.";
  } else if (push.permission === "denied") {
    hint = "Notifications are blocked for this site. Allow them in your browser's site settings, then come back.";
  } else if (on) {
    hint = "Alerts are on for this device.";
    action = <Button size="sm" variant="secondary" loading={busy} onClick={async () => { setBusy(true); await push.disable(); setBusy(false); }}>Turn off</Button>;
  } else {
    action = (
      <Button size="sm" loading={busy} onClick={async () => {
        setBusy(true);
        const r = await push.enable();
        setBusy(false);
        if (r === "ok") toast({ title: "Notifications on 🔔", tone: "success" });
        else if (r === "denied") toast({ title: "Notifications blocked", tone: "error" });
        else toast({ title: "Couldn't turn on notifications", description: "Try again in a moment.", tone: "error" });
      }}>Turn on</Button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cobalt/15 text-cobalt">
        {on ? <BellRing className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white">Phone notifications</p>
        <p className="text-xs text-white/50">{hint}</p>
      </div>
      {action}
    </div>
  );
}
