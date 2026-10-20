import { describe, expect, it, vi } from "vitest";
import { AsTechClient } from "../astech/astech.client";
import { upsertGames } from "../astech/astech.catalogue";
import { launchGame, testConnection } from "../astech/astech.service";
import { API_KEY, SECRET, makeDb, seedUser } from "./helpers";

const config = { baseUrl: "https://astechapi.cloud", apiKey: API_KEY, secretKey: SECRET, origin: "https://xarena.in" };
const session = { sessionId: "9a2f", gameUrl: "https://provider.example/launch?token=abc", directUrl: "https://provider.example/launch?token=abc", branded: false, mode: "seamless", demo: false, category: "live_casino", embeddable: false, singleUse: true, expiresIn: 300 };
const ok = (content: unknown) => new Response(JSON.stringify({ status: "success", error: "", content }), { status: 200, headers: { "x-request-id": "rid-1" } });
const status = (s: number) => new Response(JSON.stringify({ status: "fail", error: "e", content: null }), { status: s, headers: { "x-request-id": "rid-2" } });

function setup(responses: Response[] = [ok(session)]) {
  const db = makeDb();
  const user = seedUser(db, { deposit: 1000 });
  upsertGames(db, [
    { gameId: "g-inr", title: "INR Game", provider: "P", category: "slots", imageUrl: null, currencies: ["INR", "USD"] },
    { gameId: "g-usd", title: "USD Only", provider: "P", category: "slots", imageUrl: null, currencies: ["USD"] },
  ]);
  const id = (pg: string) => (db.prepare("SELECT id FROM ProviderGame WHERE providerGameId = ?").get(pg) as { id: string }).id;
  const fetchImpl = vi.fn(async () => responses.shift() ?? ok(session));
  const client = new AsTechClient({ config, fetchImpl: fetchImpl as unknown as typeof fetch, sleep: async () => {} });
  const base = { db, client, user: { id: user.userId, uid: user.uid }, appUrl: "https://xarena.in" };
  return { db, user, fetchImpl, id, base };
}

describe("game launch", () => {
  it("opens a fresh session with the documented request and returns the provider's flags", async () => {
    const { base, id, fetchImpl, user } = setup();
    const r = await launchGame({ ...base, gameId: id("g-inr") });
    expect(r).toMatchObject({ gameUrl: session.gameUrl, embeddable: false, singleUse: true, expiresIn: 300, mode: "seamless", sessionId: "9a2f" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://astechapi.cloud/api/public/v1/session/open");
    expect(JSON.parse(init.body as string)).toEqual({
      player_login: user.login, // opaque xa_<uid>, not the DB primary key
      game_id: "g-inr", // provider id resolved server-side
      currency: "INR",
      language: "en",
      exit_url: "https://xarena.in/games",
    });
    expect(init.body).not.toContain(user.userId);
  });

  it("calls /session/open every time and never persists the single-use URL", async () => {
    const { base, id, fetchImpl, db } = setup([ok(session), ok({ ...session, gameUrl: "https://provider.example/launch?token=second" })]);
    const a = await launchGame({ ...base, gameId: id("g-inr") });
    const b = await launchGame({ ...base, gameId: id("g-inr") });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(a.gameUrl).not.toBe(b.gameUrl);
    const dump = JSON.stringify(db.prepare("SELECT * FROM ProviderGameSession").all());
    expect(dump).not.toContain("token=");
    expect(db.prepare("SELECT COUNT(*) c FROM ProviderGameSession").get()).toEqual({ c: 2 });
  });

  it("collapses a double-click into a single provider call", async () => {
    const { base, id, fetchImpl } = setup();
    const [a, b] = await Promise.all([launchGame({ ...base, gameId: id("g-inr") }), launchGame({ ...base, gameId: id("g-inr") })]);
    expect(a).toBe(b);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("blocks games without INR support before contacting the provider", async () => {
    const { base, id, fetchImpl } = setup();
    await expect(launchGame({ ...base, gameId: id("g-usd") })).rejects.toMatchObject({ statusCode: 400, code: "CURRENCY_NOT_SUPPORTED" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("blocks disabled / unavailable / unknown games", async () => {
    const { base, id, db } = setup();
    db.prepare("UPDATE ProviderGame SET isEnabled = 0 WHERE providerGameId = 'g-inr'").run();
    await expect(launchGame({ ...base, gameId: id("g-inr") })).rejects.toMatchObject({ code: "GAME_NOT_FOUND" });
    await expect(launchGame({ ...base, gameId: "nope" })).rejects.toMatchObject({ code: "GAME_NOT_FOUND" });
  });

  it("requires an https exit origin (AS Tech enforces https on the whitelisted domain)", async () => {
    const { base, id } = setup();
    await expect(launchGame({ ...base, appUrl: "http://localhost:3000", gameId: id("g-inr") })).rejects.toMatchObject({ code: "PROVIDER_NOT_CONFIGURED" });
    await expect(launchGame({ ...base, appUrl: null, gameId: id("g-inr") })).rejects.toMatchObject({ code: "PROVIDER_NOT_CONFIGURED" });
  });

  it("maps provider failures to safe user messages (no provider internals)", async () => {
    for (const [s, code] of [[404, "GAME_NOT_FOUND"], [503, "PROVIDER_UNAVAILABLE"], [401, "PROVIDER_ERROR"], [403, "PROVIDER_ERROR"], [502, "PROVIDER_ERROR"]] as const) {
      const { base, id } = setup(s === 503 ? [status(503), status(503), status(503), status(503)] : [status(s)]);
      const err = await launchGame({ ...base, gameId: id("g-inr") }).catch((e) => e);
      expect(err.code).toBe(code);
      expect(err.message).not.toMatch(/signature|whitelist|api key|callback/i);
    }
  });

  it("rejects a provider response without a usable gameUrl", async () => {
    const { base, id } = setup([ok({ ...session, gameUrl: "javascript:alert(1)" })]);
    await expect(launchGame({ ...base, gameId: id("g-inr") })).rejects.toMatchObject({ code: "PROVIDER_ERROR" });
  });

  it("sanitises the language parameter", async () => {
    const { base, id, fetchImpl } = setup();
    await launchGame({ ...base, gameId: id("g-inr"), language: "hi" });
    expect(JSON.parse(((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body) as string).language).toBe("hi");
    const s2 = setup();
    await launchGame({ ...s2.base, gameId: s2.id("g-inr"), language: "en; DROP" });
    expect(JSON.parse(((s2.fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body) as string).language).toBe("en");
  });
});

describe("connection test", () => {
  it("is a safe read-only /currencies call and reports INR support", async () => {
    const fetchImpl = vi.fn(async () => ok({ count: 1, currencies: [{ code: "INR" }] }));
    const client = new AsTechClient({ config, fetchImpl: fetchImpl as unknown as typeof fetch });
    const r = await testConnection(client);
    expect(r).toMatchObject({ ok: true, inrSupported: true, currencyCount: 1, requestId: "rid-1" });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toContain("/currencies");
  });
  it("reports failure kind without throwing", async () => {
    const client = new AsTechClient({ config, fetchImpl: (async () => status(403)) as unknown as typeof fetch });
    expect(await testConnection(client)).toMatchObject({ ok: false, errorKind: "FORBIDDEN", requestId: "rid-2" });
  });
});
