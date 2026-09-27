import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// ----------------------------------------------------------------------------
// Auth primitives.
//
// Design: short-lived signed JWT access tokens (15 min) carried in an
// httpOnly cookie, plus a longer-lived opaque refresh token persisted in the
// Session table so it can be revoked (logout, ban, password change).
// This is the same shape a NestJS + Passport-JWT backend would use, so
// migrating later is a matter of moving these functions into a Nest
// AuthService, not redesigning the flow.
//
// NOTE ON FIREBASE: the product spec calls for Firebase Authentication
// (email OTP + Google login) as the system of record for identity. Wiring
// that in requires a real Firebase project (API keys, OAuth client, service
// account). This module implements the equivalent flow with our own
// email+password auth so the app is fully functional today; swapping in
// Firebase later means replacing verifyPassword/signup with
// firebase-admin's verifyIdToken() and keeping everything downstream
// (session issuance, JWT, RBAC) identical.
// ----------------------------------------------------------------------------

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-in-prod";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-in-prod";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AccessTokenPayload {
  sub: string; // user id
  role: string;
  status: string;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function createRefreshTokenValue(): string {
  return jwt.sign({ t: Date.now() }, REFRESH_SECRET, { expiresIn: "30d" });
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
}

export const ACCESS_COOKIE_NAME = "xarena_access";
export const REFRESH_COOKIE_NAME = "xarena_refresh";
