import { createReadStream } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, normalize, relative } from "node:path";
import type { Request, Response } from "express";
import { ENV } from "./_core/env";
import { storageGetSignedUrl, storagePut } from "./storage";

const LOCAL_MEDIA_ROOT = join(process.cwd(), "data", "media");
const LOCAL_MEDIA_PREFIX = "/api/media-local/";

function normalizeMediaKey(key: string) {
  const normalized = normalize(key).replace(/^[/\\]+/, "");
  if (!normalized || normalized.startsWith("..") || relative(".", normalized).startsWith("..")) {
    throw new Error("مفتاح التخزين غير صالح.");
  }
  return normalized;
}

function useManagedStorage() {
  return Boolean(ENV.forgeApiUrl && ENV.forgeApiKey);
}

export type MediaStoredFile = { key: string; url: string; storage: "managed" | "local" };

export async function mediaPut(key: string, data: Buffer | Uint8Array, contentType: string): Promise<MediaStoredFile> {
  const safeKey = normalizeMediaKey(key);
  if (useManagedStorage()) {
    const stored = await storagePut(safeKey, data, contentType);
    return { ...stored, storage: "managed" };
  }
  if (ENV.isProduction) throw new Error("إعداد التخزين المُدار غير متاح في بيئة الإنتاج.");
  const localPath = join(LOCAL_MEDIA_ROOT, safeKey);
  await mkdir(dirname(localPath), { recursive: true });
  await writeFile(localPath, data);
  return { key: safeKey, url: `${LOCAL_MEDIA_PREFIX}${encodeURIComponent(safeKey)}`, storage: "local" };
}

export async function mediaGetBuffer(key: string) {
  const safeKey = normalizeMediaKey(key);
  if (useManagedStorage()) {
    const signedUrl = await storageGetSignedUrl(safeKey);
    const response = await fetch(signedUrl);
    if (!response.ok) throw new Error("تعذر قراءة ملف الفيديو المخزن للمعالجة.");
    return Buffer.from(await response.arrayBuffer());
  }
  if (ENV.isProduction) throw new Error("إعداد التخزين المُدار غير متاح في بيئة الإنتاج.");
  return readFile(join(LOCAL_MEDIA_ROOT, safeKey));
}

export async function serveLocalMedia(request: Request, response: Response) {
  if (useManagedStorage()) return response.status(404).end();
  let key: string;
  try {
    const mediaPath = (request.params as { mediaPath?: string | string[]; 0?: string }).mediaPath;
    const rawPath = Array.isArray(mediaPath) ? mediaPath.join("/") : mediaPath ?? request.params["0"] ?? "";
    key = normalizeMediaKey(decodeURIComponent(rawPath));
  } catch {
    return response.status(400).json({ error: "مسار الوسيط غير صالح." });
  }
  const filePath = join(LOCAL_MEDIA_ROOT, key);
  try {
    await access(filePath);
  } catch {
    return response.status(404).json({ error: "الوسيط غير موجود." });
  }
  const extension = extname(filePath).toLowerCase();
  const contentType = extension === ".mp4" ? "video/mp4" : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : "application/octet-stream";
  response.setHeader("Content-Type", contentType);
  response.setHeader("Cache-Control", "no-store");
  return createReadStream(filePath).pipe(response);
}
