import { ApiError, fail } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { getPaymentSettings } from "@/server/lib/payment-settings";
import { readUpload } from "@/server/lib/uploads";

/** Serves the admin-configured payment QR image. `?download=1` forces a file download. */
export async function GET(req: Request) {
  try {
    await getCurrentUser();
    const { qrKey } = getPaymentSettings();
    const file = qrKey ? readUpload(qrKey) : null;
    if (!file) throw new ApiError(404, "No payment QR has been configured.", "NOT_FOUND");

    const download = new URL(req.url).searchParams.get("download") === "1";
    const ext = file.contentType === "image/png" ? "png" : file.contentType === "image/webp" ? "webp" : "jpg";
    return new Response(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "private, no-cache",
        "X-Content-Type-Options": "nosniff",
        ...(download ? { "Content-Disposition": `attachment; filename="xarena-payment-qr.${ext}"` } : {}),
      },
    });
  } catch (error) {
    return fail(error);
  }
}
