import Link from "next/link";
import { ChevronRight, Headset } from "lucide-react";
import { LEGAL_LAST_UPDATED, type LegalDoc } from "@/content/legal/types";

const DOCS = [
  { slug: "terms", label: "Terms & Conditions", href: "/terms" },
  { slug: "privacy", label: "Privacy Policy", href: "/privacy" },
  { slug: "refund", label: "Refund Policy", href: "/refund" },
] as const;

const id = (i: number) => `section-${i + 1}`;

/** Shared, readable layout for the policy pages (server component). */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <article className="max-w-3xl mx-auto">
      <nav aria-label="Policies" className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 mb-5">
        {DOCS.map((d) => (
          <Link
            key={d.slug}
            href={d.href}
            aria-current={d.slug === doc.slug ? "page" : undefined}
            className={`shrink-0 rounded-full px-3.5 h-9 inline-flex items-center text-xs font-bold border transition-colors ${
              d.slug === doc.slug ? "gradient-brand text-white border-transparent" : "bg-surface border-white/10 text-white/70 hover:text-white"
            }`}
          >
            {d.label}
          </Link>
        ))}
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{doc.title}</h1>
        <p className="text-xs text-white/50 mt-1.5">Last updated: {LEGAL_LAST_UPDATED}</p>
        <p className="text-sm text-white/70 leading-relaxed mt-4">{doc.intro}</p>
      </header>

      <details className="group rounded-2xl bg-surface border border-white/10 mb-8 sm:open" open>
        <summary className="cursor-pointer list-none flex items-center justify-between px-4 h-12 text-sm font-bold text-white">
          In this document
          <ChevronRight className="h-4 w-4 text-white/50 transition-transform group-open:rotate-90" />
        </summary>
        <ol className="px-4 pb-4 grid sm:grid-cols-2 gap-x-6 gap-y-1">
          {doc.sections.map((s, i) => (
            <li key={s.title}>
              <a href={`#${id(i)}`} className="flex gap-2 py-1.5 text-[13px] text-white/65 hover:text-white">
                <span className="text-cobalt font-bold tabular-nums w-5 shrink-0">{i + 1}.</span>
                <span>{s.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </details>

      <div className="space-y-8">
        {doc.sections.map((s, i) => (
          <section key={s.title} id={id(i)} className="scroll-mt-20">
            <h2 className="text-lg font-extrabold text-white flex gap-2.5">
              <span className="text-gold tabular-nums">{i + 1}.</span>
              {s.title}
            </h2>
            <div className="mt-2.5 space-y-3 text-sm leading-relaxed text-white/70">
              {s.paras?.map((p) => <p key={p}>{p}</p>)}
              {s.bullets && (
                <ul className="space-y-2 pl-1">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex gap-2.5">
                      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cobalt" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              {s.after?.map((p) => <p key={p}>{p}</p>)}
            </div>
          </section>
        ))}
      </div>

      <aside className="mt-10 rounded-2xl bg-surface border border-white/10 p-4 flex items-center gap-3">
        <span className="h-10 w-10 shrink-0 rounded-xl bg-white/5 flex items-center justify-center">
          <Headset className="h-5 w-5 text-cobalt" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Questions about this policy?</p>
          <p className="text-xs text-white/55">Raise a ticket and our team will get back to you.</p>
        </div>
        <Link href="/support" className="shrink-0 rounded-xl gradient-brand text-white text-xs font-bold px-4 h-10 inline-flex items-center">
          Contact Support
        </Link>
      </aside>
    </article>
  );
}
