import { describe, expect, it } from "vitest";
import { detectOutboundIp } from "../server-ip";

const reply = (body: string, status = 200) => Promise.resolve(new Response(body, { status }));

describe("detectOutboundIp", () => {
  it("returns the IPv4 from the first source that answers", async () => {
    const r = await detectOutboundIp((() => reply('{"ip":"203.0.113.7"}')) as typeof fetch);
    expect(r).toEqual({ ip: "203.0.113.7", source: "ipify" });
  });

  it("falls through failing or non-IPv4 sources", async () => {
    let n = 0;
    const f = (() => {
      n += 1;
      if (n === 1) return Promise.reject(new Error("down"));
      if (n === 2) return reply("2001:db8::1"); // IPv6 is rejected
      return reply("198.51.100.23\n");
    }) as typeof fetch;
    expect(await detectOutboundIp(f)).toEqual({ ip: "198.51.100.23", source: "ifconfig.me" });
  });

  it("rejects junk answers and reports an error instead of throwing", async () => {
    const r = await detectOutboundIp((() => reply("<html>nope</html>")) as typeof fetch);
    expect(r.ip).toBeNull();
    expect(r.error).toBeTruthy();
  });

  it("rejects out-of-range octets", async () => {
    const r = await detectOutboundIp((() => reply("999.1.1.1")) as typeof fetch);
    expect(r.ip).toBeNull();
  });
});
