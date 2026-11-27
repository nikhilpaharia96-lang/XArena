// Pure helpers for the install prompt (no React, easy to test).

export const MAX_INSTALL_PROMPTS = 2;
export const REPROMPT_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

export interface PromptState {
  /** How many times the install sheet has been shown to this user on this device. */
  count: number;
  lastShownAt: number;
  /** The player installed the app (or opened it installed) — never ask again. */
  installed?: boolean;
  /** The notification step has been shown once — afterwards they use the toggle on the Notifications page. */
  notifyAsked?: boolean;
}

export const promptKey = (userId: string) => `xarena:install:v1:${userId}`;

/** First login → show. If they closed it without installing: once more after 3 days, then never nag again. */
export function shouldShowInstall(state: PromptState | null, now: number): boolean {
  if (!state) return true;
  if (state.installed) return false;
  return state.count < MAX_INSTALL_PROMPTS && now - state.lastShownAt >= REPROMPT_AFTER_MS;
}

export function readPromptState(userId: string): PromptState | null {
  try {
    const raw = localStorage.getItem(promptKey(userId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PromptState>;
    return { count: Number(p.count) || 0, lastShownAt: Number(p.lastShownAt) || 0, installed: !!p.installed, notifyAsked: !!p.notifyAsked };
  } catch {
    return null;
  }
}

export function writePromptState(userId: string, patch: Partial<PromptState>) {
  try {
    const cur = readPromptState(userId) ?? { count: 0, lastShownAt: 0 };
    localStorage.setItem(promptKey(userId), JSON.stringify({ ...cur, ...patch }));
  } catch {
    /* private mode / storage blocked: the prompt just may show again next visit */
  }
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac with touch.
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/** VAPID public key (URL-safe base64) → bytes for pushManager.subscribe. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
