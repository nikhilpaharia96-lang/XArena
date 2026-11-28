/**
 * BETNEX configuration — SERVER ONLY. Read lazily from process.env (never NEXT_PUBLIC_*).
 * Docs: "BETNEX API & SDK Integration Documentation", Version 1 (Provider), v2.2.
 */
export const PROVIDER_ID = "betnex";
/** XArena's wallet is INR-only (integer paise). */
export const WALLET_CURRENCY = "INR";
export const CALLBACK_PATH = "/api/providers/betnex/callback";
export const DEFAULT_BASE_URL = "https://livecasinoapi.betnex.co/casino";

export type UsernamePosition = "prefix" | "suffix";

export interface BetnexConfig {
  baseUrl: string;
  apiKey: string;
  /** 2–3 character alphanumeric code added to every username (lowercase). */
  usernameCode: string;
  usernamePosition: UsernamePosition;
  /** Passphrase for the AES payload encryption BETNEX gives each account; null = not provided. */
  encryptionKey: string | null;
  /** BETNEX callback server IPs (from their support group). */
  callbackIps: string[];
  /**
   * Test/integration mode: accept plain-JSON callbacks and skip the IP allowlist so the BETNEX
   * Callback Tester can be used before going live. MUST be off in production.
   */
  testMode: boolean;
  /** How many reverse-proxy hops sit in front of the app (to read the real client IP from X-Forwarded-For). */
  trustedProxyHops: number;
}

const CODE = /^[a-z0-9]{2,3}$/;

export function normalizeCode(v: string | undefined): string | null {
  const c = v?.trim().toLowerCase() ?? "";
  return CODE.test(c) ? c : null;
}

/**
 * Ready to launch games: key + username code, and — outside test mode — the encryption key
 * (BETNEX requires the /getgameurl body to be encrypted in production).
 */
export function isBetnexConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!env.BETNEX_API_KEY?.trim() || !normalizeCode(env.BETNEX_USERNAME_CODE)) return false;
  return env.BETNEX_TEST_MODE === "true" || Boolean(env.BETNEX_ENCRYPTION_KEY?.trim());
}

export function getBetnexConfig(env: NodeJS.ProcessEnv = process.env): BetnexConfig {
  if (!isBetnexConfigured(env)) throw new Error("BETNEX_NOT_CONFIGURED");
  return {
    baseUrl: (env.BETNEX_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    apiKey: env.BETNEX_API_KEY!.trim(),
    usernameCode: normalizeCode(env.BETNEX_USERNAME_CODE)!,
    usernamePosition: env.BETNEX_USERNAME_POSITION === "suffix" ? "suffix" : "prefix",
    encryptionKey: env.BETNEX_ENCRYPTION_KEY?.trim() || null,
    callbackIps: (env.BETNEX_CALLBACK_IPS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    testMode: env.BETNEX_TEST_MODE === "true",
    trustedProxyHops: Math.max(0, Number(env.BETNEX_TRUSTED_PROXY_HOPS ?? 1) || 0),
  };
}
