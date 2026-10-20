import { describe, expect, it, vi } from "vitest";
import { AsTechClient } from "../astech/astech.client";
import { getStoredCurrencies, getSyncState, parseCurrencies, parseGames, supportsCurrency, syncCatalogue, upsertGames } from "../astech/astech.catalogue";
import { API_KEY, SECRET, makeDb } from "./helpers";

const config = { baseUrl: "https://astechapi.cloud", apiKey: API_KEY, secretKey: SECRET, origin: null };
// Shapes copied from https://astechapi.cloud/docs#games and #currencies
const gamesContent = {
  count: 2,
  games: [
    { gameId: "0f1c-uuid", title: "Book of Gold", provider: "Pragmatic", category: "slots", imageUrl: "https://cdn.example/book-of-gold.png", currencies: ["INR", "USD"] },
    { gameId: "evo-1", title: "Lightning Roulette", provider: "Evolution Live", category: "live_casino", imageUrl: "https://cdn.example/lr.png", currencies: ["usd"] },
  ],
};
const currenciesContent = { count: 2, currencies: [{ code: "INR", name: "Indian Rupee", symbol: "₹", decimals: 2 }, { code: "USD" }] };
const ok = (content: unknown) => new Response(JSON.stringify({ status: "success", error: "", content }), { status: 200 });

describe("catalogue parsing", () => {
  it("parses the documented games shape", () => {
    const { games, skipped } = parseGames(gamesContent);
    expect(skipped).toBe(0);
    expect(games[0]).toEqual({ gameId: "0f1c-uuid", title: "Book of Gold", provider: "Pragmatic", category: "slots", imageUrl: "https://cdn.example/book-of-gold.png", currencies: ["INR", "USD"] });
    expect(games[1].currencies).toEqual(["USD"]); // normalised to upper case
  });

  it("skips malformed entries and rejects non-https image urls", () => {
    const { games, skipped } = parseGames({ games: [{ title: "no id" }, { gameId: "a", title: "ok", imageUrl: "javascript:alert(1)" }, null] });
    expect(skipped).toBe(2);
    expect(games).toHaveLength(1);
    expect(games[0].imageUrl).toBeNull();
    expect(games[0].category).toBe("other");
  });

  it("throws on a response with no games array", () => {
    expect(() => parseGames({})).toThrow();
    expect(() => parseGames(null)).toThrow();
  });

  it("parses currencies and detects INR", () => {
    const list = parseCurrencies(currenciesContent);
    expect(list.map((c) => c.code)).toEqual(["INR", "USD"]);
    expect(list[0]).toMatchObject({ symbol: "₹", decimals: 2 });
  });
});

describe("catalogue sync", () => {
  const mk = (responses: Response[]) => {
    const fetchImpl = vi.fn(async (url: string) => {
      const r = responses.shift();
      if (!r) throw new Error("unexpected call " + url);
      return r;
    });
    return { fetchImpl, client: new AsTechClient({ config, fetchImpl: fetchImpl as unknown as typeof fetch, sleep: async () => {} }) };
  };

  it("stores games + currencies and records sync state; INR support is data-driven", async () => {
    const db = makeDb();
    const { client, fetchImpl } = mk([ok(currenciesContent), ok(gamesContent)]);
    const state = await syncCatalogue(db, client);
    expect(state).toMatchObject({ ok: true, total: 2, created: 2, updated: 0 });
    expect(getSyncState(db)?.ok).toBe(true);
    expect(getStoredCurrencies(db).some((c) => c.code === "INR")).toBe(true);
    const rows = db.prepare("SELECT providerGameId, title, providerName, category, currencies, isEnabled FROM ProviderGame ORDER BY title").all() as { currencies: string }[];
    expect(rows).toHaveLength(2);
    expect(supportsCurrency(rows[0], "INR")).toBe(true); // Book of Gold
    expect(supportsCurrency(rows[1], "INR")).toBe(false); // Lightning Roulette is USD-only
    // exactly two provider calls (currencies + games) — not per-render
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const bodies = fetchImpl.mock.calls.map((c) => (c as unknown as [string, RequestInit])[1].body);
    expect(bodies).toEqual(["{}", "{}"]);
  });

  it("re-sync updates in place, keeps admin enable/disable, and hides games the provider dropped", async () => {
    const db = makeDb();
    await syncCatalogue(db, mk([ok(currenciesContent), ok(gamesContent)]).client);
    db.prepare("UPDATE ProviderGame SET isEnabled = 0 WHERE providerGameId = '0f1c-uuid'").run();
    await new Promise((r) => setTimeout(r, 5));
    const next = { games: [{ ...gamesContent.games[0], title: "Book of Gold 2" }] };
    const state = await syncCatalogue(db, mk([ok(currenciesContent), ok(next)]).client);
    expect(state).toMatchObject({ created: 0, updated: 1, markedUnavailable: 1 });
    const a = db.prepare("SELECT title, isEnabled, isAvailable FROM ProviderGame WHERE providerGameId = '0f1c-uuid'").get();
    expect(a).toEqual({ title: "Book of Gold 2", isEnabled: 0, isAvailable: 1 });
    const b = db.prepare("SELECT isAvailable FROM ProviderGame WHERE providerGameId = 'evo-1'").get();
    expect(b).toEqual({ isAvailable: 0 });
  });

  it("an empty/garbage provider response never wipes the existing catalogue", async () => {
    const db = makeDb();
    await syncCatalogue(db, mk([ok(currenciesContent), ok(gamesContent)]).client);
    await expect(syncCatalogue(db, mk([ok(currenciesContent), ok({ count: 0, games: [] })]).client)).rejects.toThrow();
    expect(db.prepare("SELECT COUNT(*) c FROM ProviderGame WHERE isAvailable = 1").get()).toEqual({ c: 2 });
    expect(getSyncState(db)?.ok).toBe(false);
  });

  it("concurrent syncs share one provider round-trip (rate-limit protection)", async () => {
    const db = makeDb();
    const { client, fetchImpl } = mk([ok(currenciesContent), ok(gamesContent)]);
    const [a, b] = await Promise.all([syncCatalogue(db, client), syncCatalogue(db, client)]);
    expect(a).toBe(b);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("upsertGames is idempotent", () => {
    const db = makeDb();
    const { games } = parseGames(gamesContent);
    upsertGames(db, games);
    upsertGames(db, games);
    expect(db.prepare("SELECT COUNT(*) c FROM ProviderGame").get()).toEqual({ c: 2 });
  });
});
