export async function register() {
  // Node server only (not the edge runtime, not the build step).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startPushDispatcher } = await import("@/server/lib/push-dispatcher");
    startPushDispatcher();
  }
}
