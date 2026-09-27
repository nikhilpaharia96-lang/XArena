"use client";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { useToastStore } from "@/lib/toast-store";

const icons = { success: CheckCircle2, error: XCircle, info: Info };
const toneColor = { success: "text-signal", error: "text-crimson", info: "text-cobalt" };

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[90vw] max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = icons[t.tone];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="glass glow-border rounded-2xl px-4 py-3 flex items-start gap-3 pointer-events-auto shadow-2xl"
            >
              <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${toneColor[t.tone]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{t.title}</p>
                {t.description && <p className="text-xs text-white/60 mt-0.5">{t.description}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-white/40 hover:text-white shrink-0">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
