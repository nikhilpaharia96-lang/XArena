import Image from "next/image";
import { CATEGORY_VISUALS } from "./category-visuals";
import type { FreeFireCategoryValue } from "@/lib/free-fire-categories";

/** Card artwork: cropped key art when available, otherwise gradient + icon. */
export function CategoryArt({ value, sizes, priority }: { value: FreeFireCategoryValue; sizes: string; priority?: boolean }) {
  const { icon: Icon, gradient, art, artPosition } = CATEGORY_VISUALS[value];
  return (
    <div className={`relative h-full w-full overflow-hidden bg-gradient-to-br ${gradient}`} aria-hidden>
      {art ? (
        <Image
          src={art}
          alt=""
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
          style={{ objectPosition: artPosition }}
        />
      ) : (
        <>
          <div
            className="absolute inset-0 opacity-30"
            style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.10) 0 1px, transparent 1px 14px)" }}
          />
          <div className="absolute -right-4 -top-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
          <Icon className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 text-white/90 drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)] transition-transform duration-500 group-hover:scale-110 motion-reduce:transition-none" strokeWidth={1.5} />
        </>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-elevated via-elevated/10 to-transparent" />
    </div>
  );
}
