// ----------------------------------------------------------------------------
// In-memory sliding-window rate limiter.
//
// This is a pragmatic stand-in for the Redis-backed limiter the production
// NestJS backend will use (needed for correctness across multiple server
// instances). Single-process here is fine for local dev / this demo; the
// interface (checkRateLimit(key, limit, windowMs)) is identical to what a
// Redis INCR+EXPIRE implementation would expose, so swapping the
// implementation later doesn't change any call site.
// ----------------------------------------------------------------------------

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

export function getClientKey(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("cf-connecting-ip") ??
    "local"
  );
}
