import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { ApiError } from "@/server/lib/api-response";

/**
 * Private local file storage for user/admin uploads.
 *
 * The project has no cloud storage configured yet (Firebase Storage is
 * reserved in .env.example but not wired up), so files are written under
 * ./data/uploads — OUTSIDE /public — and only ever served through
 * authorised API routes. Swapping this for S3/R2/Cloudinary later only
 * requires changing saveImageUpload/readUpload; callers store an opaque
 * "key" and never touch the filesystem themselves.
 */

const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED: Record<string, { mime: string; exts: string[] }> = {
  jpeg: { mime: "image/jpeg", exts: [".jpg", ".jpeg"] },
  png: { mime: "image/png", exts: [".png"] },
  webp: { mime: "image/webp", exts: [".webp"] },
};

/** Identify the real image type from magic bytes — never trust the client's MIME/extension alone. */
function sniffImageType(buf: Buffer): keyof typeof ALLOWED | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "png";
  }
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return "webp";
  }
  return null;
}

export type UploadFolder = "deposits" | "payment";

/** Validates (size, MIME, extension, magic bytes) and stores an uploaded image. Returns the storage key. */
export async function saveImageUpload(file: File, folder: UploadFolder, maxBytes = MAX_IMAGE_BYTES): Promise<string> {
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) {
    throw new ApiError(400, "Please choose an image to upload.", "FILE_REQUIRED");
  }
  if (file.size > maxBytes) {
    throw new ApiError(400, `Image is too large. Maximum size is ${Math.round(maxBytes / 1024 / 1024)} MB.`, "FILE_TOO_LARGE");
  }

  const ext = path.extname(file.name || "").toLowerCase();
  const declared = Object.values(ALLOWED).find((t) => t.mime === file.type);
  const extOk = Object.values(ALLOWED).some((t) => t.exts.includes(ext));
  if (!declared || !extOk) {
    throw new ApiError(400, "Only JPG, JPEG, PNG or WebP images are allowed.", "INVALID_FILE_TYPE");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffImageType(buf);
  if (!sniffed || ALLOWED[sniffed].mime !== declared.mime) {
    throw new ApiError(400, "That file doesn't look like a valid image.", "INVALID_FILE_TYPE");
  }

  const fileExt = ALLOWED[sniffed].exts[0];
  const name = `${Date.now()}-${randomBytes(12).toString("hex")}${fileExt}`;
  const dir = path.join(UPLOAD_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), buf, { mode: 0o640 });
  return `${folder}/${name}`;
}

/** Reads a stored upload by key. Rejects any key that could escape the upload root. */
export function readUpload(key: string): { data: Buffer; contentType: string } | null {
  if (!/^(deposits|payment)\/[\w.-]+$/.test(key) || key.includes("..")) return null;
  const full = path.join(UPLOAD_ROOT, key);
  if (!full.startsWith(UPLOAD_ROOT + path.sep) || !fs.existsSync(full)) return null;

  const ext = path.extname(full).toLowerCase();
  const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return { data: fs.readFileSync(full), contentType };
}

export function deleteUpload(key: string | null | undefined) {
  if (!key || !/^(deposits|payment)\/[\w.-]+$/.test(key) || key.includes("..")) return;
  const full = path.join(UPLOAD_ROOT, key);
  if (full.startsWith(UPLOAD_ROOT + path.sep)) fs.rmSync(full, { force: true });
}
