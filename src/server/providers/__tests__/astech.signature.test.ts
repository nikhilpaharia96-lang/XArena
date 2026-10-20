import { describe, expect, it } from "vitest";
import { signBody, verifySignature } from "../astech/astech.signature";

describe("HMAC-SHA256 signing", () => {
  it("matches the published HMAC-SHA256 test vector", () => {
    expect(signBody("key", "The quick brown fox jumps over the lazy dog")).toBe(
      "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8"
    );
  });

  it("signs an empty body (documented GET behaviour) deterministically", () => {
    expect(signBody("key", "")).toBe("5d5d139563c95b5967b9bd9a8c9b233a9dedb45072794cd232dc1b74832607d0");
    expect(signBody("key")).toBe(signBody("key", ""));
  });

  it("signs the exact JSON string, including `{}`", () => {
    expect(signBody("s", "{}")).not.toBe(signBody("s", ""));
    const body = JSON.stringify({ a: 1, b: "two" });
    expect(verifySignature("s", body, signBody("s", body))).toBe(true);
  });

  it("is sensitive to key order and whitespace (no re-serialisation)", () => {
    const a = '{"a":1,"b":2}';
    const b = '{"b":2,"a":1}';
    const c = '{"a":1, "b":2}';
    expect(new Set([signBody("s", a), signBody("s", b), signBody("s", c)]).size).toBe(3);
  });

  it("handles unicode and special characters", () => {
    const body = JSON.stringify({ name: "₹ ünï \"quoted\" \\ / \n 🎰" });
    expect(verifySignature("s", body, signBody("s", body))).toBe(true);
  });

  it("rejects wrong secret, tampered body, empty and malformed signatures", () => {
    const body = '{"x":1}';
    const sig = signBody("s", body);
    expect(verifySignature("other", body, sig)).toBe(false);
    expect(verifySignature("s", '{"x":2}', sig)).toBe(false);
    expect(verifySignature("s", body, "")).toBe(false);
    expect(verifySignature("s", body, null)).toBe(false);
    expect(verifySignature("s", body, "abc")).toBe(false);
    expect(verifySignature("s", body, sig.slice(0, -1))).toBe(false);
  });

  it("accepts uppercase hex from the provider", () => {
    const body = "{}";
    expect(verifySignature("s", body, signBody("s", body).toUpperCase())).toBe(true);
  });
});
