import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { cn } from "@/lib/cn";

export interface HeroSlideContent {
  title: string;
  subtitle?: string | null;
  badgeText?: string | null;
  imageUrl: string;
  mobileImageUrl?: string | null;
  linkUrl?: string | null;
  ctaLabel?: string | null;
  secondaryCtaLabel?: string | null;
  secondaryCtaUrl?: string | null;
}

function isExternal(href: string) {
  return /^https?:\/\//i.test(href);
}

function SlideLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return isExternal(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/**
 * One admin-managed hero slide. Shared by the homepage carousel and the admin live preview
 * so what the admin sees is exactly what players get. Uses a CSS variable per breakpoint so a
 * dedicated mobile image can be swapped in without JS.
 */
export function HeroSlide({ slide, className, priority }: { slide: HeroSlideContent; className?: string; priority?: boolean }) {
  const mobile = slide.mobileImageUrl || slide.imageUrl;
  const primaryHref = slide.linkUrl || null;
  const showPrimary = Boolean(primaryHref && slide.ctaLabel);
  const showSecondary = Boolean(slide.secondaryCtaUrl && slide.secondaryCtaLabel);
  const Title = priority ? "h1" : "h2";

  return (
    <div
      className={cn(
        "relative shrink-0 w-full sm:w-[92%] h-72 sm:h-80 rounded-3xl snap-center overflow-hidden flex flex-col justify-end p-5 sm:p-7",
        className
      )}
    >
      <div
        className="absolute inset-0 bg-cover bg-center bg-[image:var(--hero-m)] sm:bg-[image:var(--hero-d)]"
        style={{ "--hero-m": `url("${mobile}")`, "--hero-d": `url("${slide.imageUrl}")` } as React.CSSProperties}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-r from-void via-void/80 to-void/5 sm:via-void/65 sm:to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-void via-void/10 to-transparent" />

      {slide.badgeText && (
        <span className="relative inline-flex w-fit items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-gold mb-2">
          <Zap className="h-3 w-3" /> {slide.badgeText}
        </span>
      )}

      <Title className="relative text-white font-display font-black text-3xl sm:text-5xl leading-[1.05] mb-2 max-w-[18ch] sm:max-w-[22ch] drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] line-clamp-3">
        {slide.title}
      </Title>

      {slide.subtitle && <p className="relative text-white/80 text-xs sm:text-sm max-w-xs sm:max-w-md mb-4 line-clamp-2">{slide.subtitle}</p>}

      {(showPrimary || showSecondary) && (
        <div className="relative flex flex-wrap items-center gap-2">
          {showPrimary && (
            <SlideLink
              href={primaryHref!}
              className="inline-flex items-center gap-1.5 rounded-xl gradient-cta px-5 h-11 text-sm font-bold text-white shadow-[0_8px_24px_-6px_rgba(249,115,22,0.5)]"
            >
              {slide.ctaLabel} <ArrowRight className="h-3.5 w-3.5" />
            </SlideLink>
          )}
          {showSecondary && (
            <SlideLink
              href={slide.secondaryCtaUrl!}
              className="inline-flex items-center gap-1.5 rounded-xl bg-black/25 border border-white/25 text-white px-4 h-11 text-sm font-semibold"
            >
              {slide.secondaryCtaLabel}
            </SlideLink>
          )}
        </div>
      )}

      {/* No buttons configured but a link is set: make the whole slide tappable. */}
      {!showPrimary && !showSecondary && primaryHref && (
        <SlideLink href={primaryHref} className="absolute inset-0" >
          <span className="sr-only">{slide.title}</span>
        </SlideLink>
      )}
    </div>
  );
}
