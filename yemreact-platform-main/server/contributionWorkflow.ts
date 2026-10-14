import crypto from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { auditEvents, contributions, userNotifications, users, videoProcessingJobs } from "../drizzle/schema";
import { getDb } from "./db";
import { decodeVideoBase64, MAX_VIDEO_BASE64_LENGTH, storeOriginalVideo } from "./videoProcessing";
import { enqueueVideoJob, getVideoProcessingJobByIdempotencyKey, processNextVideoJob } from "./videoQueue";

const publishableRights = new Set(["cleared", "permission", "original"]);

export const contributionUploadInput = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().max(127),
  dataBase64: z.string().min(16).max(MAX_VIDEO_BASE64_LENGTH),
  note: z.string().trim().max(1000).optional().nullable(),
});

export const contributionListInput = z.object({
  status: z.enum(["pending", "reviewing", "processing", "approved", "rejected"]).optional(),
});

export const contributionReviewInput = z.object({
  contributionId: z.number().int().positive(),
  quote: z.string().trim().min(1).max(180),
  situation: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional().nullable(),
  keywords: z.string().trim().max(1500).optional().nullable(),
  categoryId: z.string().trim().min(1).max(32),
  corner: z.enum(["tr", "tl"]).default("tr"),
  sourceName: z.string().trim().min(1).max(255),
  sourceUrl: z.string().trim().url().max(2048).optional().or(z.literal("")),
  rightsStatus: z.enum(["cleared", "permission", "original"]),
  idempotencyKey: z.string().trim().min(16).max(96).optional(),
});

export const contributionRejectInput = z.object({
  contributionId: z.number().int().positive(),
  reason: z.string().trim().min(4, "سبب الرفض مطلوب.").max(1200),
  idempotencyKey: z.string().trim().min(16).max(96).optional(),
});

type ContributionUploadInput = z.infer<typeof contributionUploadInput>;
type ContributionReviewInput = z.infer<typeof contributionReviewInput>;

