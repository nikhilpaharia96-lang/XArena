import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { saveImageUpload } from "@/server/lib/uploads";
import { writeAuditLog } from "@/server/lib/audit";

/**
 * Admin image upload (tournament banners/thumbnails, CMS banners). Reuses the existing
 * validated storage layer (size, MIME, extension and magic-byte checks) and returns a
 * public URL path — the DB only ever stores that path or an external https URL.
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    requireRole(user, "ADMIN", "SUPER_ADMIN", "MODERATOR");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Please choose an image to upload.", "FILE_REQUIRED");

    const key = await saveImageUpload(file, "images");
    writeAuditLog({ actorId: user.id, action: "IMAGE_UPLOADED", targetType: "Upload", targetId: key });
    return ok({ url: `/api/uploads/${key}` }, 201);
  } catch (error) {
    return fail(error);
  }
}
