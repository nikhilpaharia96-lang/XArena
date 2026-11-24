import Link from "next/link";
import { ArrowRight, Headset } from "lucide-react";

export function SupportCta() {
  return (
    <section className="rounded-3xl bg-surface border border-white/10 p-5 flex flex-wrap items-center gap-4">
      <div className="h-12 w-12 rounded-2xl bg-cobalt/15 border border-cobalt/25 flex items-center justify-center shrink-0">
        <Headset className="h-6 w-6 text-cobalt" />
      </div>
      <div className="flex-1 min-w-[10rem]">
        <p className="font-bold text-white text-sm">Need Help?</p>
        <p className="text-xs text-white/50">Our support team is here to help you.</p>
      </div>
      <Link
        href="/support"
        className="inline-flex items-center justify-center gap-1 shrink-0 max-[479px]:w-full rounded-xl bg-cobalt/15 border border-cobalt/30 px-4 h-11 text-sm font-bold text-cobalt"
      >
        Contact Support <ArrowRight className="h-3 w-3" />
      </Link>
    </section>
  );
}
