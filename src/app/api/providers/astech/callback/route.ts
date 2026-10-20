import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { handleAsTechCallback } from "@/server/providers/astech/astech.callback";
import { providerWallet } from "@/server/providers/wallet.instance";

export const dynamic = "force-dynamic";

/**
 * AS Tech seamless-wallet callback. Configure this HTTPS URL under
 * AS Tech Panel -> API Details -> Callback URL.
 *
 * Contract (https://astechapi.cloud/docs#callbacks): always HTTP 200 with the
 * JSON envelope, even for failures. The raw body is read as text so the
 * HMAC is verified over the exact bytes AS Tech signed.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const reply = handleAsTechCallback(rawBody, req.headers.get("x-signature"), {
    db,
    wallet: providerWallet,
    secretKey: process.env.ASTECH_SECRET_KEY || null,
  });
  return NextResponse.json(reply, { status: 200, headers: { "Cache-Control": "no-store" } });
}
