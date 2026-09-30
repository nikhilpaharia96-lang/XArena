import { Smartphone } from "lucide-react";

/** No app store links exist yet — labeled "Coming Soon" rather than a live
 * (and currently fake) download link. Update once the app actually ships. */
export function AppDownloadBanner() {
  return (
    <section className="relative rounded-3xl overflow-hidden border border-cobalt/20 p-5" style={{ background: "linear-gradient(135deg, #0B1728 0%, #142244 60%, var(--color-cobalt) 160%)" }}>
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-cobalt/20 border border-cobalt/30 flex items-center justify-center shrink-0">
          <Smartphone className="h-6 w-6 text-cobalt" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm">Download XArena App</p>
          <p className="text-xs text-white/55 mt-0.5">Get a better experience with our mobile app.</p>
          <span className="inline-flex items-center mt-3 rounded-xl bg-white/10 border border-white/15 px-4 h-9 text-xs font-bold text-white/70">
            Coming Soon
          </span>
        </div>
      </div>
    </section>
  );
}
