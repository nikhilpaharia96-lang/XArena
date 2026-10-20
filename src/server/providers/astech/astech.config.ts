/**
 * AS Tech configuration — SERVER ONLY.
 * Read lazily from process.env so tests can override and so nothing here is
 * ever inlined into a client bundle (no NEXT_PUBLIC_* variables are used).
 */
export interface AsTechConfig {
  baseUrl: string;
  apiKey: string;
  secretKey: string;
  /** Whitelisted XArena origin, sent as the Origin header (AS Tech enforces a domain whitelist). */
  origin: string | null;
}

export const DEFAULT_ASTECH_BASE_URL = "https://astechapi.cloud";
export const PROVIDER_ID = "astech";
/** XArena's wallet is INR-only (integer paise), so only INR sessions/callbacks are accepted. */
export const WALLET_CURRENCY = "INR";
export const CALLBACK_PATH = "/api/providers/astech/callback";

export function isAsTechConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.ASTECH_API_KEY && env.ASTECH_SECRET_KEY);
}

/** Public HTTPS origin of XArena (used for exit_url, Origin header, callback URL display). */
export function getPublicAppUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const v = env.APP_PUBLIC_URL?.trim();
  return v ? v.replace(/\/+$/, "") : null;
}

export function getAsTechConfig(env: NodeJS.ProcessEnv = process.env): AsTechConfig {
  if (!isAsTechConfigured(env)) throw new Error("ASTECH_NOT_CONFIGURED");
  const app = getPublicAppUrl(env);
  let origin: string | null = null;
  if (app) {
    try {
      origin = new URL(app).origin;
    } catch {
      origin = null;
    }
  }
  return {
    baseUrl: (env.ASTECH_API_BASE_URL || DEFAULT_ASTECH_BASE_URL).replace(/\/+$/, ""),
    apiKey: env.ASTECH_API_KEY as string,
    secretKey: env.ASTECH_SECRET_KEY as string,
    origin,
  };
}
