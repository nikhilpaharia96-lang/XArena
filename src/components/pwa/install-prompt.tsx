"use client";
import { useEffect, useRef, useState } from "react";
import { BellRing, Download, Share, SquarePlus, Smartphone, Zap } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-auth";
import { useInstallApp, usePush } from "@/hooks/use-pwa";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { readPromptState, shouldShowInstall, writePromptState } from "@/lib/pwa";
import { toast } from "@/lib/toast-store";

type Step = "install" | "ios" | "notify";

const SHOW_DELAY_MS = 2_000;

function Hero({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="-mt-2 mb-5 text-center">
      <div className="relative mx-auto mb-4 h-28 w-28">
        <div className="absolute inset-0 rounded-[2rem] bg-cobalt/40 blur-2xl" aria-hidden />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-512.png" alt="XArena app icon" width={112} height={112} className="relative h-28 w-28 rounded-[1.75rem] shadow-2xl ring-1 ring-white/15" />
      </div>
      <h2 className="text-xl font-black text-white">{title}</h2>
      <p className="mt-1 text-sm text-white/55">{subtitle}</p>
    </div>
  );
}

const perks = [
  { icon: Smartphone, text: "One tap from your home screen — no browser, no typing the link" },
  { icon: Zap, text: "Opens full-screen and loads faster, like a real app" },
  { icon: BellRing, text: "Get match, room ID and wallet alerts instantly" },
];

/**
 * The "get the app" sheet. Shown right after a player's first login on a device (once more after 3 days if they
 * closed it, then never again), then — separately — asks to turn on notifications.
 */
export function InstallPrompt() {
  const { data: me } = useCurrentUser();
  const app = useInstallApp();
  const push = usePush();
  const [step, setStep] = useState<Step | null>(null);
  const [busy, setBusy] = useState(false);
  const decided = useRef<string | null>(null);
  const userId = me?.user.id;

  // Decide what (if anything) to show, once per signed-in user per page load.
  const ready = !!userId && !push.loading && !!app;
  const installable = app.canPrompt || app.needsIosSteps;
  useEffect(() => {
    if (!ready || !userId || decided.current === userId) return;
    const timer = setTimeout(() => {
      const state = readPromptState(userId);
      if (app.isInstalled) {
        if (push.canAsk && !state?.notifyAsked) { decided.current = userId; setStep("notify"); }
        return;
      }
      if (installable && shouldShowInstall(state, Date.now())) {
        decided.current = userId;
        writePromptState(userId, { count: (state?.count ?? 0) + 1, lastShownAt: Date.now() });
        setStep(app.needsIosSteps ? "ios" : "install");
      } else if (push.canAsk && !state?.notifyAsked && !app.needsIosSteps) {
        decided.current = userId;
        setStep("notify");
      }
    }, SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [ready, userId, installable, app.isInstalled, app.needsIosSteps, push.canAsk]);

  if (!step || !userId) return null;

  const toNotifyOrClose = () => {
    const state = readPromptState(userId);
    if (push.canAsk && !state?.notifyAsked && !app.needsIosSteps) setStep("notify");
    else setStep(null);
  };
  const close = () => {
    if (step === "notify") writePromptState(userId, { notifyAsked: true });
    if (step === "notify" || step === "ios") setStep(null);
    else toNotifyOrClose();
  };

  const doInstall = async () => {
    setBusy(true);
    try {
      const outcome = await app.install();
      if (outcome === "accepted") {
        writePromptState(userId, { installed: true });
        toast({ title: "XArena installed 🎉", description: "Find it on your home screen.", tone: "success" });
      }
    } finally {
      setBusy(false);
      toNotifyOrClose();
    }
  };

  const doNotify = async () => {
    setBusy(true);
    writePromptState(userId, { notifyAsked: true });
    const r = await push.enable();
    setBusy(false);
    if (r === "ok") toast({ title: "Notifications on 🔔", tone: "success" });
    else if (r === "denied") toast({ title: "Notifications blocked", description: "You can allow them later from your browser's site settings.", tone: "error" });
    setStep(null);
  };

  return (
    <Dialog open onClose={close} title={step === "notify" ? "Stay in the game" : "Get the XArena app"}>
      {step === "notify" ? (
        <>
          <Hero title="Never miss a match" subtitle="Turn on notifications for tournament room IDs, results and wallet updates." />
          <Button fullWidth size="lg" loading={busy} onClick={doNotify}><BellRing className="h-4 w-4" /> Allow notifications</Button>
          <button type="button" onClick={close} className="mt-2 h-11 w-full rounded-xl text-sm font-semibold text-white/50 hover:text-white">Not now</button>
        </>
      ) : step === "ios" ? (
        <>
          <Hero title="Add XArena to your Home Screen" subtitle="Use it like an app — and get notifications on iPhone." />
          <ol className="space-y-3 rounded-2xl bg-white/[0.04] p-4 text-sm text-white/80">
            <li className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cobalt/20 text-cobalt"><Share className="h-4 w-4" /></span><span>Tap the <b>Share</b> button in Safari&apos;s toolbar</span></li>
            <li className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cobalt/20 text-cobalt"><SquarePlus className="h-4 w-4" /></span><span>Choose <b>Add to Home Screen</b></span></li>
            <li className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cobalt/20 text-cobalt"><Download className="h-4 w-4" /></span><span>Tap <b>Add</b>, then open XArena from your Home Screen</span></li>
          </ol>
          <Button fullWidth size="lg" className="mt-4" onClick={close}>Got it</Button>
        </>
      ) : (
        <>
          <Hero title="Play faster with the app" subtitle="Install XArena on your phone — free, takes 5 seconds, no app store." />
          <ul className="mb-5 space-y-2.5">
            {perks.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-white/75">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cobalt/20 text-cobalt"><Icon className="h-3.5 w-3.5" /></span>
                {text}
              </li>
            ))}
          </ul>
          <Button fullWidth size="lg" loading={busy} onClick={doInstall}><Download className="h-4 w-4" /> Install App</Button>
          <button type="button" onClick={close} className="mt-2 h-11 w-full rounded-xl text-sm font-semibold text-white/50 hover:text-white">Not now</button>
        </>
      )}
    </Dialog>
  );
}
