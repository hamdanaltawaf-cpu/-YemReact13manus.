import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ storeOriginalVideo: vi.fn(), processVideoUpload: vi.fn(), mediaGetBuffer: vi.fn() }));

vi.mock("./videoProcessing", async importOriginal => {
  const actual = await importOriginal<typeof import("./videoProcessing")>();
  return { ...actual, storeOriginalVideo: mocks.storeOriginalVideo, processVideoUpload: mocks.processVideoUpload };
});
vi.mock("./mediaStorage", () => ({ mediaGetBuffer: mocks.mediaGetBuffer }));

import { auditEvents, contributions, reactions, userNotifications, users, videoProcessingJobs } from "../drizzle/schema";
import { getDb } from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const tinyVideoBase64 = "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDE=";
let userId = 0;
let adminId = 0;
const contributionIds: number[] = [];
const reactionIds: number[] = [];

function context(id: number, role: "user" | "admin"): TrpcContext {
  return {
    user: { id, openId: `workflow-${role}-${id}`, name: role === "admin" ? "مسؤول الاختبار" : "مستخدم الاختبار", email: `${role}-${id}@example.test`, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

beforeEach(async () => {
  mocks.storeOriginalVideo.mockReset();
  mocks.processVideoUpload.mockReset();
  mocks.mediaGetBuffer.mockReset();
  mocks.storeOriginalVideo.mockResolvedValue({ stored: { key: "contributions/test/original.mp4", url: "/manus-storage/contributions/test/original.mp4", storage: "managed" }, mimeType: "video/mp4", safeName: "original.mp4" });
  mocks.mediaGetBuffer.mockResolvedValue(Buffer.from("video"));
  mocks.processVideoUpload.mockResolvedValue({
    original: { key: "contributions/test/original.mp4", url: "/manus-storage/contributions/test/original.mp4", storage: "managed" },
    processed: { key: "reactions/test/processed.mp4", url: "/manus-storage/reactions/test/processed.mp4", storage: "managed" },
    thumbnail: { key: "reactions/test/thumb.jpg", url: "/manus-storage/reactions/test/thumb.jpg", storage: "managed" },
    durationSeconds: 3, sourceDurationSeconds: 3, width: 1280, height: 720, videoCodec: "h264", audioCodec: "aac", originalSizeBytes: 6123, processedSizeBytes: 4321, mimeType: "video/mp4",
  });

  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة للاختبار.");
  const suffix = `${Date.now()}${Math.floor(Math.random() * 9999)}`;
  await db.insert(users).values([
    { openId: `workflow-user-${suffix}`, googleSub: `workflow-user-${suffix}`, name: "مستخدم الاختبار", email: `workflow-user-${suffix}@example.test`, emailVerified: true, loginMethod: "test", role: "user" },
    { openId: `workflow-admin-${suffix}`, googleSub: `workflow-admin-${suffix}`, name: "مسؤول الاختبار", email: `workflow-admin-${suffix}@example.test`, emailVerified: true, loginMethod: "test", role: "admin" },
  ]);
  const inserted = await db.select().from(users).where(inArray(users.openId, [`workflow-user-${suffix}`, `workflow-admin-${suffix}`]));
  userId = inserted.find(user => user.role === "user")?.id ?? 0;
  adminId = inserted.find(user => user.role === "admin")?.id ?? 0;
  await appRouter.createCaller(context(userId, "user")).catalog.categories();
});

afterAll(async () => {
  const db = await getDb();
  if (!db) return;
  if (contributionIds.length) {
    await db.delete(userNotifications).where(inArray(userNotifications.contributionId, contributionIds));
    await db.delete(auditEvents).where(and(eq(auditEvents.entityType, "contribution"), inArray(auditEvents.entityId, contributionIds)));
    await db.delete(contributions).where(inArray(contributions.id, contributionIds));
  }
  if (reactionIds.length) {
    await db.delete(auditEvents).where(and(eq(auditEvents.entityType, "reaction"), inArray(auditEvents.entityId, reactionIds)));
    await db.delete(reactions).where(inArray(reactions.id, reactionIds));
  }
  if (userId || adminId) await db.delete(users).where(inArray(users.id, [userId, adminId].filter(Boolean)));
});

describe("سير مساهمات المستخدم والمراجعة", () => {
  it("ينشئ مساهمة Pending ثم يجدولها ويُنشر الرياكشن فقط بعد تشغيل العامل ويُبلغ صاحبه", async () => {
    const userCaller = appRouter.createCaller(context(userId, "user"));
    const adminCaller = appRouter.createCaller(context(adminId, "admin"));
    const submitted = await userCaller.account.submitContribution({ fileName: "مساهمة.mp4", contentType: "video/mp4", dataBase64: tinyVideoBase64, note: "موقف تجريبي" });
    contributionIds.push(submitted.id);
    expect(submitted.status).toBe("pending");
    expect(submitted.trackingCode).toMatch(/^YRC-/);

    const pending = await adminCaller.admin.contributions({ status: "pending" });
    expect(pending.some(item => item.id === submitted.id)).toBe(true);

    const approved = await adminCaller.admin.approveContribution({ contributionId: submitted.id, quote: "قوية!", situation: "لما ينجح اختبار الرفع", description: null, keywords: "اختبار مساهمة", categoryId: "hype", corner: "tr", sourceName: "مالك المساهمة", sourceUrl: "", rightsStatus: "original", idempotencyKey: `vitest-approval-${crypto.randomUUID()}` });
    expect(approved).toMatchObject({ job: { contributionId: submitted.id, jobType: "contribution", status: "pending" }, reused: false });
    const monitoredJobs = await adminCaller.admin.videoJobs();
    const queuedJob = monitoredJobs.find(job => job.contributionId === submitted.id);
    expect(queuedJob).toMatchObject({ status: "pending", contributionTrackingCode: submitted.trackingCode });
    if (!queuedJob) throw new Error("لم تُنشأ مهمة الفيديو للاختبار.");

    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة للاختبار.");
    await db.update(videoProcessingJobs).set({ status: "failed", attempts: 2, lastError: "فشل تجريبي", completedAt: new Date() }).where(eq(videoProcessingJobs.id, queuedJob.id));
    await db.update(contributions).set({ processingStatus: "failed", processingError: "فشل تجريبي" }).where(eq(contributions.id, submitted.id));
    await expect(adminCaller.admin.retryVideoJob({ jobId: queuedJob.id })).resolves.toMatchObject({ id: queuedJob.id, status: "pending", attempts: 0, lastError: null });
    // اجعل المهمة مستحقة بوضوح؛ بعض قواعد الاختبار تخزن runAfter بدقة ثانية بينما
    // يستدعي العامل الساعة الحالية مباشرة بعد إعادة المحاولة.
    await db.update(videoProcessingJobs).set({ runAfter: new Date(Date.now() - 1_000) }).where(eq(videoProcessingJobs.id, queuedJob.id));
    const queued = await userCaller.account.contributions();
    expect(queued.find(item => item.id === submitted.id)).toMatchObject({ status: "processing", processingStatus: "pending" });
    await expect(adminCaller.admin.processNextVideoJob()).resolves.toMatchObject({ processed: true, contributionId: submitted.id, status: "ready" });
    expect(mocks.processVideoUpload).toHaveBeenCalledOnce();

    const own = await userCaller.account.contributions();
    const completed = own.find(item => item.id === submitted.id);
    expect(completed).toMatchObject({ status: "approved", processingStatus: "ready", processedMediaUrl: "/manus-storage/reactions/test/processed.mp4" });
    if (completed?.publishedReactionId) reactionIds.push(completed.publishedReactionId);
    const alerts = await userCaller.account.unreadNotifications();
    expect(alerts.some(item => item.type === "contribution_approved")).toBe(true);
  });

  it("يفرض سبب الرفض ويحفظه كحالة مرئية لصاحب المساهمة", async () => {
    const userCaller = appRouter.createCaller(context(userId, "user"));
    const adminCaller = appRouter.createCaller(context(adminId, "admin"));
    const submitted = await userCaller.account.submitContribution({ fileName: "رفض.mp4", contentType: "video/mp4", dataBase64: tinyVideoBase64, note: null });
    contributionIds.push(submitted.id);
    await expect(adminCaller.admin.rejectContribution({ contributionId: submitted.id, reason: "" })).rejects.toThrow();
    const idempotencyKey = `reject-${crypto.randomUUID()}`;
    await expect(adminCaller.admin.rejectContribution({ contributionId: submitted.id, reason: "الصوت غير واضح في المقطع.", idempotencyKey })).resolves.toMatchObject({ success: true, reused: false });
    await expect(adminCaller.admin.rejectContribution({ contributionId: submitted.id, reason: "الصوت غير واضح في المقطع.", idempotencyKey })).resolves.toMatchObject({ success: true, reused: true });
    const own = await userCaller.account.contributions();
    expect(own.find(item => item.id === submitted.id)).toMatchObject({ status: "rejected", rejectionReason: "الصوت غير واضح في المقطع." });
    const alerts = await userCaller.account.unreadNotifications();
    expect(alerts.some(item => item.type === "contribution_rejected")).toBe(true);
  });

  it("يكتشف المهمة العالقة ويتيح إلغاءها أو إعادتها للطابور", async () => {
    const userCaller = appRouter.createCaller(context(userId, "user"));
    const adminCaller = appRouter.createCaller(context(adminId, "admin"));
    const submitted = await userCaller.account.submitContribution({ fileName: "عالقة.mp4", contentType: "video/mp4", dataBase64: tinyVideoBase64, note: null });
    contributionIds.push(submitted.id);
    await adminCaller.admin.approveContribution({ contributionId: submitted.id, quote: "مهمة عالقة", situation: "اختبار الاستعادة", description: null, keywords: "اختبار", categoryId: "hype", corner: "tr", sourceName: "مالك المساهمة", sourceUrl: "", rightsStatus: "original", idempotencyKey: `vitest-stuck-${crypto.randomUUID()}` });
    const job = (await adminCaller.admin.videoJobs()).find(item => item.contributionId === submitted.id);
    if (!job) throw new Error("لم تُنشأ المهمة العالقة للاختبار.");
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة للاختبار.");
    await db.update(videoProcessingJobs).set({ status: "processing", lockedAt: new Date(Date.now() - 6 * 60_000), lockToken: "stuck-test-token", processingStartedAt: new Date(Date.now() - 6 * 60_000), stage: "transcoding", progressPercent: 42 }).where(eq(videoProcessingJobs.id, job.id));
    await expect(adminCaller.admin.recoverStuckVideoJobs()).resolves.toBeGreaterThanOrEqual(1);
    const recovered = (await adminCaller.admin.videoJobs()).find(item => item.id === job.id);
    expect(recovered).toMatchObject({ status: "failed", stage: "stuck" });
    await expect(adminCaller.admin.cancelVideoJob({ jobId: job.id })).resolves.toMatchObject({ status: "cancelled" });
    await expect(adminCaller.admin.retryVideoJob({ jobId: job.id })).resolves.toMatchObject({ status: "pending", attempts: 0 });
  });
});
