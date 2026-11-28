/**
 * Real client IP behind reverse proxies. X-Forwarded-For is "client, proxy1, proxy2…": each proxy APPENDS the
 * address it saw, so only the entries our own proxies added can be trusted — never the left-most (client-supplied)
 * one. With N trusted proxy hops the real client is the N-th entry from the right.
 * Direct connections (no proxy) expose no IP to a route handler, so they are rejected (null) — BETNEX must be
 * reached through your proxy / load balancer. Configure BETNEX_TRUSTED_PROXY_HOPS (default 1).
 */
export function clientIpFromHeaders(headers: Headers, trustedProxyHops: number): string | null {
  if (trustedProxyHops < 1) return null;
  const xff = headers.get("x-forwarded-for");
  if (!xff) return null;
  const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
  const ip = parts[parts.length - trustedProxyHops];
  return ip ?? null;
}
