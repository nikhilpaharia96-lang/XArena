import { createHash, createHmac, randomBytes } from "node:crypto";

/**
 * Provably-fair RNG.
 *
 * Before any bet the player is shown `serverSeedHash` = SHA-256(serverSeed).
 * Each bet uses the next `nonce`. Every random number is derived from
 *   HMAC_SHA256(key = serverSeed, msg = `${clientSeed}:${nonce}:${cursor}`)
 * taking the first 4 bytes as an unsigned 32-bit integer / 2^32 -> float in [0,1).
 * After the player rotates seeds, the old serverSeed is revealed so every past
 * result can be re-derived independently (see /docs/games.md).
 */

export function newServerSeed(): string {
  return randomBytes(32).toString("hex");
}

export function newClientSeed(): string {
  return randomBytes(8).toString("hex");
}

export function hashSeed(serverSeed: string): string {
  return createHash("sha256").update(serverSeed).digest("hex");
}

export function floatAt(serverSeed: string, clientSeed: string, nonce: number, cursor: number): number {
  const digest = createHmac("sha256", serverSeed).update(`${clientSeed}:${nonce}:${cursor}`).digest();
  return digest.readUInt32BE(0) / 0x1_0000_0000;
}

/** A cursor-advancing stream of floats for one round. */
export function floatStream(serverSeed: string, clientSeed: string, nonce: number) {
  let cursor = 0;
  return () => floatAt(serverSeed, clientSeed, nonce, cursor++);
}
