import { Download, EllipsisVertical, Share, SquarePlus } from "lucide-react";

function Step({ icon: Icon, children }: { icon: typeof Share; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cobalt/20 text-cobalt">
        <Icon className="h-4 w-4" />
      </span>
      <span>{children}</span>
    </li>
  );
}

/** iPhone / iPad Safari has no install prompt, so people add the app from the Share menu. */
export function IosInstallSteps() {
  return (
    <ol className="space-y-3 rounded-2xl bg-white/[0.04] p-4 text-sm text-white/80">
      <Step icon={Share}>Tap the <b>Share</b> button in Safari&apos;s toolbar</Step>
      <Step icon={SquarePlus}>Choose <b>Add to Home Screen</b></Step>
      <Step icon={Download}>Tap <b>Add</b>, then open XArena from your Home Screen</Step>
    </ol>
  );
}

/** Browsers that don't offer a one-tap install: point people to the browser's own menu. */
export function BrowserInstallSteps() {
  return (
    <ol className="space-y-3 rounded-2xl bg-white/[0.04] p-4 text-sm text-white/80">
      <Step icon={EllipsisVertical}>Open your browser menu <b>(⋮)</b></Step>
      <Step icon={Download}>Tap <b>Install app</b> or <b>Add to Home screen</b></Step>
      <Step icon={SquarePlus}>Confirm, then open XArena from your Home Screen</Step>
    </ol>
  );
}
