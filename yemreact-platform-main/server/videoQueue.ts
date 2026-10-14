import crypto from "node:crypto";
import { and, asc, desc, eq, lt, lte, sql } from "drizzle-orm";
import { auditEvents, contributions, reactions, userNotifications, videoProcessingJobs } from "../drizzle/schema";
import { MAX_REACTION_DURATION_SECONDS } from "../shared/reactionLimits";
import { getDb } from "./db";
import { mediaGetBuffer } from "./mediaStorage";
import { processVideoUpload, type VideoProcessingResult } from "./videoProcessing";

type JobType = "reaction" | "contribution";
type ProcessingStage = "queued" | "source_download" | "source_metadata" | "transcoding" | "thumbnail" | "output_metadata" | "publishing" | "completed" | "failed" | "stuck" | "cancelled";
type ProcessingLogEntry = { stage: ProcessingStage; at: string; progressPercent: number; details?: Record<string, number | string | null> };
type StageReporter = (stage: ProcessingStage, progressPercent: number, details?: Record<string, number | string | null>) => Promise<void>;
const STUCK_JOB_THRESHOLD_MS = 5 * 60_000;

function canRunImmediateWorker() {
  const isVitestProcess = process.argv.some(argument => argument.toLowerCase().includes("vitest"));
  return process.env.NODE_ENV === "development" && !process.env.VITEST && !process.env.VITEST_WORKER_ID && !isVitestProcess;
}

function newIdempotencyKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function parseProcessingLog(value: string | null): ProcessingLogEntry[] {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed as ProcessingLogEntry[] : [];
  } catch {
    return [];
  }
}

function appendProcessingLog(current: ProcessingLogEntry[], entry: ProcessingLogEntry) {
  return [...current, entry].slice(-30);
}

function jobEntity(job: typeof videoProcessingJobs.$inferSelect) {
  return job.reactionId ? "reaction" : "contribution";
}

