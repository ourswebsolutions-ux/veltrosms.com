import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/server/env";

/**
 * Blog featured images uploaded by admins. Stored outside the build output
 * (BLOG_UPLOAD_DIR, default .data/uploads/blog) under a random name and served
 * by /media/blog/[name]. The type is decided from the file's own bytes, never
 * from the browser-supplied name or MIME type; SVG is not accepted.
 */

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const BLOG_MEDIA_PREFIX = "/media/blog/";
const NAME_RE = /^[a-f0-9]{32}\.(png|jpg|webp|gif)$/;

const TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
} as const;
type Ext = keyof typeof TYPES;

function sniff(b: Buffer): Ext | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (b.length >= 6 && (b.toString("ascii", 0, 6) === "GIF87a" || b.toString("ascii", 0, 6) === "GIF89a")) return "gif";
  return null;
}

const dir = () => path.resolve(env().BLOG_UPLOAD_DIR);

export type SavedImage = { ok: true; url: string } | { ok: false; message: string };

export async function saveBlogImage(file: File): Promise<SavedImage> {
  if (file.size === 0) return { ok: false, message: "The image file is empty." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, message: "The image is too large (max 3 MB)." };
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = sniff(bytes);
  if (!ext) return { ok: false, message: "Upload a PNG, JPEG, WebP or GIF image." };
  const name = `${randomBytes(16).toString("hex")}.${ext}`;
  await mkdir(dir(), { recursive: true });
  await writeFile(path.join(dir(), name), bytes, { flag: "wx" });
  return { ok: true, url: `${BLOG_MEDIA_PREFIX}${name}` };
}

/** Bytes + content type of a stored image, or null for an unknown/invalid name. */
export async function readBlogImage(name: string): Promise<{ bytes: Buffer; type: string } | null> {
  if (!NAME_RE.test(name)) return null;
  try {
    const bytes = await readFile(path.join(dir(), name));
    return { bytes, type: TYPES[name.split(".")[1] as Ext] };
  } catch {
    return null;
  }
}

/** Removes an uploaded image that is no longer used (ignores URLs and missing files). */
export async function deleteBlogImage(url: string | null): Promise<void> {
  if (!url?.startsWith(BLOG_MEDIA_PREFIX)) return;
  const name = url.slice(BLOG_MEDIA_PREFIX.length);
  if (!NAME_RE.test(name)) return;
  await unlink(path.join(dir(), name)).catch(() => {});
}
