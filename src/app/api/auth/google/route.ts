import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { appOrigin, buildGoogleAuthUrl, createPkce, GOOGLE_STATE_COOKIE, googleConfig, safeNext } from "@/server/lib/google-auth";
import { checkRateLimit, getClientKey } from "@/server/lib/rate-limit";

// Step 1: send the person to Google's account chooser.
export async function GET(req: Request) {
  const origin = appOrigin(req);
  const cfg = googleConfig();
  if (!cfg) return NextResponse.redirect(`${origin}/login?error=google_unavailable`);

  const { allowed } = checkRateLimit(`google:${getClientKey(req)}`, 20, 60_000);
  if (!allowed) return NextResponse.redirect(`${origin}/login?error=too_many`);

  const url = new URL(req.url);
  const ref = (url.searchParams.get("ref") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  const next = safeNext(url.searchParams.get("next"));
  const state = randomBytes(24).toString("base64url");
  const { verifier, challenge } = createPkce();

  const res = NextResponse.redirect(
    buildGoogleAuthUrl({ clientId: cfg.clientId, redirectUri: `${origin}/api/auth/google/callback`, state, challenge })
  );
  res.cookies.set(GOOGLE_STATE_COOKIE, JSON.stringify({ state, verifier, next, ref }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 10 * 60,
  });
  return res;
}
