/** Mirrors the server's imageRefSchema: external http(s) URL, or our own public upload path. */
export const UPLOAD_PATH_RE = /^\/api\/uploads\/images\/[\w.-]+$/;

export function validateImageUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "Enter an image URL";
  if (v.length > 2000) return "Image URL is too long";
  if (UPLOAD_PATH_RE.test(v)) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "Invalid image URL (only http:// or https:// allowed)";
    return null;
  } catch {
    return "Invalid image URL";
  }
}

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_IMAGE_MB = 5;
