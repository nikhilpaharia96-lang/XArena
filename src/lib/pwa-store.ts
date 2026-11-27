"use client";
import { create } from "zustand";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window { __xarenaInstallEvent?: BeforeInstallPromptEvent }
}

interface PwaState {
  /** Chrome/Edge/Android's one-shot install prompt, when the browser considers the site installable. */
  installEvent: BeforeInstallPromptEvent | null;
  installed: boolean;
  setInstallEvent: (e: BeforeInstallPromptEvent | null) => void;
  setInstalled: (v: boolean) => void;
}

export const usePwaStore = create<PwaState>((set) => ({
  installEvent: null,
  installed: false,
  setInstallEvent: (installEvent) => set({ installEvent }),
  setInstalled: (installed) => set({ installed }),
}));