function jobDto(job: typeof videoProcessingJobs.$inferSelect) {
  return {
    id: job.id,
    jobType: job.jobType,
    reactionId: job.reactionId,
    contributionId: job.contributionId,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    runAfter: job.runAfter,
    lastError: job.lastError,
    completedAt: job.completedAt,
    lockedAt: job.lockedAt,
    stage: job.stage,
    stageStartedAt: job.stageStartedAt,
    processingStartedAt: job.processingStartedAt,
    progressPercent: job.progressPercent,
    originalSizeBytes: job.originalSizeBytes,
    processedSizeBytes: job.processedSizeBytes,
    sourceDurationSeconds: job.sourceDurationSeconds,
    processingLog: parseProcessingLog(job.processingLog),
    isStuck: job.status === "processing" && Boolean(job.lockedAt && job.lockedAt.getTime() <= Date.now() - STUCK_JOB_THRESHOLD_MS),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

export async function getVideoProcessingJob(jobId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [job] = await db.select().from(videoProcessingJobs).where(eq(videoProcessingJobs.id, jobId)).limit(1);
  return job ? jobDto(job) : null;
}

export async function listVideoProcessingJobs(limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const rows = await db.select({ job: videoProcessingJobs, reaction: reactions, contribution: contributions })
    .from(videoProcessingJobs)
    .leftJoin(reactions, eq(videoProcessingJobs.reactionId, reactions.id))
    .leftJoin(contributions, eq(videoProcessingJobs.contributionId, contributions.id))
    .orderBy(desc(videoProcessingJobs.updatedAt))
    .limit(Math.max(1, Math.min(limit, 200)));
  return rows.map(({ job, reaction, contribution }) => ({
    ...jobDto(job),
    reactionPublicId: reaction?.publicId ?? null,
    reactionCaption: reaction?.quote ?? null,
    contributionTrackingCode: contribution?.trackingCode ?? null,
  }));
}

export async function retryVideoProcessingJob(jobId: number, adminUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const retried = await db.transaction(async tx => {
    const [job] = await tx.select().from(videoProcessingJobs).where(eq(videoProcessingJobs.id, jobId)).limit(1).for("update");
    if (!job) throw new Error("مهمة الفيديو غير موجودة.");
    if (job.status !== "failed" && job.status !== "cancelled") throw new Error("يمكن إعادة معالجة المهام الفاشلة أو الملغاة فقط.");
    const now = new Date();
    const log = appendProcessingLog(parseProcessingLog(job.processingLog), { stage: "queued", at: now.toISOString(), progressPercent: 0, details: { action: "retried" } });
    await tx.update(videoProcessingJobs).set({ status: "pending", stage: "queued", stageStartedAt: now, processingStartedAt: null, progressPercent: 0, attempts: 0, runAfter: now, lockedAt: null, lockToken: null, lastError: null, completedAt: null, processingLog: JSON.stringify(log), updatedAt: now }).where(eq(videoProcessingJobs.id, job.id));
    if (job.reactionId) await tx.update(reactions).set({ processingStatus: "pending", processingError: null, updatedAt: now }).where(eq(reactions.id, job.reactionId));
    if (job.contributionId) await tx.update(contributions).set({ status: "processing", processingStatus: "pending", processingError: null, updatedAt: now }).where(eq(contributions.id, job.contributionId));
    await tx.insert(auditEvents).values({ actorUserId: adminUserId, entityType: jobEntity(job), entityId: job.reactionId ?? job.contributionId ?? 0, action: "video_processing_retried", details: JSON.stringify({ jobId: job.id }) });
    const [updated] = await tx.select().from(videoProcessingJobs).where(eq(videoProcessingJobs.id, job.id)).limit(1);
    return updated ?? null;
  });
  if (retried && canRunImmediateWorker()) queueImmediateVideoProcessing();
  return retried ? jobDto(retried) : null;
}

export async function cancelVideoProcessingJob(jobId: number, adminUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db.transaction(async tx => {
    const [job] = await tx.select().from(videoProcessingJobs).where(eq(videoProcessingJobs.id, jobId)).limit(1).for("update");
    if (!job) throw new Error("مهمة الفيديو غير موجودة.");
    if (job.status !== "pending" && job.status !== "failed") throw new Error("لا يمكن إلغاء مهمة بدأت معالجتها. استعد المهمة العالقة أولاً.");
    const now = new Date(); const message = "أُلغيَت من لوحة الإدارة.";
    const log = appendProcessingLog(parseProcessingLog(job.processingLog), { stage: "cancelled", at: now.toISOString(), progressPercent: job.progressPercent, details: { action: "cancelled" } });
    await tx.update(videoProcessingJobs).set({ status: "cancelled", stage: "cancelled", stageStartedAt: now, lockToken: null, lockedAt: null, lastError: message, processingLog: JSON.stringify(log), updatedAt: now }).where(eq(videoProcessingJobs.id, job.id));
    if (job.reactionId) await tx.update(reactions).set({ processingStatus: "failed", processingError: message, updatedAt: now }).where(eq(reactions.id, job.reactionId));
    if (job.contributionId) await tx.update(contributions).set({ status: "reviewing", processingStatus: "failed", processingError: message, updatedAt: now }).where(eq(contributions.id, job.contributionId));
    await tx.insert(auditEvents).values({ actorUserId: adminUserId, entityType: jobEntity(job), entityId: job.reactionId ?? job.contributionId ?? 0, action: "video_processing_cancelled", details: JSON.stringify({ jobId: job.id }) });
    const [updated] = await tx.select().from(videoProcessingJobs).where(eq(videoProcessingJobs.id, job.id)).limit(1);
    return updated ? jobDto(updated) : null;
  });
}

export async function recoverStuckVideoJobs(adminUserId?: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const now = new Date(); const cutoff = new Date(now.getTime() - STUCK_JOB_THRESHOLD_MS);
  const stuck = await db.select().from(videoProcessingJobs).where(and(eq(videoProcessingJobs.status, "processing"), lt(videoProcessingJobs.lockedAt, cutoff)));
  for (const job of stuck) {
    const message = "اعتُبرت المهمة عالقة بعد تجاوز خمس دقائق دون تحديث. أعد معالجتها أو ألغها من لوحة الإدارة.";
    const log = appendProcessingLog(parseProcessingLog(job.processingLog), { stage: "stuck", at: now.toISOString(), progressPercent: job.progressPercent, details: { lockedForSeconds: Math.round((now.getTime() - (job.lockedAt?.getTime() ?? now.getTime())) / 1000) } });
    await db.update(videoProcessingJobs).set({ status: "failed", stage: "stuck", stageStartedAt: now, lockToken: null, lockedAt: null, lastError: message, processingLog: JSON.stringify(log), updatedAt: now }).where(eq(videoProcessingJobs.id, job.id));
    if (job.reactionId) await db.update(reactions).set({ processingStatus: "failed", processingError: message, updatedAt: now }).where(eq(reactions.id, job.reactionId));
    if (job.contributionId) await db.update(contributions).set({ status: "reviewing", processingStatus: "failed", processingError: message, updatedAt: now }).where(eq(contributions.id, job.contributionId));
    if (adminUserId) await db.insert(auditEvents).values({ actorUserId: adminUserId, entityType: jobEntity(job), entityId: job.reactionId ?? job.contributionId ?? 0, action: "video_processing_stuck_recovered", details: JSON.stringify({ jobId: job.id }) });
  }
  return stuck.length;
}

export async function getVideoProcessingJobByIdempotencyKey(idempotencyKey: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [job] = await db.select().from(videoProcessingJobs).where(eq(videoProcessingJobs.idempotencyKey, idempotencyKey)).limit(1);
  return job ? jobDto(job) : null;
}

async function existingJob(idempotencyKey: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [job] = await db.select().from(videoProcessingJobs).where(eq(videoProcessingJobs.idempotencyKey, idempotencyKey)).limit(1);
  return job ?? null;
}

export async function enqueueVideoJob(input: { jobType: JobType; reactionId?: number | null; contributionId?: number | null; idempotencyKey?: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  if ((input.jobType === "reaction" && !input.reactionId) || (input.jobType === "contribution" && !input.contributionId)) throw new Error("بيانات مهمة معالجة الفيديو غير مكتملة.");
  const idempotencyKey = input.idempotencyKey || newIdempotencyKey(input.jobType === "reaction" ? "reaction-media" : "contribution-approval");
  const duplicate = await existingJob(idempotencyKey);
  if (duplicate) return jobDto(duplicate);
  await db.insert(videoProcessingJobs).values({ jobType: input.jobType, reactionId: input.reactionId ?? null, contributionId: input.contributionId ?? null, status: "pending", stage: "queued", progressPercent: 0, processingLog: JSON.stringify([{ stage: "queued", at: new Date().toISOString(), progressPercent: 0 }]), idempotencyKey });
  const [created] = await db.select().from(videoProcessingJobs).where(eq(videoProcessingJobs.idempotencyKey, idempotencyKey)).limit(1);
  if (!created) throw new Error("تعذر إنشاء مهمة معالجة الفيديو.");
  if (canRunImmediateWorker()) queueImmediateVideoProcessing();
  return jobDto(created);
}

async function nextPublicId() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [latest] = await db.select({ publicId: reactions.publicId }).from(reactions).orderBy(desc(reactions.id)).limit(1);
  const next = Number(latest?.publicId.replace(/^YR-/, "") ?? 0) + 1;
  return `YR-${String(next).padStart(4, "0")}`;
}

function assertDuration(durationSeconds: number) {
  if (durationSeconds > MAX_REACTION_DURATION_SECONDS) throw new Error(`مدة الفيديو بعد المعالجة (${durationSeconds} ثانية) تتجاوز الحد الأقصى ${MAX_REACTION_DURATION_SECONDS} ثانية.`);
}

async function processReactionJob(reactionId: number, reportStage: StageReporter): Promise<VideoProcessingResult> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [reaction] = await db.select().from(reactions).where(eq(reactions.id, reactionId)).limit(1);
  if (!reaction?.sourceMediaKey || !reaction.sourceMediaMimeType || !reaction.sourceMediaOriginalName) throw new Error("لا يحتوي الرياكشن على فيديو أصلي صالح للمعالجة.");
  await reportStage("source_download", 10);
  const source = await mediaGetBuffer(reaction.sourceMediaKey);
  await reportStage("source_metadata", 18, { originalSizeBytes: source.length });
  const result = await processVideoUpload({ data: source, fileName: reaction.sourceMediaOriginalName, contentType: reaction.sourceMediaMimeType, storagePrefix: `reactions/${reaction.publicId}`, original: { key: reaction.sourceMediaKey, url: reaction.sourceMediaUrl ?? "", storage: reaction.sourceMediaUrl?.startsWith("/api/media-local/") ? "local" : "managed" } }, { onStage: event => reportStage(event.stage, event.progressPercent) });
  assertDuration(result.durationSeconds);
  await reportStage("publishing", 96, { processedSizeBytes: result.processedSizeBytes, sourceDurationSeconds: result.sourceDurationSeconds });
  const now = new Date();
  await db.update(reactions).set({ mediaStatus: "uploaded", mediaKey: result.processed.key, mediaUrl: result.processed.url, mediaMimeType: result.mimeType, mediaOriginalName: "reaction.mp4", mediaSizeBytes: result.processedSizeBytes, mediaUploadedAt: now, thumbnailKey: result.thumbnail.key, thumbnailUrl: result.thumbnail.url, durationSeconds: result.durationSeconds, processingStatus: "ready", processingError: null, updatedAt: now }).where(eq(reactions.id, reaction.id));
  return result;
}

async function processContributionJob(contributionId: number, reportStage: StageReporter): Promise<VideoProcessingResult> {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [contribution] = await db.select().from(contributions).where(eq(contributions.id, contributionId)).limit(1);
  if (!contribution?.originalMediaKey || !contribution.originalMediaMimeType || !contribution.originalMediaOriginalName) throw new Error("لا تحتوي المساهمة على فيديو أصلي صالح للمعالجة.");
  if (!contribution.categoryId || !contribution.quote || !contribution.situation || !contribution.rightsStatus || !contribution.corner || !contribution.sourceName) throw new Error("بيانات مراجعة المساهمة غير مكتملة.");
  await reportStage("source_download", 10);
  const source = await mediaGetBuffer(contribution.originalMediaKey);
  await reportStage("source_metadata", 18, { originalSizeBytes: source.length });
  const publicId = await nextPublicId();
  const result = await processVideoUpload({ data: source, fileName: contribution.originalMediaOriginalName, contentType: contribution.originalMediaMimeType, storagePrefix: `reactions/${publicId}`, original: { key: contribution.originalMediaKey, url: contribution.originalMediaUrl ?? "", storage: contribution.originalMediaUrl?.startsWith("/api/media-local/") ? "local" : "managed" } }, { onStage: event => reportStage(event.stage, event.progressPercent) });
  assertDuration(result.durationSeconds);
  await reportStage("publishing", 96, { processedSizeBytes: result.processedSizeBytes, sourceDurationSeconds: result.sourceDurationSeconds });
  const now = new Date();
  const createdReactionId = await db.transaction(async tx => {
    await tx.insert(reactions).values({ publicId, categoryId: contribution.categoryId!, status: "published", quote: contribution.quote!, situation: contribution.situation!, description: contribution.description, keywords: contribution.keywords, searchOptimizer: contribution.keywords, searchDocument: [contribution.quote, contribution.situation, contribution.description, contribution.keywords].filter(Boolean).join(" "), durationSeconds: result.durationSeconds, corner: contribution.corner!, sourceName: contribution.sourceName!, sourceUrl: contribution.sourceUrl, rightsStatus: contribution.rightsStatus!, mediaStatus: "uploaded", mediaKey: result.processed.key, mediaUrl: result.processed.url, mediaMimeType: result.mimeType, mediaOriginalName: "reaction.mp4", mediaSizeBytes: result.processedSizeBytes, mediaUploadedAt: now, sourceMediaKey: contribution.originalMediaKey, sourceMediaUrl: contribution.originalMediaUrl, sourceMediaMimeType: contribution.originalMediaMimeType, sourceMediaOriginalName: contribution.originalMediaOriginalName, sourceMediaSizeBytes: contribution.originalMediaSizeBytes, thumbnailKey: result.thumbnail.key, thumbnailUrl: result.thumbnail.url, processingStatus: "ready", isTestData: false, publishedAt: now });
    const [reaction] = await tx.select({ id: reactions.id }).from(reactions).where(eq(reactions.publicId, publicId)).limit(1);
    if (!reaction) throw new Error("تعذر إنشاء الرياكشن بعد المعالجة.");
    await tx.update(contributions).set({ status: "approved", processingStatus: "ready", processingError: null, processedMediaKey: result.processed.key, processedMediaUrl: result.processed.url, processedMediaSizeBytes: result.processedSizeBytes, thumbnailKey: result.thumbnail.key, thumbnailUrl: result.thumbnail.url, durationSeconds: result.durationSeconds, publishedReactionId: reaction.id, updatedAt: now }).where(eq(contributions.id, contribution.id));
    return reaction.id;
  });
  await db.insert(userNotifications).values({ userId: contribution.userId, contributionId: contribution.id, type: "contribution_approved", title: "تم اعتماد مساهمتك", body: `تمت معالجة مساهمتك ${contribution.trackingCode ?? ""} ونشرها في مكتبة YemReact.` });
  await db.insert(auditEvents).values([{ actorUserId: contribution.reviewedByUserId, entityType: "reaction", entityId: createdReactionId, action: "published_from_contribution", details: JSON.stringify({ contributionId: contribution.id, publicId }) }, { actorUserId: contribution.reviewedByUserId, entityType: "contribution", entityId: contribution.id, action: "approved", details: JSON.stringify({ reactionId: createdReactionId, publicId }) }]);
  return result;
}

async function claimNextVideoJob() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db.transaction(async tx => {
    const eligibleJobs = canRunImmediateWorker()
      ? and(eq(videoProcessingJobs.status, "pending"), lte(videoProcessingJobs.runAfter, new Date()), sql`${videoProcessingJobs.idempotencyKey} NOT LIKE '%vitest-%'`)
      : and(eq(videoProcessingJobs.status, "pending"), lte(videoProcessingJobs.runAfter, new Date()));
    const [job] = await tx.select().from(videoProcessingJobs).where(eligibleJobs).orderBy(asc(videoProcessingJobs.runAfter), asc(videoProcessingJobs.id)).limit(1).for("update");
    if (!job) return null;
    const now = new Date(); const lockToken = crypto.randomUUID();
    await tx.update(videoProcessingJobs).set({ status: "processing", stage: "source_download", stageStartedAt: now, processingStartedAt: now, progressPercent: 5, attempts: sql`${videoProcessingJobs.attempts} + 1`, lockedAt: now, lockToken, lastError: null, updatedAt: now }).where(eq(videoProcessingJobs.id, job.id));
    return { ...job, attempts: job.attempts + 1, status: "processing" as const, stage: "source_download", stageStartedAt: now, processingStartedAt: now, progressPercent: 5, lockedAt: now, lockToken, updatedAt: now };
  });
}

