"use client";

import { useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { useInstallApp } from "@/hooks/use-pwa";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { BrowserInstallSteps, IosInstallSteps } from "@/components/pwa/install-steps";
import { toast } from "@/lib/toast-store";

/**
 * XArena is an installable web app (no app store). "Install App" opens the browser's one-tap install where it
 * exists (Android, Chrome/Edge); on iPhone and other browsers it shows the short manual steps instead.
 * Hidden once the app is already installed.
 */
export function AppDownloadBanner() {
  const app = useInstallApp();
  const [stepsOpen, setStepsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (app.isInstalled) return null;

  const onInstall = async () => {
    if (!app.canPrompt) {
      setStepsOpen(true);
      return;
    }
    setBusy(true);
    try {
      const outcome = await app.install();
      if (outcome === "accepted") toast({ title: "XArena installed 🎉", description: "Find it on your home screen.", tone: "success" });
      else if (outcome === "unavailable") setStepsOpen(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section
        className="hide-in-app force-dark relative rounded-3xl overflow-hidden border border-cobalt/20 p-5"
        style={{ background: "linear-gradient(135deg, #0B1728 0%, #142244 60%, var(--color-cobalt) 160%)" }}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-cobalt/20 border border-cobalt/30 flex items-center justify-center shrink-0">
            <Smartphone className="h-6 w-6 text-cobalt" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm">Download XArena App</p>
            <p className="text-xs text-white/60 mt-0.5">Get a better experience with our mobile app. Free, no app store.</p>
            <Button size="sm" className="mt-3" loading={busy} onClick={onInstall}>
              <Download className="h-4 w-4" /> Install App
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={stepsOpen} onClose={() => setStepsOpen(false)} title="Get the XArena app">
        <p className="mb-4 text-sm text-white/65">
          {app.needsIosSteps ? "Add XArena to your Home Screen to use it like an app." : "Install XArena from your browser. It takes a few seconds."}
        </p>
        {app.needsIosSteps ? <IosInstallSteps /> : <BrowserInstallSteps />}
        <Button fullWidth size="lg" className="mt-4" onClick={() => setStepsOpen(false)}>Got it</Button>
      </Dialog>
    </>
  );
}
