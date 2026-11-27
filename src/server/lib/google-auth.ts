import type Database from "better-sqlite3";
import { createHash, randomBytes } from "node:crypto";
import { createId, createReferralCode } from "./ids";

// ----------------------------------------------------------------------------
// "Continue with Google" — standard OAuth 2.0 authorization-code flow with PKCE,
// done server-side so no Google script runs in the browser and the client secret
// never leaves the server.
//
//   /api/auth/google            -> redirects to Google (stores state + PKCE in a cookie)
//   /api/auth/google/callback   -> checks state, swaps the code for the user's
//                                  verified profile, then signs them in / signs them up.
//
// Accounts are matched on Google's *verified* email address, so someone who
// already signed up with that email on XArena lands in the same account.
// ----------------------------------------------------------------------------

export const GOOGLE_STATE_COOKIE = "xarena_g_oauth";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

export function googleConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** The public origin of the site; it must match the redirect URI saved in Google Cloud. */
export function appOrigin(req: Request): string {
  const fromEnv = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

/** Only allow redirects to a path on this site (never to another domain). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

export function createPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildGoogleAuthUrl(p: { clientId: string; redirectUri: string; state: string; challenge: string }): string {
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: p.state,
    code_challenge: p.challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `${AUTH_URL}?${q.toString()}`;
}

export async function fetchGoogleProfile(
  p: { code: string; verifier: string; redirectUri: string; clientId: string; clientSecret: string },
  fetchImpl: typeof fetch = fetch
): Promise<GoogleProfile> {
  const tokenRes = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: p.code,
      client_id: p.clientId,
      client_secret: p.clientSecret,
      redirect_uri: p.redirectUri,
      grant_type: "authorization_code",
      code_verifier: p.verifier,
    }),
  });
  if (!tokenRes.ok) throw new Error(`Google token exchange failed (${tokenRes.status})`);
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("Google did not return an access token");

  const infoRes = await fetchImpl(USERINFO_URL, { headers: { authorization: `Bearer ${token.access_token}` } });
  if (!infoRes.ok) throw new Error(`Google profile fetch failed (${infoRes.status})`);
  const info = (await infoRes.json()) as Partial<GoogleProfile>;
  if (!info.sub || !info.email) throw new Error("Google profile is missing an email");
  // Never trust an email Google hasn't verified: it could belong to someone else.
  if (info.email_verified !== true) throw new Error("Google email is not verified");
  return { sub: info.sub, email: info.email.toLowerCase(), email_verified: true, name: info.name, picture: info.picture };
}

/** A unique username (3-20 letters/numbers/underscores) built from the person's email. */
export function usernameFromProfile(db: Database.Database, profile: GoogleProfile): string {
  let base = profile.email.toLowerCase().split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 14);
  if (base.length < 3) base = "player";
  const taken = (u: string) => !!db.prepare("SELECT 1 FROM User WHERE username = ?").get(u);
  if (!taken(base)) return base;
  for (let i = 0; i < 25; i++) {
    const candidate = `${base}${Math.floor(100 + Math.random() * 9000)}`.slice(0, 20);
    if (!taken(candidate)) return candidate;
  }
  return `player${randomBytes(6).toString("hex")}`.slice(0, 20);
}

export type GoogleLoginResult =
  | { ok: true; userId: string; role: string; status: string; created: boolean }
  | { ok: false; reason: "BANNED" | "SUSPENDED" };

/** Signs an existing user in, or creates a new account for this Google profile. */
export function findOrCreateGoogleUser(
  db: Database.Database,
  profile: GoogleProfile,
  refCode: string | null,
  now: string = new Date().toISOString()
): GoogleLoginResult {
  const email = profile.email.toLowerCase();
  const existing = db
    .prepare("SELECT id, role, status, avatarUrl FROM User WHERE email = ?")
    .get(email) as { id: string; role: string; status: string; avatarUrl: string | null } | undefined;

  if (existing) {
    if (existing.status === "BANNED") return { ok: false, reason: "BANNED" };
    if (existing.status === "SUSPENDED") return { ok: false, reason: "SUSPENDED" };
    // Google has just verified this email, so an account waiting on verification can go live.
    const status = existing.status === "PENDING_VERIFICATION" ? "ACTIVE" : existing.status;
    db.prepare(
      "UPDATE User SET lastLoginAt = ?, emailVerified = 1, status = ?, avatarUrl = COALESCE(avatarUrl, ?), updatedAt = ? WHERE id = ?"
    ).run(now, status, profile.picture ?? null, now, existing.id);
    return { ok: true, userId: existing.id, role: existing.role, status, created: false };
  }

  const referrer = refCode
    ? (db.prepare("SELECT id FROM User WHERE referralCode = ?").get(refCode) as { id: string } | undefined)
    : undefined; // an invalid code never blocks sign-in
  const userId = createId("user");
  const username = usernameFromProfile(db, profile);

  db.transaction(() => {
    db.prepare(
      `INSERT INTO User (id, uid, email, emailVerified, passwordHash, authProvider, username, displayName, avatarUrl, phone, role, status, referralCode, referredById, createdAt, updatedAt, lastLoginAt)
       VALUES (@id, @uid, @email, 1, NULL, 'GOOGLE', @username, @displayName, @avatarUrl, NULL, 'USER', 'ACTIVE', @referralCode, @referredById, @now, @now, @now)`
    ).run({
      id: userId,
      uid: createId(),
      email,
      username,
      displayName: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
      referralCode: createReferralCode(),
      referredById: referrer?.id ?? null,
      now,
    });
    db.prepare(
      `INSERT INTO Wallet (id, userId, depositBalance, winningBalance, bonusBalance, lockedBalance, updatedAt) VALUES (?, ?, 0, 0, 0, 0, ?)`
    ).run(createId("wal"), userId, now);
    db.prepare(`INSERT INTO PlayerStats (id, userId, updatedAt) VALUES (?, ?, ?)`).run(createId("stat"), userId, now);
    if (referrer) {
      // Reward is paid later, when this friend adds real money (same as email signup).
      db.prepare(
        `INSERT INTO Referral (id, referrerId, referredUserId, bonusAmount, bonusPaidAt, createdAt) VALUES (?, ?, ?, 0, NULL, ?)`
      ).run(createId("ref"), referrer.id, userId, now);
    }
  })();

  return { ok: true, userId, role: "USER", status: "ACTIVE", created: true };
}
