import { describe, expect, it, vi } from "vitest";
import { AsTechClient } from "../astech/astech.client";
import { AsTechError } from "../astech/astech.errors";
import { signBody } from "../astech/astech.signature";
import { API_KEY, SECRET } from "./helpers";

const config = { baseUrl: "https://astechapi.cloud", apiKey: API_KEY, secretKey: SECRET, origin: "https://xarena.in" };

const envelope = (content: unknown) => JSON.stringify({ status: "success", error: "", content });
const res = (status: number, body: string, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { "x-request-id": "req-123", ...headers } });

function client(responses: Response[], extra: Partial<ConstructorParameters<typeof AsTechClient>[0]> = {}) {
  const fetchImpl = vi.fn(async () => {
    const r = responses.shift();
    if (!r) throw new Error("no more mocked responses");
    return r;
  });
  const sleeps: number[] = [];
  const c = new AsTechClient({ config, fetchImpl: fetchImpl as unknown as typeof fetch, sleep: async (ms) => void sleeps.push(ms), ...extra });
  return { c, fetchImpl, sleeps };
}

describe("AS Tech client — authentication", () => {
  it("sends the signed exact body with X-Api-Key, X-Signature, Content-Type and Origin", async () => {
    const { c, fetchImpl } = client([res(200, envelope({ games: [] }))]);
    await c.post("/api/public/v1/games", { currency: "INR", provider: "Pragmatic" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://astechapi.cloud/api/public/v1/games");
    expect(init.method).toBe("POST");
    const sent = init.body as string;
    const h = init.headers as Record<string, string>;
    expect(sent).toBe('{"currency":"INR","provider":"Pragmatic"}');
    expect(h["X-Signature"]).toBe(signBody(SECRET, sent)); // signature is over the very bytes sent
    expect(h["X-Api-Key"]).toBe(API_KEY);
    expect(h["Content-Type"]).toBe("application/json");
    expect(h["Origin"]).toBe("https://xarena.in");
  });

  it("signs `{}` for the empty-filter endpoints (documented)", async () => {
    const { c, fetchImpl } = client([res(200, envelope({ currencies: [] }))]);
    await c.post("/api/public/v1/currencies", {});
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).toBe("{}");
    expect((init.headers as Record<string, string>)["X-Signature"]).toBe(signBody(SECRET, "{}"));
  });

  it("never puts the secret in headers or body", async () => {
    const { c, fetchImpl } = client([res(200, envelope({}))]);
    await c.post("/x", { a: 1 });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.stringify(init)).not.toContain(SECRET);
  });
});

describe("AS Tech client — responses", () => {
  it("unwraps the documented envelope and exposes x-request-id", async () => {
    const { c } = client([res(200, envelope({ count: 1 }))]);
    const r = await c.post<{ count: number }>("/x", {});
    expect(r.data).toEqual({ count: 1 });
    expect(r.meta).toMatchObject({ status: 200, requestId: "req-123", attempts: 1 });
  });

  it("treats status != success as an error even on HTTP 200", async () => {
    const { c } = client([res(200, JSON.stringify({ status: "fail", error: "bad thing", content: null }))]);
    await expect(c.post("/x", {})).rejects.toMatchObject({ kind: "PROVIDER_REJECTED" });
  });

  it("rejects non-JSON bodies", async () => {
    const { c } = client([res(200, "<html>oops</html>")]);
    await expect(c.post("/x", {})).rejects.toMatchObject({ kind: "INVALID_RESPONSE" });
  });
});

describe("AS Tech client — error mapping & retry policy", () => {
  const cases: [number, string][] = [
    [401, "AUTH"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [400, "BAD_REQUEST"],
    [409, "WRONG_WALLET_MODE"],
    [502, "CALLBACK_UNAVAILABLE"],
  ];
  it.each(cases)("maps HTTP %i -> %s and does NOT retry", async (status, kind) => {
    const { c, fetchImpl, sleeps } = client([res(status, JSON.stringify({ status: "fail", error: "x", content: null }))]);
    const err = (await c.post("/x", {}).catch((e) => e)) as AsTechError;
    expect(err).toBeInstanceOf(AsTechError);
    expect(err.kind).toBe(kind);
    expect(err.requestId).toBe("req-123");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleeps).toEqual([]);
  });

  it("retries 429 with exponential backoff, then succeeds", async () => {
    const { c, fetchImpl, sleeps } = client([res(429, "{}"), res(429, "{}"), res(200, envelope({ ok: true }))], { baseDelayMs: 100 });
    const r = await c.post("/x", {});
    expect(r.data).toEqual({ ok: true });
    expect(r.meta.attempts).toBe(3);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([100, 200]);
  });

  it("retries 503 up to maxAttempts then fails with UNAVAILABLE", async () => {
    const { c, fetchImpl, sleeps } = client([res(503, "{}"), res(503, "{}"), res(503, "{}"), res(503, "{}")], { baseDelayMs: 50, maxAttempts: 4 });
    await expect(c.post("/x", {})).rejects.toMatchObject({ kind: "UNAVAILABLE", status: 503 });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(sleeps).toEqual([50, 100, 200]);
  });

  it("caps the backoff delay", async () => {
    const { c, sleeps } = client([res(503, "{}"), res(503, "{}"), res(503, "{}"), res(200, envelope({}))], { baseDelayMs: 1000, maxDelayMs: 1500 });
    await c.post("/x", {});
    expect(sleeps).toEqual([1000, 1500, 1500]);
  });

  it("retries network failures", async () => {
    const calls: Array<Response | Error> = [new Error("ECONNRESET"), res(200, envelope({ a: 1 }))];
    const fetchImpl = vi.fn(async () => {
      const n = calls.shift()!;
      if (n instanceof Error) throw n;
      return n;
    });
    const c = new AsTechClient({ config, fetchImpl: fetchImpl as unknown as typeof fetch, sleep: async () => {} });
    expect((await c.post("/x", {})).data).toEqual({ a: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reports every request (success and failure) via onRequest without leaking secrets", async () => {
    const seen: unknown[] = [];
    const { c } = client([res(401, "{}")], { onRequest: (r) => seen.push(r) });
    await c.post("/api/public/v1/games", {}).catch(() => {});
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ endpoint: "/api/public/v1/games", ok: false, status: 401, errorKind: "AUTH", requestId: "req-123" });
    expect(JSON.stringify(seen)).not.toContain(SECRET);
  });
});
