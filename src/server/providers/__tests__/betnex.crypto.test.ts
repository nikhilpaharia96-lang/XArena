import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { decryptPayload, encryptPayload } from "../betnex/betnex.crypto";

describe("betnex crypto (OpenSSL / CryptoJS passphrase format — assumed scheme)", () => {
  const data = { username: "k7xplayer123", gameId: "abc", money: 1000.5, platform: 1 };

  it("round-trips and uses the Salted__ envelope (the doc's samples start with U2FsdGVkX1)", () => {
    const enc = encryptPayload(data, "secret");
    expect(enc.startsWith("U2FsdGVkX1")).toBe(true);
    expect(decryptPayload(enc, "secret")).toEqual(data);
  });

  it("is randomly salted: same input encrypts differently each time", () => {
    expect(encryptPayload(data, "secret")).not.toBe(encryptPayload(data, "secret"));
  });

  it("interoperates with real OpenSSL (what CryptoJS.AES.encrypt(text, passphrase) produces)", () => {
    // Encrypt with the openssl CLI, decrypt with ours …
    const viaOpenssl = execFileSync("openssl", ["enc", "-aes-256-cbc", "-md", "md5", "-salt", "-a", "-A", "-pass", "pass:secret"], {
      input: JSON.stringify(data),
    }).toString();
    expect(decryptPayload(viaOpenssl.trim(), "secret")).toEqual(data);
    // … and the other way round.
    const out = execFileSync("openssl", ["enc", "-d", "-aes-256-cbc", "-md", "md5", "-a", "-A", "-pass", "pass:secret"], {
      input: encryptPayload(data, "secret"),
    }).toString();
    expect(JSON.parse(out)).toEqual(data);
  });

  it("returns null (never throws) for wrong passphrase, garbage, tampering, wrong types", () => {
    const enc = encryptPayload(data, "secret");
    expect(decryptPayload(enc, "other")).toBeNull();
    expect(decryptPayload("U2FsdGVkX1+short", "secret")).toBeNull();
    expect(decryptPayload("%%%not-base64%%%", "secret")).toBeNull();
    expect(decryptPayload(enc.slice(0, -4) + "AAAA", "secret")).toBeNull();
    for (const v of [undefined, null, 5, {}, ""]) expect(decryptPayload(v, "secret")).toBeNull();
  });
});