function trackingCode() {
  return `YRC-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

async function audit(actorUserId: number | null, entityType: "contribution" | "reaction" | "homepage", entityId: number, action: string, details?: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditEvents).values({ actorUserId: actorUserId ?? null, entityType, entityId, action, details: details ? JSON.stringify(details) : null });
}

async function addContributionNotification(userId: number, contributionId: number, type: "contribution_approved" | "contribution_rejected", title: string, body: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db.insert(userNotifications).values({ userId, contributionId, type, title, body });
}

function toContributionDto(contribution: typeof contributions.$inferSelect, owner?: Pick<typeof users.$inferSelect, "name" | "email">) {
  return {
    id: contribution.id,
    trackingCode: contribution.trackingCode,
    note: contribution.note,
    status: contribution.status,
    processingStatus: contribution.processingStatus,
    processingError: contribution.processingError,
    originalMediaUrl: contribution.originalMediaUrl,
    originalMediaOriginalName: contribution.originalMediaOriginalName,
    originalMediaSizeBytes: contribution.originalMediaSizeBytes,
    processedMediaUrl: contribution.processedMediaUrl,
    thumbnailUrl: contribution.thumbnailUrl,
    durationSeconds: contribution.durationSeconds,
    quote: contribution.quote,
    situation: contribution.situation,
    description: contribution.description,
    keywords: contribution.keywords,
    categoryId: contribution.categoryId,
    corner: contribution.corner,
    sourceName: contribution.sourceName,
    sourceUrl: contribution.sourceUrl,
    rightsStatus: contribution.rightsStatus,
    rejectionReason: contribution.rejectionReason,
    publishedReactionId: contribution.publishedReactionId,
    reviewedAt: contribution.reviewedAt,
    createdAt: contribution.createdAt,
    updatedAt: contribution.updatedAt,
    ownerName: owner?.name ?? null,
    ownerEmail: owner?.email ?? null,
  };
}

export async function submitContribution(userId: number, input: ContributionUploadInput) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const data = decodeVideoBase64(input.dataBase64);
  const code = trackingCode();
  const { stored, mimeType } = await storeOriginalVideo({ data, fileName: input.fileName, contentType: input.contentType, storagePrefix: `contributions/${code}` });
  await db.insert(contributions).values({
    userId,
    trackingCode: code,
    note: input.note || null,
    status: "pending",
    processingStatus: "pending",
    originalMediaKey: stored.key,
    originalMediaUrl: stored.url,
    originalMediaMimeType: mimeType,
    originalMediaOriginalName: input.fileName,
    originalMediaSizeBytes: data.length,
  });
  const [created] = await db.select().from(contributions).where(eq(contributions.trackingCode, code)).limit(1);
  if (!created) throw new Error("تعذر حفظ المساهمة.");
  await audit(userId, "contribution", created.id, "submitted", { trackingCode: code, sizeBytes: data.length });
  return toContributionDto(created);
}

export async function listOwnContributions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const rows = await db.select().from(contributions).where(eq(contributions.userId, userId)).orderBy(desc(contributions.createdAt));
  return rows.map(row => toContributionDto(row));
}

export async function listAdminContributions(status?: z.infer<typeof contributionListInput>["status"]) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const rows = await db
    .select({ contribution: contributions, owner: users })
    .from(contributions)
    .innerJoin(users, eq(contributions.userId, users.id))
    .where(status ? eq(contributions.status, status) : undefined)
    .orderBy(desc(contributions.updatedAt));
  return rows.map(({ contribution, owner }) => toContributionDto(contribution, owner));
}

export async function rejectContribution(adminUserId: number, input: z.infer<typeof contributionRejectInput>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [contribution] = await db.select().from(contributions).where(eq(contributions.id, input.contributionId)).limit(1);
  if (!contribution) throw new Error("المساهمة غير موجودة.");
  if (contribution.status === "approved") throw new Error("لا يمكن رفض مساهمة تم اعتمادها.");
  const idempotencyKey = input.idempotencyKey || crypto.randomUUID();
  if (contribution.rejectionIdempotencyKey === idempotencyKey) return { success: true, reused: true } as const;
  const now = new Date();
  await db.transaction(async tx => {
    await tx.update(contributions).set({ status: "rejected", rejectionReason: input.reason, rejectionIdempotencyKey: idempotencyKey, reviewedByUserId: adminUserId, reviewedAt: now, updatedAt: now }).where(eq(contributions.id, contribution.id));
    await tx.insert(userNotifications).values({ userId: contribution.userId, contributionId: contribution.id, type: "contribution_rejected", title: "تمت مراجعة مساهمتك", body: `لم تُقبل مساهمتك ${contribution.trackingCode ?? ""}. السبب: ${input.reason}` });
    await tx.insert(auditEvents).values({ actorUserId: adminUserId, entityType: "contribution", entityId: contribution.id, action: "rejected", details: JSON.stringify({ reason: input.reason }) });
  });
  return { success: true, reused: false } as const;
}

export async function approveContribution(adminUserId: number, input: ContributionReviewInput) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [contribution] = await db.select().from(contributions).where(eq(contributions.id, input.contributionId)).limit(1);
  if (!contribution) throw new Error("المساهمة غير موجودة.");
  if (contribution.status === "approved") throw new Error("هذه المساهمة معتمدة بالفعل.");
  if (!contribution.originalMediaKey || !contribution.originalMediaMimeType || !contribution.originalMediaOriginalName) throw new Error("لا يحتوي سجل المساهمة على فيديو صالح للمعالجة.");
  if (!publishableRights.has(input.rightsStatus)) throw new Error("اختر حالة حقوق تسمح بالنشر.");
  const idempotencyKey = input.idempotencyKey || crypto.randomUUID();
  if (contribution.approvalIdempotencyKey === idempotencyKey) {
    const existingJob = await getVideoProcessingJobByIdempotencyKey(`contribution-${idempotencyKey}`);
    if (existingJob) return { job: existingJob, reused: true };
  }

  const now = new Date();
  const job = await db.transaction(async tx => {
    await tx.update(contributions).set({
      status: "processing", processingStatus: "pending", processingError: null,
      quote: input.quote, situation: input.situation, description: input.description || null, keywords: input.keywords || null,
      categoryId: input.categoryId, corner: input.corner, sourceName: input.sourceName, sourceUrl: input.sourceUrl || null, rightsStatus: input.rightsStatus,
      approvalIdempotencyKey: idempotencyKey, reviewedByUserId: adminUserId, reviewedAt: now, updatedAt: now,
    }).where(eq(contributions.id, contribution.id));
    await tx.insert(videoProcessingJobs).values({ jobType: "contribution", contributionId: contribution.id, status: "pending", idempotencyKey: `contribution-${idempotencyKey}` });
    const [created] = await tx.select().from(videoProcessingJobs).where(eq(videoProcessingJobs.idempotencyKey, `contribution-${idempotencyKey}`)).limit(1);
    if (!created) throw new Error("تعذر إنشاء مهمة معالجة المساهمة.");
    await tx.insert(auditEvents).values({ actorUserId: adminUserId, entityType: "contribution", entityId: contribution.id, action: "processing_queued", details: JSON.stringify({ jobId: created.id }) });
    return created;
  });
  if (process.env.NODE_ENV === "development" && !process.env.VITEST && !process.env.VITEST_WORKER_ID) {
    void processNextVideoJob().catch(error => console.error("[VideoQueue] Development worker failed:", error));
  }
  return { job, reused: false };
}

export async function listAuditEvents() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const rows = await db.select({ event: auditEvents, actor: users }).from(auditEvents).leftJoin(users, eq(auditEvents.actorUserId, users.id)).orderBy(desc(auditEvents.createdAt)).limit(100);
  return rows.map(({ event, actor }) => ({ ...event, actorName: actor?.name ?? null, actorEmail: actor?.email ?? null }));
}

export async function listUnreadNotifications(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db.select().from(userNotifications).where(and(eq(userNotifications.userId, userId), isNull(userNotifications.readAt))).orderBy(desc(userNotifications.createdAt));
}

export async function markNotificationsRead(userId: number, notificationIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const uniqueIds = Array.from(new Set(notificationIds)).filter(Number.isInteger);
  for (const id of uniqueIds) await db.update(userNotifications).set({ readAt: new Date() }).where(and(eq(userNotifications.id, id), eq(userNotifications.userId, userId)));
  return { success: true } as const;
}
