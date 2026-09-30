import { Crosshair, Crown, Flame, Map as MapIcon, Skull, Star, Swords, Target, Trophy, type LucideIcon } from "lucide-react";
import type { FreeFireCategoryValue } from "@/lib/free-fire-categories";

/**
 * Original, generic artwork per category. `art` is a cropped, optimised piece
 * of the XArena Free Fire key art in /public/images/free-fire; categories
 * without dedicated art fall back to icon + gradient. No third-party logos or
 * real-person likenesses are used.
 *
 * `accent` is an "r,g,b" triplet used for the neon border/glow (see .neon-card).
 */
export const CATEGORY_VISUALS: Record<
  FreeFireCategoryValue,
  { icon: LucideIcon; gradient: string; accent: string; art?: string; artPosition?: string }
> = {
  FF_SURVIVAL: { icon: Flame, gradient: "from-[#EA580C] via-[#9A3412] to-[#1C0A05]", accent: "255,122,0", art: "/images/free-fire/survival.webp", artPosition: "50% 35%" },
  FF_FULL_MAP: { icon: MapIcon, gradient: "from-[#0EA5E9] via-[#1D4ED8] to-[#06122B]", accent: "59,130,246", art: "/images/free-fire/full-map.webp" },
  CS_SCRIMS: { icon: Swords, gradient: "from-[#7C3AED] via-[#4C1D95] to-[#120A2B]", accent: "124,58,237", art: "/images/free-fire/scrims.webp" },
  MESSI_DRAW: { icon: Trophy, gradient: "from-[#2563EB] via-[#6D28D9] to-[#0B1030]", accent: "139,92,246" },
  WORLD_CLASS_SUPERSTAR: { icon: Star, gradient: "from-[#F59E0B] via-[#B45309] to-[#1F1305]", accent: "255,176,0" },
  LONE_WOLF: { icon: Skull, gradient: "from-[#3B82F6] via-[#312E81] to-[#0A0A1F]", accent: "59,130,246" },
  CS_ONLY_HEAD: { icon: Crosshair, gradient: "from-[#DC2626] via-[#7F1D1D] to-[#1A0808]", accent: "239,68,68" },
  CLASH_SQUAD: { icon: Crown, gradient: "from-[#1683FF] via-[#7C2D12] to-[#06122B]", accent: "37,99,255" },
  LW_HEAD: { icon: Target, gradient: "from-[#A21CAF] via-[#3730A3] to-[#150A24]", accent: "168,85,247" },
};
