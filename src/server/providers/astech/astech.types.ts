/**
 * Types for the AS Tech public API.
 *
 * Only fields named in the integration brief are modelled as required.
 * Anything not documented is optional / `unknown` and parsed defensively in
 * astech.catalogue.ts — we do not assume undocumented response shapes.
 */

/** Every AS Tech API response is wrapped in this envelope (docs: "Authentication"). */
export interface AsTechEnvelope<T = unknown> {
  status: "success" | string;
  error: string;
  content: T;
}

export interface AsTechCurrency {
  code: string;
  name?: string;
  symbol?: string;
  decimals?: number;
}

/** Documented `content` of POST /api/public/v1/session/open. */
export interface AsTechSession {
  sessionId: string;
  gameUrl: string;
  directUrl?: string;
  branded?: boolean;
  mode?: string;
  demo?: boolean;
  /** slots | live_casino | sportsbook | other */
  category?: string;
  embeddable: boolean;
  singleUse?: boolean;
  expiresIn?: number;
}

export interface AsTechSessionOpenRequest {
  player_login: string;
  game_id: string;
  currency: string;
  language: string;
  exit_url: string;
}

/** Normalised catalogue entry (provider payload -> XArena shape). */
export interface AsTechGame {
  gameId: string;
  title: string;
  provider: string;
  category: string;
  imageUrl: string | null;
  currencies: string[];
}

export interface AsTechGamesFilter {
  currency?: string;
  provider?: string;
  category?: string;
}

export interface AsTechResponseMeta {
  status: number;
  requestId: string | null;
  attempts: number;
  durationMs: number;
}

export interface AsTechRawResponse<T = unknown> {
  data: T;
  meta: AsTechResponseMeta;
}
