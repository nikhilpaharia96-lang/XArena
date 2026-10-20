import { createLogger } from "../logger";
import { AsTechError, mapStatusToError } from "./astech.errors";
import { getAsTechConfig, type AsTechConfig } from "./astech.config";
import { signBody } from "./astech.signature";
import type { AsTechEnvelope, AsTechRawResponse } from "./astech.types";

const log = createLogger("astech.client");

export interface ClientOptions {
  config?: AsTechConfig;
  fetchImpl?: typeof fetch;
  /** Total attempts including the first (default 4 => 3 retries). */
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Called after every request (success or failure) for audit/request logs. */
  onRequest?: (info: RequestLogInfo) => void;
  timeoutMs?: number;
}

export interface RequestLogInfo {
  endpoint: string;
  ok: boolean;
  status: number | null;
  attempts: number;
  durationMs: number;
  requestId: string | null;
  errorKind: string | null;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class AsTechClient {
  private readonly opts: Required<Omit<ClientOptions, "config" | "onRequest">> & Pick<ClientOptions, "onRequest">;
  private readonly explicitConfig?: AsTechConfig;

  constructor(options: ClientOptions = {}) {
    this.explicitConfig = options.config;
    this.opts = {
      fetchImpl: options.fetchImpl ?? fetch,
      maxAttempts: options.maxAttempts ?? 4,
      baseDelayMs: options.baseDelayMs ?? 500,
      maxDelayMs: options.maxDelayMs ?? 8000,
      sleep: options.sleep ?? defaultSleep,
      timeoutMs: options.timeoutMs ?? 15000,
      onRequest: options.onRequest,
    };
  }

  private config(): AsTechConfig {
    return this.explicitConfig ?? getAsTechConfig();
  }

  /**
   * POST a JSON body. The body is serialised ONCE into `rawBody`; that exact
   * string is both signed and sent, so the signature can never diverge from
   * the wire bytes. Per the docs, /currencies and /games take `{}` (signed as
   * "{}"); `undefined` => empty string (the documented GET behaviour).
   */
  async post<T = unknown>(endpoint: string, body?: unknown): Promise<AsTechRawResponse<T>> {
    const cfg = this.config();
    const rawBody = body === undefined ? "" : JSON.stringify(body);
    const signature = signBody(cfg.secretKey, rawBody);
    const url = `${cfg.baseUrl}${endpoint}`;
    const started = Date.now();

    let attempt = 0;
    let lastError: AsTechError | null = null;

    while (attempt < this.opts.maxAttempts) {
      attempt += 1;
      try {
        const res = await this.send(url, cfg, signature, rawBody);
        const requestId = res.headers.get("x-request-id");
        const text = await res.text();

        if (!res.ok) {
          throw mapStatusToError(res.status, extractDetail(text), requestId);
        }

        let envelope: Partial<AsTechEnvelope> | null;
        try {
          envelope = text ? (JSON.parse(text) as Partial<AsTechEnvelope>) : null;
        } catch {
          throw new AsTechError("INVALID_RESPONSE", "Provider returned non-JSON body", res.status, requestId);
        }
        // Documented envelope: { status: "success" | "fail", error, content }.
        if (!envelope || envelope.status !== "success") {
          throw new AsTechError(
            "PROVIDER_REJECTED",
            `Provider rejected request${envelope?.error ? `: ${String(envelope.error).slice(0, 200)}` : ""}`,
            res.status,
            requestId
          );
        }
        const data = envelope.content;

        const meta = { status: res.status, requestId, attempts: attempt, durationMs: Date.now() - started };
        this.report(endpoint, true, meta.status, attempt, meta.durationMs, requestId, null);
        return { data: data as T, meta };
      } catch (e) {
        const err = e instanceof AsTechError ? e : new AsTechError("NETWORK", "Network error contacting provider");
        lastError = err;
        if (!err.retryable || attempt >= this.opts.maxAttempts) break;
        const delay = Math.min(this.opts.baseDelayMs * 2 ** (attempt - 1), this.opts.maxDelayMs);
        log.warn("retrying", { endpoint, attempt, kind: err.kind, status: err.status, requestId: err.requestId, delayMs: delay });
        await this.opts.sleep(delay);
      }
    }

    const final = lastError ?? new AsTechError("UNKNOWN", "Unknown provider failure");
    this.report(endpoint, false, final.status, attempt, Date.now() - started, final.requestId, final.kind);
    log.error("request_failed", { endpoint, kind: final.kind, status: final.status, requestId: final.requestId, attempts: attempt });
    throw final;
  }

  private async send(url: string, cfg: AsTechConfig, signature: string, rawBody: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    try {
      return await this.opts.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": cfg.apiKey,
          "X-Signature": signature,
          // AS Tech rejects (403) requests whose Origin is not the whitelisted domain.
          ...(cfg.origin ? { Origin: cfg.origin } : {}),
        },
        body: rawBody, // exact string that was signed
        signal: controller.signal,
        cache: "no-store",
      });
    } catch {
      throw new AsTechError("NETWORK", "Network error contacting provider");
    } finally {
      clearTimeout(timer);
    }
  }

  private report(
    endpoint: string,
    ok: boolean,
    status: number | null,
    attempts: number,
    durationMs: number,
    requestId: string | null,
    errorKind: string | null
  ) {
    log.info("request", { endpoint, ok, status, attempts, durationMs, requestId, errorKind });
    this.opts.onRequest?.({ endpoint, ok, status, attempts, durationMs, requestId, errorKind });
  }
}

function extractDetail(text: string): string {
  if (!text) return "";
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    const m = j.message ?? j.error ?? j.detail;
    return typeof m === "string" ? m.slice(0, 200) : "";
  } catch {
    return "";
  }
}
