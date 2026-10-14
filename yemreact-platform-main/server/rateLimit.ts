import crypto from "node:crypto";
import type { Request } from "express";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { rateLimitBuckets } from "../drizzle/schema";
import { getDb } from "./db";

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function requestFingerprint(req: Request, userId?: number | null) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim() || req.ip || "unknown";
  return hash(`${userId ? `user:${userId}` : "anon"}|${ip}|${req.headers["user-agent"] ?? "unknown"}`);
}

export async function enforceRateLimit(input: { scope: string; fingerprint: string; limit: number; windowSeconds: number }) {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  const bucketStartMs = Math.floor(now.getTime() / (input.windowSeconds * 1000)) * input.windowSeconds * 1000;
  const windowStartedAt = new Date(bucketStartMs);
  const keyHash = hash(`${input.scope}:${input.fingerprint}:${bucketStartMs}`);
  const expiresAt = new Date(bucketStartMs + input.windowSeconds * 1000 * 2);
  await db.insert(rateLimitBuckets).values({ keyHash, windowStartedAt, count: 1, expiresAt, updatedAt: now })
    .onDuplicateKeyUpdate({ set: { count: sql`${rateLimitBuckets.count} + 1`, updatedAt: now, expiresAt } });
  const [bucket] = await db.select({ count: rateLimitBuckets.count }).from(rateLimitBuckets).where(eq(rateLimitBuckets.keyHash, keyHash)).limit(1);
  if ((bucket?.count ?? 0) > input.limit) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "تم تجاوز الحد المؤقت للمحاولات. يرجى الانتظار ثم المحاولة مجددًا." });
  }
}
