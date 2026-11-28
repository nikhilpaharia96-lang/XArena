import { describe, expect, it, vi } from "vitest";
import { BetnexClient, BetnexError } from "../betnex/betnex.client";
import type { BetnexConfig } from "../betnex/betnex.config";

const config: BetnexConfig = {
  baseUrl: "https://api.test/casino",
  apiKey: "SECRET-KEY-123",
  usernameCode: "k7x",
  usernamePosition: "prefix",
  encryptionKey: null,
  callbackIps: [],
  testMode: true,
  trustedProxyHops: 1,
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function make(responses: (Response | Error)[]) {
  const sleeps: number[] = [];
  const records: unknown[] = [];
  const fetchImpl = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    if (next instanceof Error) throw next;
    return next;
  });
  const client = new BetnexClient({ config, fetchImpl: fetchImpl as unknown as typeof fetch, sleep: async (ms) => void sleeps.push(ms), onRequest: (r) => void records.push(r) });
  return { client, fetchImpl, sleeps, records };
}

describe("BetnexClient", () => {
  it("sends the key as x-betnex-key, builds the URL + query, and returns the JSON", async () => {
    const { client, fetchImpl } = make([json({ success: true })]);
    expect(await client.get("/filterproviders", { currency: "INR" })).toEqual({ success: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.test/casino/filterproviders?currency=INR");
    expect((init.headers as Record<string, string>)["x-betnex-key"]).toBe("SECRET-KEY-123");
  });

  it("POST sends a JSON body with content-type", async () => {
    const { client, fetchImpl } = make([json({ code: 0 })]);
    await client.post("/getgameurl", { a: 1 });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).toBe('{"a":1}');
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  it("retries 5xx with exponential backoff (1s, 2s …) plus jitter, then succeeds", async () => {
    const { client, fetchImpl, sleeps, records } = make([json({}, 500), json({}, 502), json({ ok: 1 })]);
    expect(await client.get("/x")).toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleeps).toHaveLength(2);
    expect(sleeps[0]).toBeGreaterThanOrEqual(1000);
    expect(sleeps[0]).toBeLessThan(1300);
    expect(sleeps[1]).toBeGreaterThanOrEqual(2000);
    expect(sleeps[1]).toBeLessThan(2600);
    expect(records[0]).toMatchObject({ ok: true, attempts: 3, endpoint: "/x" });
  });

  it("gives up after the attempt limit (GET 4, POST 3) with a typed error", async () => {
    const g = make([json({}, 500), json({}, 500), json({}, 500), json({}, 500)]);
    await expect(g.client.get("/x")).rejects.toMatchObject({ kind: "HTTP", status: 500 });
    expect(g.fetchImpl).toHaveBeenCalledTimes(4);
    const p = make([json({}, 500), json({}, 500), json({}, 500), json({}, 500)]);
    await expect(p.client.post("/x", {})).rejects.toBeInstanceOf(BetnexError);
    expect(p.fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("does not retry auth failures or other 4xx", async () => {
    for (const status of [401, 403]) {
      const { client, fetchImpl } = make([json({}, status), json({})]);
      await expect(client.get("/x")).rejects.toMatchObject({ kind: "AUTH" });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
    const { client, fetchImpl } = make([json({}, 400), json({})]);
    await expect(client.get("/x")).rejects.toMatchObject({ kind: "HTTP", status: 400 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("maps timeouts and network failures, and retries them", async () => {
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
    const a = make([timeout, json({ ok: 1 })]);
    expect(await a.client.get("/x")).toEqual({ ok: 1 });
    const b = make([new TypeError("fetch failed"), new TypeError("fetch failed"), new TypeError("fetch failed"), new TypeError("fetch failed")]);
    await expect(b.client.get("/x")).rejects.toMatchObject({ kind: "NETWORK" });
  });

  it("a non-JSON body is INVALID_RESPONSE and not retried", async () => {
    const { client, fetchImpl } = make([new Response("<html>", { status: 200 })]);
    await expect(client.get("/x")).rejects.toMatchObject({ kind: "INVALID_RESPONSE" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("never leaks the API key into errors or request records", async () => {
    const { client, records } = make([json({}, 500), json({}, 500), json({}, 500), json({}, 500)]);
    const err = (await client.get("/x").catch((e) => e)) as Error;
    expect(JSON.stringify([err.message, records])).not.toContain("SECRET-KEY-123");
  });

  it("uses a timeout of at least 10 seconds, as BETNEX requires", () => {
    const c = new BetnexClient({ config, timeoutMs: 1000 }) as unknown as { timeoutMs: number };
    expect(c.timeoutMs).toBeGreaterThanOrEqual(10_000);
  });
});
