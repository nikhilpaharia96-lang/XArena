/**
 * Finds this server's public OUTBOUND IPv4, i.e. the address other services (BETNEX, AS Tech)
 * see when we call them. Needed to fill in an "IP allowlist" field on a provider dashboard.
 *
 * Asks a few well-known "what is my IP" endpoints (fixed URLs, nothing user-supplied) and only
 * accepts a plain IPv4 answer. Never throws: callers get { ip: null, error } instead.
 */
const SOURCES = [
  { name: "ipify", url: "https://api4.ipify.org?format=json", parse: (b: string) => (JSON.parse(b) as { ip?: string }).ip ?? "" },
  { name: "icanhazip", url: "https://ipv4.icanhazip.com", parse: (b: string) => b.trim() },
  { name: "ifconfig.me", url: "https://ifconfig.me/ip", parse: (b: string) => b.trim() },
] as const;

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

export interface ServerIpResult {
  ip: string | null;
  source: string | null;
  error?: string;
}

export async function detectOutboundIp(fetchImpl: typeof fetch = fetch, timeoutMs = 5000): Promise<ServerIpResult> {
  for (const s of SOURCES) {
    try {
      const res = await fetchImpl(s.url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) continue;
      const ip = s.parse(await res.text());
      if (IPV4.test(ip)) return { ip, source: s.name };
    } catch {
      // try the next source
    }
  }
  return { ip: null, source: null, error: "Couldn't reach any IP lookup service from this server." };
}
