import crypto from "node:crypto";

/**
 * HMAC-SHA256(secretKey, exactRawBody), hex-encoded.
 *
 * The caller MUST pass the exact string that will be written to the wire.
 * `signBody` never re-serialises anything. Empty-body requests sign "".
 */
export function signBody(secretKey: string, rawBody: string = ""): string {
  return crypto.createHmac("sha256", secretKey).update(rawBody, "utf8").digest("hex");
}

/** Constant-time comparison of a provided signature against the expected one. */
export function verifySignature(secretKey: string, rawBody: string, provided: string | null | undefined): boolean {
  if (!provided) return false;
  const expected = Buffer.from(signBody(secretKey, rawBody), "utf8");
  const given = Buffer.from(provided.trim().toLowerCase(), "utf8");
  // timingSafeEqual throws on length mismatch, so compare lengths first.
  if (expected.length !== given.length) return false;
  return crypto.timingSafeEqual(expected, given);
}
