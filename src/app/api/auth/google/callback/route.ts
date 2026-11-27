import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/server/db/client";
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  createRefreshTokenValue,
  refreshTokenExpiry,
  signAccessToken,
} from "@/server/lib/auth";
import { createId } from "@/server/lib/ids";
import {
  appOrigin,
  fetchGoogleProfile,
  findOrCreateGoogleUser,
  GOOGLE_STATE_COOKIE,
  googleConfig,
  safeNext,
} from "@/server/lib/google-auth";

function sameValue(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Step 2: Google sends the person back here with a one-time code.
export async function GET(req: Request) {
  const origin = appOrigin(req);
  const toLogin = (error: string) => {
    const res = NextResponse.redirect(`${origin}/login?error=${error}`);
    res.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/api/auth/google" });
    return res;
  };

  const cfg = googleConfig();
  if (!cfg) return toLogin("google_unavailable");

  const url = new URL(req.url);
  if (url.searchParams.get("error")) return toLogin("google_cancelled"); // e.g. they pressed Cancel
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  let saved: { state: string; verifier: string; next: string; ref: string } | null = null;
  try {
    const raw = req.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(`${GOOGLE_STATE_COOKIE}=`));
    if (raw) saved = JSON.parse(decodeURIComponent(raw.slice(GOOGLE_STATE_COOKIE.length + 1)));
  } catch {
    saved = null;
  }
  // The state must match the one we stored in this browser, or the request isn't ours.
  if (!code || !state || !saved || !sameValue(state, saved.state)) return toLogin("google_failed");

  let result;
  try {
    const profile = await fetchGoogleProfile({
      code,
      verifier: saved.verifier,
      redirectUri: `${origin}/api/auth/google/callback`,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
    });
    result = findOrCreateGoogleUser(db, profile, saved.ref || null);
  } catch (err) {
    console.error("Google sign-in failed:", err instanceof Error ? err.message : err);
    return toLogin("google_failed");
  }
  if (!result.ok) return toLogin(result.reason === "BANNED" ? "account_banned" : "account_suspended");

  const now = new Date().toISOString();
  const accessToken = signAccessToken({ sub: result.userId, role: result.role, status: result.status });
  const refreshToken = createRefreshTokenValue();
  db.prepare(`INSERT INTO Session (id, userId, refreshToken, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)`).run(
    createId("sess"),
    result.userId,
    refreshToken,
    refreshTokenExpiry().toISOString(),
    now
  );

  const res = NextResponse.redirect(`${origin}${safeNext(saved.next)}`);
  res.cookies.set(ACCESS_COOKIE_NAME, accessToken, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 15 });
  res.cookies.set(REFRESH_COOKIE_NAME, refreshToken, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  res.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/api/auth/google" });
  return res;
}
