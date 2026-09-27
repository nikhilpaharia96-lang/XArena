import { Card } from "./card";
import type { LucideIcon } from "lucide-react";

export function StatCard({ label, value, icon: Icon, tone = "text-violet" }: { label: string; value: string | number; icon: LucideIcon; tone?: string }) {
  return (
    <Card className="p-4">
      <Icon className={`h-5 w-5 mb-2 ${tone}`} />
      <p className="text-xl font-black text-white font-mono">{value}</p>
      <p className="text-[11px] text-white/45 uppercase tracking-wide mt-0.5">{label}</p>
    </Card>
  );
}
