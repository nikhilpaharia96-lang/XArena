import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Payload encryption for BETNEX (`/getgameurl` request body and callbacks).
 *
 * ASSUMED SCHEME — NOT CONFIRMED BY THE DOC. The BETNEX document only says "ask the BETNEX team for the
 * encryption details", but its sample payloads start with "U2FsdGVkX1", which is base64 of "Salted_" — the
 * signature of the OpenSSL / CryptoJS passphrase format (AES-256-CBC, key+IV from EVP_BytesToKey with MD5 and an
 * 8-byte salt). That is what is implemented here. If BETNEX gives you different details, this is the ONLY file
 * to change: keep the two exported function signatures.
 */

const MAGIC = Buffer.from("Salted__");

/** OpenSSL EVP_BytesToKey (MD5, 1 iteration): derives the 32-byte key and 16-byte IV. */
function deriveKeyAndIv(passphrase: Buffer, salt: Buffer): { key: Buffer; iv: Buffer } {
  const blocks: Buffer[] = [];
  let prev = Buffer.alloc(0);
  let length = 0;
  while (length < 48) {
    prev = createHash("md5").update(Buffer.concat([prev, passphrase, salt])).digest();
    blocks.push(prev);
    length += prev.length;
  }
  const all = Buffer.concat(blocks);
  return { key: all.subarray(0, 32), iv: all.subarray(32, 48) };
}

export function encryptPayload(data: unknown, passphrase: string): string {
  const salt = randomBytes(8);
  const { key, iv } = deriveKeyAndIv(Buffer.from(passphrase, "utf8"), salt);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return Buffer.concat([MAGIC, salt, body]).toString("base64");
}

/** Returns the decrypted JSON value, or null if it cannot be decrypted / is not JSON. Never throws. */
export function decryptPayload(payload: unknown, passphrase: string): unknown | null {
  if (typeof payload !== "string" || payload.length < 24 || payload.length > 64 * 1024) return null;
  try {
    const raw = Buffer.from(payload, "base64");
    if (raw.length < 32 || !raw.subarray(0, 8).equals(MAGIC)) return null;
    const { key, iv } = deriveKeyAndIv(Buffer.from(passphrase, "utf8"), raw.subarray(8, 16));
    const decipher = createDecipheriv("aes-256-cbc", key, iv);
    const text = Buffer.concat([decipher.update(raw.subarray(16)), decipher.final()]).toString("utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}
