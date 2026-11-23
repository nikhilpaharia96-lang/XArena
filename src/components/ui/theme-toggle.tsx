"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/cn";

/** Icon-only light/dark switch. Pass the same className as neighbouring icon buttons. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const toLight = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={toLight ? "Switch to light mode" : "Switch to dark mode"}
      title={toLight ? "Light mode" : "Dark mode"}
      className={cn(className)}
    >
      {toLight ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
