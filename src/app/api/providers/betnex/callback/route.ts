import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { getBetnexConfig, isBetnexConfigured } from "@/server/providers/betnex/betnex.config";
import { handleBetnexCallback } from "@/server/providers/betnex/betnex.callback";
import { clientIpFromHeaders } from "@/server/providers/betnex/betnex.ip";
import { providerWallet } from "@/server/providers/wallet.instance";

export const dynamic = "force-dynamic";

/**
 * BETNEX real-time bet/win callback. Register this HTTPS URL with BETNEX.
 * BETNEX accepts only HTTP 200 / 400 / 500 from this endpoint.
 */
export async function POST(req: Request) {
  const noStore = { "Cache-Control": "no-store" };
  if (!isBetnexConfigured()) {
    // Not set up: refuse without touching any balance (400 = "callback not acceptable").
    return NextResponse.json({ success: false, msg: "Invalid callback", handle: false }, { status: 400, headers: noStore });
  }
  const config = getBetnexConfig();
  const rawBody = await req.text();
  const reply = handleBetnexCallback(rawBody, clientIpFromHeaders(req.headers, config.trustedProxyHops), { db, wallet: providerWallet, config });
  return NextResponse.json(reply.body, { status: reply.status, headers: noStore });
}
