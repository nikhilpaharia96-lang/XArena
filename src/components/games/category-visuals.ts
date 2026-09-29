import { Crosshair, Crown, Flame, Map as MapIcon, Skull, Star, Swords, Target, Trophy, type LucideIcon } from "lucide-react";
import type { FreeFireCategoryValue } from "@/lib/free-fire-categories";

/**
 * Original, generic artwork (icon + gradient) per category. No game art,
 * logos or real-person likenesses are used.
 */
export const CATEGORY_VISUALS: Record<FreeFireCategoryValue, { icon: LucideIcon; gradient: string }> = {
  FF_SURVIVAL: { icon: Flame, gradient: "from-[#EA580C] via-[#9A3412] to-[#1C0A05]" },
  FF_FULL_MAP: { icon: MapIcon, gradient: "from-[#0EA5E9] via-[#1D4ED8] to-[#06122B]" },
  CS_SCRIMS: { icon: Swords, gradient: "from-[#7C3AED] via-[#4C1D95] to-[#120A2B]" },
  MESSI_DRAW: { icon: Trophy, gradient: "from-[#2563EB] via-[#6D28D9] to-[#0B1030]" },
  WORLD_CLASS_SUPERSTAR: { icon: Star, gradient: "from-[#F59E0B] via-[#B45309] to-[#1F1305]" },
  LONE_WOLF: { icon: Skull, gradient: "from-[#6D28D9] via-[#312E81] to-[#0A0A1F]" },
  CS_ONLY_HEAD: { icon: Crosshair, gradient: "from-[#DC2626] via-[#7F1D1D] to-[#1A0808]" },
  CLASH_SQUAD: { icon: Crown, gradient: "from-[#1683FF] via-[#1E3A8A] to-[#06122B]" },
  LW_HEAD: { icon: Target, gradient: "from-[#A21CAF] via-[#581C87] to-[#150A24]" },
};
