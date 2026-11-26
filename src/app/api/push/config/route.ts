import { ok } from "@/server/lib/api-response";
import { pushConfig } from "@/server/lib/push";

/** Tells the browser whether push is available and gives it the public VAPID key. */
export async function GET() {
  const cfg = pushConfig();
  return ok({ enabled: !!cfg, publicKey: cfg?.publicKey ?? null });
}
