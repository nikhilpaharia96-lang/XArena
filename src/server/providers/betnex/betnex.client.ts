import { getBetnexConfig, type BetnexConfig } from "./betnex.config";

export type BetnexErrorKind = "NETWORK" | "TIMEOUT" | "AUTH" | "HTTP" | "INVALID_RESPONSE" | "API";

export class BetnexError extends Error {
  constructor(
    public kind: BetnexErrorKind,
    message: string,
    public status: number | null = null
  ) {
    super(message);
    this.name = "BetnexError";
  }
}

export interface RequestRecord {
  endpoint: string;
  ok: boolean;
  status: number | null;
  attempts: number;
  durationMs: number;
  errorKind: BetnexErrorKind | null;
}

export interface BetnexClientOptions {
  config?: BetnexConfig;
  fetchImpl?: typeof fetch;
  /** Injected in tests so backoff doesn't actually wait. */
  sleep?: (ms: number) => Promise<void>;
  onRequest?: (r: RequestRecord) => void;
  /** BETNEX asks for a timeout of at least 10 s. */
  timeoutMs?: number;
}

const BACKOFF_MS = [1000, 2000, 4000, 8000];

/** Server-side only: the API key never leaves this class and is never logged. */
export class BetnexClient {
  private cfg: BetnexConfig;
  private fetchImpl: typeof fetch;
  private sleep: (ms: number) => Promise<void>;
  private onRequest?: (r: RequestRecord) => void;
  private timeoutMs: number;

  constructor(opts: BetnexClientOptions = {}) {
    this.cfg = opts.config ?? getBetnexConfig();
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.onRequest = opts.onRequest;
    this.timeoutMs = Math.max(10_000, opts.timeoutMs ?? 15_000);
  }

  get config() {
    return this.cfg;
  }

  get<T = unknown>(path: string, query?: Record<string, string>): Promise<T> {
    const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
    return this.request<T>("GET", `${path}${qs}`, undefined, 4);
  }

  /** POSTs are retried less aggressively (3 attempts) — a launch URL is cheap to regenerate but time-limited. */
  post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body, 3);
  }

  private async request<T>(method: "GET" | "POST", pathWithQuery: string, body: unknown, maxAttempts: number): Promise<T> {
    const started = Date.now();
    const endpoint = pathWithQuery.split("?")[0];
    let lastError: BetnexError | null = null;
    let attempts = 0;

    for (let i = 0; i < maxAttempts; i++) {
      attempts = i + 1;
      try {
        const res = await this.fetchImpl(`${this.cfg.baseUrl}${pathWithQuery}`, {
          method,
          headers: { "x-betnex-key": this.cfg.apiKey, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(this.timeoutMs),
          cache: "no-store",
        });

        if (res.status === 401 || res.status === 403) throw new BetnexError("AUTH", "BETNEX rejected the API key", res.status);
        if (res.status >= 500) throw new BetnexError("HTTP", `BETNEX server error (${res.status})`, res.status);
        if (res.status >= 400) {
          // 4xx other than auth = our request is wrong; retrying can't fix it.
          throw Object.assign(new BetnexError("HTTP", `BETNEX rejected the request (${res.status})`, res.status), { final: true });
        }

        let json: unknown;
        try {
          json = await res.json();
        } catch {
          throw Object.assign(new BetnexError("INVALID_RESPONSE", "BETNEX returned a non-JSON response", res.status), { final: true });
        }
        this.onRequest?.({ endpoint, ok: true, status: res.status, attempts, durationMs: Date.now() - started, errorKind: null });
        return json as T;
      } catch (e) {
        const err =
          e instanceof BetnexError
            ? e
            : e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")
              ? new BetnexError("TIMEOUT", "BETNEX did not answer in time")
              : new BetnexError("NETWORK", "Could not reach BETNEX");
        lastError = err;
        const final = (e as { final?: boolean }).final || err.kind === "AUTH" || err.kind === "INVALID_RESPONSE";
        if (final || i === maxAttempts - 1) break;
        // Exponential backoff with jitter (1s, 2s, 4s, 8s) as BETNEX requires.
        const base = BACKOFF_MS[Math.min(i, BACKOFF_MS.length - 1)];
        await this.sleep(base + Math.floor(Math.random() * base * 0.25));
      }
    }

    this.onRequest?.({ endpoint, ok: false, status: lastError?.status ?? null, attempts, durationMs: Date.now() - started, errorKind: lastError?.kind ?? "NETWORK" });
    throw lastError ?? new BetnexError("NETWORK", "Could not reach BETNEX");
  }
}
