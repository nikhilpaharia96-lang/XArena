import { describe, expect, it } from "vitest";
import type { BetnexClient } from "../betnex/betnex.client";
import { BetnexError } from "../betnex/betnex.client";
import { getSyncState, parseGames, parseImages, parseProviders, syncCatalogue } from "../betnex/betnex.catalogue";
import { makeDb } from "./helpers";

const providersResp = {
  success: true,
  data: [
    { code: "PG", name: "PGSoft", currency: "AED,INR,USD", status: 1 },
    { code: "SPRIBE", name: "Spribe", currency: "INR", status: 1 },
    { code: "NOINR", name: "NoInr", currency: "USD,EUR", status: 1 },
    { code: "OFF", name: "Off", currency: "INR", status: 0 },
  ],
};
const gamesFor = (code: string) => ({
  success: true,
  data:
    code === "PG"
      ? [
          { game_uid: "pg1", game_name: "Mahjong Ways", game_type: "Slot", currency: "INR,USD", status: 1 },
          { game_uid: "pg2", game_name: "Dead Game", game_type: "Slot", currency: "INR", status: 0 },
          { game_uid: "pg3", game_name: "USD Only", game_type: "Slot", currency: "USD", status: 1 },
          { game_uid: "", game_name: "No id", currency: "INR", status: 1 },
        ]
      : [{ game_uid: "sp1", game_name: "Aviator", game_type: "Crash", currency: "INR", status: 1 }],
});

function fakeClient(opts: { failGames?: string[]; failAll?: boolean; noImages?: boolean } = {}) {
  const calls: string[] = [];
  const client = {
    get: async (path: string, q: Record<string, string> = {}) => {
      calls.push(`${path}?${new URLSearchParams(q)}`);
      if (path === "/filterproviders") return providersResp;
      if (path === "/filtergames") {
        if (opts.failAll || opts.failGames?.includes(q.providercode)) throw new BetnexError("HTTP", "boom", 500);
        return gamesFor(q.providercode);
      }
      if (path === "/getallgamesandprovider") {
        if (opts.noImages) throw new BetnexError("HTTP", "no images", 500);
        return { games: [{ id: "pg1", img: "https://cdn.test/pg1.png" }, { id: "sp1", img: "javascript:alert(1)" }] };
      }
      throw new Error("unexpected " + path);
    },
  };
  return { client: client as unknown as BetnexClient, calls };
}

describe("parsing", () => {
  it("providers: only active + INR", () => {
    expect(parseProviders(providersResp).map((p) => p.code)).toEqual(["PG", "SPRIBE"]);
    expect(() => parseProviders({})).toThrow(BetnexError);
  });
  it("games: only status 1 + INR; skips rows without id/name; lowercases the category", () => {
    const { games, skipped } = parseGames(gamesFor("PG"), { code: "PG", name: "PGSoft" });
    expect(games.map((g) => g.gameId)).toEqual(["pg1"]);
    expect(games[0]).toMatchObject({ title: "Mahjong Ways", category: "slot", providerName: "PGSoft" });
    expect(skipped).toBe(1);
  });
  it("images: only http(s) URLs", () => {
    const m = parseImages({ games: [{ id: "a", img: "https://x/a.png" }, { id: "b", img: "data:evil" }, { id: "c" }] });
    expect([...m.keys()]).toEqual(["a"]);
  });
});

describe("syncCatalogue", () => {
  it("imports INR games DISABLED by default, with thumbnails where available", async () => {
    const db = makeDb();
    const { client } = fakeClient();
    const state = await syncCatalogue(db, client);
    expect(state).toMatchObject({ ok: true, providers: 2, total: 2, created: 2, failedProviders: 0 });
    const rows = db.prepare("SELECT providerGameId, title, category, imageUrl, isEnabled, isAvailable, currencies FROM ProviderGame WHERE provider='betnex' ORDER BY providerGameId").all() as Record<string, unknown>[];
    expect(rows).toEqual([
      { providerGameId: "pg1", title: "Mahjong Ways", category: "slot", imageUrl: "https://cdn.test/pg1.png", isEnabled: 0, isAvailable: 1, currencies: '["INR"]' },
      { providerGameId: "sp1", title: "Aviator", category: "crash", imageUrl: null, isEnabled: 0, isAvailable: 1, currencies: '["INR"]' },
    ]);
    expect(getSyncState(db)?.ok).toBe(true);
  });

  it("a missing thumbnail API doesn't fail the sync", async () => {
    const db = makeDb();
    expect((await syncCatalogue(db, fakeClient({ noImages: true }).client)).total).toBe(2);
  });

  it("never overrides an admin's enable choice; re-sync updates in place", async () => {
    const db = makeDb();
    await syncCatalogue(db, fakeClient().client);
    db.prepare("UPDATE ProviderGame SET isEnabled = 1 WHERE providerGameId = 'pg1'").run();
    const again = await syncCatalogue(db, fakeClient().client);
    expect(again).toMatchObject({ created: 0, updated: 2 });
    expect(db.prepare("SELECT isEnabled FROM ProviderGame WHERE providerGameId = 'pg1'").get()).toEqual({ isEnabled: 1 });
    expect(db.prepare("SELECT isEnabled FROM ProviderGame WHERE providerGameId = 'sp1'").get()).toEqual({ isEnabled: 0 });
  });

  it("marks games unavailable only for providers fetched successfully this time", async () => {
    const db = makeDb();
    await syncCatalogue(db, fakeClient().client);
    // PG's game list fails this time → its games must NOT be marked unavailable; Spribe is fetched fine.
    db.prepare("DELETE FROM ProviderGame WHERE providerGameId = 'sp1'").run();
    db.prepare("INSERT INTO ProviderGame (id, provider, providerGameId, title, providerName, category, currencies, isEnabled, isAvailable, lastSyncedAt, createdAt, updatedAt) VALUES ('x','betnex','gone1','Gone','Spribe','crash','[\"INR\"]',1,1,'t','t','t')").run();
    const state = await syncCatalogue(db, fakeClient({ failGames: ["PG"] }).client);
    expect(state).toMatchObject({ failedProviders: 1, markedUnavailable: 1 });
    expect(db.prepare("SELECT isAvailable FROM ProviderGame WHERE providerGameId = 'pg1'").get()).toEqual({ isAvailable: 1 });
    expect(db.prepare("SELECT isAvailable FROM ProviderGame WHERE providerGameId = 'gone1'").get()).toEqual({ isAvailable: 0 });
  });

  it("if every provider fails, the existing catalogue is untouched and the failure is recorded", async () => {
    const db = makeDb();
    await syncCatalogue(db, fakeClient().client);
    await expect(syncCatalogue(db, fakeClient({ failAll: true }).client)).rejects.toBeInstanceOf(BetnexError);
    expect(db.prepare("SELECT COUNT(*) c FROM ProviderGame WHERE isAvailable = 1").get()).toEqual({ c: 2 });
    expect(getSyncState(db)).toMatchObject({ ok: false });
  });

  it("concurrent syncs share one run", async () => {
    const db = makeDb();
    const { client, calls } = fakeClient();
    await Promise.all([syncCatalogue(db, client), syncCatalogue(db, client)]);
    expect(calls.filter((c) => c.startsWith("/filterproviders"))).toHaveLength(1);
  });
});
