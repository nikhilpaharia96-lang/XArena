import Image from "next/image";

type Step = {
  n: number;
  title: string;
  desc: string;
  img: string;
  w: number;
  h: number;
  /** accent colour (rgb triplet) driving border, glow and chevron */
  rgb: string;
};

const STEPS: Step[] = [
  { n: 1, title: "Create Account", desc: "Quick & easy signup", img: "account", w: 560, h: 476, rgb: "59,130,246" },
  { n: 2, title: "Choose Game", desc: "Pick your favorite game", img: "games", w: 640, h: 544, rgb: "249,115,22" },
  { n: 3, title: "Join Tournament", desc: "Pay entry & confirm slot", img: "trophy", w: 640, h: 743, rgb: "168,85,247" },
  { n: 4, title: "Play & Win", desc: "Compete and earn rewards", img: "winner", w: 640, h: 686, rgb: "249,115,22" },
];

function Chevron() {
  return (
    <svg viewBox="0 0 28 32" className="h-7 w-6 text-cobalt drop-shadow-[0_0_6px_rgba(59,130,246,0.9)]" aria-hidden>
      <path d="M4 3l10 13L4 29M15 3l10 13-10 13" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Static onboarding steps — app chrome, not data, so nothing is fetched. */
export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-title"
      className="relative overflow-hidden rounded-3xl border border-white/8 bg-void px-3 pt-6 pb-4 sm:px-6 sm:pb-6"
    >
      {/* arena backdrop */}
      <Image
        src="/images/how-it-works/arena.webp"
        alt=""
        fill
        sizes="(min-width: 1152px) 1152px, 100vw"
        className="object-cover opacity-30 pointer-events-none select-none"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-void/70 via-void/60 to-void/90 pointer-events-none" />

      <div className="relative">
        <h2
          id="how-it-works-title"
          className="text-center text-3xl sm:text-5xl font-black italic tracking-tight leading-none"
        >
          <span className="bg-gradient-to-b from-white to-[#3B82F6] bg-clip-text text-transparent drop-shadow-[0_0_14px_rgba(59,130,246,0.55)]">
            HOW IT
          </span>{" "}
          <span className="bg-gradient-to-b from-[#FDE68A] to-[#F97316] bg-clip-text text-transparent drop-shadow-[0_0_14px_rgba(249,115,22,0.55)]">
            WORKS
          </span>
        </h2>

        <div className="mt-3 flex items-center justify-center gap-2 text-xs sm:text-base text-white/70">
          <span className="h-px w-8 sm:w-24 bg-gradient-to-r from-transparent to-cobalt" />
          <span className="h-1 w-1 rounded-full bg-cobalt" />
          <p>Join a tournament in 4 simple steps</p>
          <span className="h-1 w-1 rounded-full bg-cobalt" />
          <span className="h-px w-8 sm:w-24 bg-gradient-to-l from-transparent to-cobalt" />
        </div>

        <ol className="mt-7 grid grid-cols-2 gap-x-3 gap-y-6 sm:mt-9 sm:flex sm:items-stretch sm:gap-0">
          {STEPS.map((s, i) => (
            <li key={s.title} className="contents sm:flex sm:flex-1 sm:items-center">
              <div
                className="relative flex flex-1 flex-col items-center rounded-2xl border px-2 pt-8 pb-4 text-center backdrop-blur-[2px]"
                style={{
                  borderColor: `rgba(${s.rgb},0.6)`,
                  background: `radial-gradient(120% 80% at 50% 30%, rgba(${s.rgb},0.22), rgba(2,6,23,0.85) 70%)`,
                  boxShadow: `0 0 18px -4px rgba(${s.rgb},0.55), inset 0 0 22px -12px rgba(${s.rgb},0.9)`,
                }}
              >
                <Image
                  src={`/images/how-it-works/badge-${s.n}.webp`}
                  alt=""
                  width={160}
                  height={136}
                  className="absolute -top-4 -left-2 h-10 w-auto sm:h-12"
                />

                <div className="flex h-24 sm:h-32 w-full items-center justify-center">
                  <Image
                    src={`/images/how-it-works/${s.img}.webp`}
                    alt=""
                    width={s.w}
                    height={s.h}
                    sizes="(min-width: 640px) 200px, 45vw"
                    className="max-h-full w-auto max-w-[88%] object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.6)]"
                  />
                </div>

                <h3 className="mt-3 text-sm sm:text-lg font-extrabold italic text-white leading-tight">{s.title}</h3>
                <p className="mt-1 text-[11px] sm:text-sm text-white/65 leading-tight">{s.desc}</p>
              </div>

              {i < STEPS.length - 1 && (
                <div className="hidden sm:flex shrink-0 px-1.5 lg:px-3" aria-hidden>
                  <Chevron />
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
