import { beforeEach, describe, expect, it } from "vitest";
import type Database from "better-sqlite3";
import { makeDb, seedUser } from "../../providers/__tests__/helpers";
import {
  buildGoogleAuthUrl,
  createPkce,
  fetchGoogleProfile,
  findOrCreateGoogleUser,
  safeNext,
  usernameFromProfile,
  type GoogleProfile,
} from "../google-auth";
import { createHash } from "node:crypto";

let db: Database.Database;
beforeEach(() => {
  db = makeDb();
});

const profile = (over: Partial<GoogleProfile> = {}): GoogleProfile => ({
  sub: "g-1",
  email: "Nikhil.Paharia@gmail.com",
  email_verified: true,
  name: "Nikhil",
  picture: "https://lh3.googleusercontent.com/a/x",
  ...over,
});

describe("safeNext", () => {
  it("only allows paths on this site", () => {
    expect(safeNext("/wallet")).toBe("/wallet");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});

describe("PKCE + auth url", () => {
  it("challenge is the SHA-256 of the verifier", () => {
    const { verifier, challenge } = createPkce();
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });
  it("asks Google for email + profile with state and PKCE", () => {
    const u = new URL(buildGoogleAuthUrl({ clientId: "cid", redirectUri: "https://x.app/api/auth/google/callback", state: "st", challenge: "ch" }));
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("scope")).toBe("openid email profile");
    expect(u.searchParams.get("state")).toBe("st");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("redirect_uri")).toBe("https://x.app/api/auth/google/callback");
  });
});

describe("fetchGoogleProfile", () => {
  const args = { code: "c", verifier: "v", redirectUri: "r", clientId: "id", clientSecret: "sec" };
  const fakeFetch = (info: object, tokenOk = true): typeof fetch =>
    (async (url: string | URL | Request) =>
      String(url).includes("oauth2.googleapis.com")
        ? new Response(JSON.stringify({ access_token: "tok" }), { status: tokenOk ? 200 : 400 })
        : new Response(JSON.stringify(info), { status: 200 })) as typeof fetch;

  it("returns the verified profile with a lower-cased email", async () => {
    const p = await fetchGoogleProfile(args, fakeFetch({ sub: "1", email: "A@B.com", email_verified: true, name: "A" }));
    expect(p.email).toBe("a@b.com");
  });
  it("rejects an unverified Google email", async () => {
    await expect(fetchGoogleProfile(args, fakeFetch({ sub: "1", email: "a@b.com", email_verified: false }))).rejects.toThrow(/not verified/);
  });
  it("rejects when the code exchange fails", async () => {
    await expect(fetchGoogleProfile(args, fakeFetch({}, false))).rejects.toThrow(/token exchange/);
  });
});

describe("findOrCreateGoogleUser", () => {
  it("creates an account with wallet and stats for a new email", () => {
    const r = findOrCreateGoogleUser(db, profile(), null);
    expect(r.ok && r.created).toBe(true);
    if (!r.ok) return;
    const u = db.prepare("SELECT * FROM User WHERE id = ?").get(r.userId) as Record<string, unknown>;
    expect(u.email).toBe("nikhil.paharia@gmail.com");
    expect(u.authProvider).toBe("GOOGLE");
    expect(u.passwordHash).toBeNull();
    expect(u.emailVerified).toBe(1);
    expect(u.status).toBe("ACTIVE");
    expect(u.username).toBe("nikhilpaharia"); // dots stripped, valid chars only
    expect(db.prepare("SELECT 1 FROM Wallet WHERE userId = ?").get(r.userId)).toBeTruthy();
    expect(db.prepare("SELECT 1 FROM PlayerStats WHERE userId = ?").get(r.userId)).toBeTruthy();
  });

  it("signs an existing email/password user into the SAME account", () => {
    const seeded = seedUser(db, { n: 1 });
    db.prepare("UPDATE User SET email = ? WHERE id = ?").run("nikhil.paharia@gmail.com", seeded.userId);
    const r = findOrCreateGoogleUser(db, profile(), null);
    expect(r).toMatchObject({ ok: true, created: false, userId: seeded.userId });
    expect((db.prepare("SELECT COUNT(*) c FROM User").get() as { c: number }).c).toBe(1);
  });

  it("activates an account that was waiting on email verification", () => {
    const seeded = seedUser(db, { n: 1, status: "PENDING_VERIFICATION" });
    db.prepare("UPDATE User SET email = ? WHERE id = ?").run("nikhil.paharia@gmail.com", seeded.userId);
    const r = findOrCreateGoogleUser(db, profile(), null);
    expect(r).toMatchObject({ ok: true, status: "ACTIVE" });
  });

  it("refuses banned and suspended accounts", () => {
    const a = seedUser(db, { n: 1, status: "BANNED" });
    db.prepare("UPDATE User SET email = ? WHERE id = ?").run("nikhil.paharia@gmail.com", a.userId);
    expect(findOrCreateGoogleUser(db, profile(), null)).toEqual({ ok: false, reason: "BANNED" });
    db.prepare("UPDATE User SET status = 'SUSPENDED' WHERE id = ?").run(a.userId);
    expect(findOrCreateGoogleUser(db, profile(), null)).toEqual({ ok: false, reason: "SUSPENDED" });
  });

  it("links a valid referral code, and ignores an invalid one", () => {
    const referrer = seedUser(db, { n: 1 });
    const code = (db.prepare("SELECT referralCode c FROM User WHERE id = ?").get(referrer.userId) as { c: string }).c;
    const r = findOrCreateGoogleUser(db, profile(), code);
    if (!r.ok) throw new Error("expected ok");
    const ref = db.prepare("SELECT referrerId, bonusPaidAt FROM Referral WHERE referredUserId = ?").get(r.userId) as { referrerId: string; bonusPaidAt: string | null };
    expect(ref.referrerId).toBe(referrer.userId);
    expect(ref.bonusPaidAt).toBeNull(); // reward waits for the friend's first deposit

    const r2 = findOrCreateGoogleUser(db, profile({ email: "other@gmail.com" }), "NOPE99");
    expect(r2.ok && r2.created).toBe(true); // bad code doesn't block sign-in
  });

  it("makes usernames unique and valid", () => {
    findOrCreateGoogleUser(db, profile({ email: "john@gmail.com" }), null);
    const second = usernameFromProfile(db, profile({ email: "john@yahoo.com" }));
    expect(second).not.toBe("john");
    expect(second).toMatch(/^[a-zA-Z0-9_]{3,20}$/);
    expect(usernameFromProfile(db, profile({ email: "a.@x.com" }))).toMatch(/^[a-zA-Z0-9_]{3,20}$/);
  });
});
