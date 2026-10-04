import { ApiError, fail } from "@/server/lib/api-response";
import { readUpload } from "@/server/lib/uploads";

/** Public read for marketing images only. Other upload folders are never reachable from here. */
export async function GET(_req: Request, context: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await context.params;
    const file = readUpload(`images/${name}`);
    if (!file) throw new ApiError(404, "Image not found.", "NOT_FOUND");
    return new Response(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