export async function processNextVideoJob() {
  await recoverStuckVideoJobs();
  const job = await claimNextVideoJob();
  if (!job) return null;
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  let processingLog = appendProcessingLog(parseProcessingLog(job.processingLog), { stage: "source_download", at: new Date().toISOString(), progressPercent: 5 });
  const reportStage: StageReporter = async (stage, progressPercent, details) => {
    const now = new Date(); processingLog = appendProcessingLog(processingLog, { stage, at: now.toISOString(), progressPercent, details });
    const updates = { stage, stageStartedAt: now, progressPercent, processingLog: JSON.stringify(processingLog), updatedAt: now, ...(typeof details?.originalSizeBytes === "number" ? { originalSizeBytes: details.originalSizeBytes } : {}), ...(typeof details?.processedSizeBytes === "number" ? { processedSizeBytes: details.processedSizeBytes } : {}), ...(typeof details?.sourceDurationSeconds === "number" ? { sourceDurationSeconds: details.sourceDurationSeconds } : {}) };
    await db.update(videoProcessingJobs).set(updates).where(and(eq(videoProcessingJobs.id, job.id), eq(videoProcessingJobs.lockToken, job.lockToken)));
  };
  try {
    const result = job.jobType === "reaction" && job.reactionId ? await processReactionJob(job.reactionId, reportStage) : job.jobType === "contribution" && job.contributionId ? await processContributionJob(job.contributionId, reportStage) : null;
    if (!result) throw new Error("مهمة الفيديو لا تشير إلى كيان صالح.");
    const now = new Date(); processingLog = appendProcessingLog(processingLog, { stage: "completed", at: now.toISOString(), progressPercent: 100, details: { originalSizeBytes: result.originalSizeBytes, processedSizeBytes: result.processedSizeBytes, sourceDurationSeconds: result.sourceDurationSeconds } });
    await db.update(videoProcessingJobs).set({ status: "ready", stage: "completed", stageStartedAt: now, progressPercent: 100, originalSizeBytes: result.originalSizeBytes, processedSizeBytes: result.processedSizeBytes, sourceDurationSeconds: result.sourceDurationSeconds, processingLog: JSON.stringify(processingLog), completedAt: now, lockToken: null, lockedAt: null, updatedAt: now }).where(and(eq(videoProcessingJobs.id, job.id), eq(videoProcessingJobs.lockToken, job.lockToken)));
    return { ...jobDto({ ...job, status: "ready", stage: "completed", progressPercent: 100, originalSizeBytes: result.originalSizeBytes, processedSizeBytes: result.processedSizeBytes, sourceDurationSeconds: result.sourceDurationSeconds, processingLog: JSON.stringify(processingLog), completedAt: now, lockToken: null, lockedAt: null, updatedAt: now } as typeof videoProcessingJobs.$inferSelect), processed: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشلت معالجة الفيديو.";
    const shouldRetry = job.attempts < job.maxAttempts; const now = new Date(); const retryAt = new Date(Date.now() + Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, job.attempts - 1)));
    processingLog = appendProcessingLog(processingLog, { stage: "failed", at: now.toISOString(), progressPercent: 0, details: { error: message.slice(0, 220) } });
    await db.update(videoProcessingJobs).set({ status: shouldRetry ? "pending" : "failed", stage: "failed", stageStartedAt: now, progressPercent: 0, runAfter: shouldRetry ? retryAt : now, lockedAt: null, lockToken: null, lastError: message.slice(0, 1800), processingLog: JSON.stringify(processingLog), updatedAt: now }).where(and(eq(videoProcessingJobs.id, job.id), eq(videoProcessingJobs.lockToken, job.lockToken)));
    if (job.reactionId) await db.update(reactions).set({ processingStatus: "failed", processingError: message.slice(0, 1800), updatedAt: now }).where(eq(reactions.id, job.reactionId));
    if (job.contributionId) await db.update(contributions).set({ status: "reviewing", processingStatus: "failed", processingError: message.slice(0, 1800), updatedAt: now }).where(eq(contributions.id, job.contributionId));
    throw error;
  }
}

export async function processQueuedVideoJobs(limit = 1) {
  const completed: Array<Awaited<ReturnType<typeof processNextVideoJob>>> = [];
  for (let index = 0; index < Math.max(1, Math.min(limit, 1)); index += 1) {
    const result = await processNextVideoJob();
    if (!result) break;
    completed.push(result);
  }
  return completed;
}

let immediateVideoWorker: Promise<void> | null = null;
export function queueImmediateVideoProcessing() {
  if (immediateVideoWorker) return;
  immediateVideoWorker = (async () => { while (await processNextVideoJob()) { /* single global worker drains pending work */ } })().catch(error => console.error("[VideoQueue] Immediate processing failed", error)).finally(() => { immediateVideoWorker = null; });
}
