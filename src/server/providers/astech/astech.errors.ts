export type AsTechErrorKind =
  | "AUTH" // 401
  | "FORBIDDEN" // 403
  | "NOT_FOUND" // 404
  | "BAD_REQUEST" // 400
  | "WRONG_WALLET_MODE" // 409
  | "RATE_LIMITED" // 429
  | "UNAVAILABLE" // 503
  | "CALLBACK_UNAVAILABLE" // 502 - AS Tech could not reach/parse XArena's getBalance callback
  | "PROVIDER_REJECTED" // HTTP 200 but status != success
  | "NETWORK"
  | "INVALID_RESPONSE"
  | "UNKNOWN";

export class AsTechError extends Error {
  constructor(
    public kind: AsTechErrorKind,
    message: string,
    public status: number | null = null,
    public requestId: string | null = null
  ) {
    super(message);
    this.name = "AsTechError";
  }

  /** Only transient conditions are retried. Validation/auth errors never are. */
  get retryable(): boolean {
    return this.kind === "RATE_LIMITED" || this.kind === "UNAVAILABLE" || this.kind === "NETWORK";
  }
}

export function mapStatusToError(status: number, detail: string, requestId: string | null): AsTechError {
  const d = detail ? `: ${detail}` : "";
  switch (status) {
    case 401:
      return new AsTechError("AUTH", `Invalid API key or signature${d}`, status, requestId);
    case 403:
      return new AsTechError("FORBIDDEN", `IP/domain/callback not whitelisted${d}`, status, requestId);
    case 404:
      return new AsTechError("NOT_FOUND", `Player or game not found${d}`, status, requestId);
    case 400:
      return new AsTechError("BAD_REQUEST", `Invalid parameters${d}`, status, requestId);
    case 409:
      return new AsTechError("WRONG_WALLET_MODE", `Wrong wallet mode for this operation${d}`, status, requestId);
    case 429:
      return new AsTechError("RATE_LIMITED", `Provider rate limit hit${d}`, status, requestId);
    case 503:
      return new AsTechError("UNAVAILABLE", `Provider unavailable${d}`, status, requestId);
    case 502:
      return new AsTechError("CALLBACK_UNAVAILABLE", `Operator wallet callback unavailable${d}`, status, requestId);
    default:
      return new AsTechError("UNKNOWN", `Unexpected provider response (${status})${d}`, status, requestId);
  }
}

/** Safe, user-facing text — never leaks provider internals. */
export function publicMessageFor(err: AsTechError): { status: number; message: string; code: string } {
  switch (err.kind) {
    case "NOT_FOUND":
      return { status: 404, message: "This game is not available right now.", code: "GAME_NOT_FOUND" };
    case "RATE_LIMITED":
      return { status: 429, message: "Too many requests. Please try again in a moment.", code: "PROVIDER_BUSY" };
    case "UNAVAILABLE":
    case "NETWORK":
      return { status: 503, message: "Games are temporarily unavailable. Please try again shortly.", code: "PROVIDER_UNAVAILABLE" };
    default:
      return { status: 502, message: "We couldn't start this game. Please try again later.", code: "PROVIDER_ERROR" };
  }
}
