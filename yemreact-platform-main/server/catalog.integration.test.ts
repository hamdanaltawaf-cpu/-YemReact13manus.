import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { collectionItems, failedSearchQueries, reactions, searchEvents } from "../drizzle/schema";
import { getDb } from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { normalizeArabic } from "./yemreact";

function createContext(role: "user" | "admin"): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 99902 : 99901,
      openId: `test-${role}`,
      name: `Test ${role}`,
      email: `test-${role}@example.test`,
      loginMethod: "test",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("catalog procedures", () => {
  const publicCaller = appRouter.createCaller(createContext("user"));
  const adminCaller = appRouter.createCaller(createContext("admin"));
  const failedQuery = `استعلام اختبار فاشل ${Date.now()}`;
  const successfulQuery = `استعلام نجاح ${Date.now()}`;
  let createdReactionId: number | null = null;

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    if (createdReactionId) {
      await db.delete(collectionItems).where(eq(collectionItems.reactionId, createdReactionId));
      await db.delete(reactions).where(eq(reactions.id, createdReactionId));
    }
    await db.delete(failedSearchQueries).where(eq(failedSearchQueries.normalizedQuery, normalizeArabic(failedQuery)));
    await db.delete(searchEvents).where(eq(searchEvents.normalizedQuery, normalizeArabic(successfulQuery)));
  });

  it("يعيد الفئات والرفوف والبحث العربي المطبع وتفاصيل الرياكشن", async () => {
    const categories = await publicCaller.catalog.categories();
    expect(categories).toHaveLength(9);

    const matches = await publicCaller.catalog.list({ query: "آيش هذا؟" });
    expect(matches.reactions.some(item => item.publicId === "YR-0011")).toBe(true);

    const synonymMatches = await publicCaller.catalog.list({ query: "يسولف كثير" });
    expect(synonymMatches.reactions.some(item => item.publicId === "YR-0003")).toBe(true);

    const typoMatches = await publicCaller.catalog.list({ query: "مفاجاه" });
    expect(typoMatches.reactions.some(item => item.publicId === "YR-0001")).toBe(true);

    const detail = await publicCaller.catalog.detail({ publicId: "YR-0001" });
    expect(detail?.reaction.publicId).toBe("YR-0001");
    expect(detail?.nearby.length).toBeGreaterThan(0);

    const collections = await publicCaller.catalog.collections();
    expect(collections.length).toBeGreaterThanOrEqual(2);
  }, 10_000);

  it("يسجل البحث الذي لا يرجع نتائج", async () => {
    const result = await publicCaller.catalog.list({ query: failedQuery });
    expect(result.reactions).toHaveLength(0);

    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة للاختبار.");
    const [record] = await db
      .select()
      .from(failedSearchQueries)
      .where(eq(failedSearchQueries.normalizedQuery, normalizeArabic(failedQuery)))
      .limit(1);
    expect(record?.originalQuery).toBe(failedQuery);
    expect(record?.occurrences).toBeGreaterThanOrEqual(1);
  });

  it("يسجل عرضًا ونقرة وحفظًا ويجمع تحليلات البحث بحسب الاستعلام", async () => {
    await expect(publicCaller.catalog.recordSearchEvent({ query: successfulQuery, eventType: "result_view", resultCount: 3 })).resolves.toEqual({ recorded: true });
    await expect(publicCaller.catalog.recordSearchEvent({ query: successfulQuery, publicId: "YR-0001", eventType: "result_click" })).resolves.toEqual({ recorded: true });
    await expect(publicCaller.catalog.recordSearchEvent({ query: successfulQuery, publicId: "YR-0001", eventType: "save" })).resolves.toEqual({ recorded: true });
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة للاختبار.");
    const events = await db
      .select()
      .from(searchEvents)
      .where(eq(searchEvents.normalizedQuery, normalizeArabic(successfulQuery)));
    expect(events.map(event => event.eventType)).toEqual(expect.arrayContaining(["result_view", "result_click", "save"]));
    const analytics = await adminCaller.admin.searchAnalytics();
    expect(analytics.topQueries.find(item => item.query === normalizeArabic(successfulQuery))).toMatchObject({ searches: 1, clicks: 1, saves: 1, averageResults: 3, clickThroughRate: 100, noAction: false });
    expect(analytics).toMatchObject({ period: "7d", totals: { searches: expect.any(Number), clicks: expect.any(Number), saves: expect.any(Number) } });
    expect(analytics.timeline).toHaveLength(7);
    const todayAnalytics = await adminCaller.admin.searchAnalytics({ period: "today" });
    expect(todayAnalytics).toMatchObject({ period: "today" });
    expect(todayAnalytics.timeline).toHaveLength(1);
  });

  it("يرفض إجراءات الإدارة ورفع الوسائط لغير المسؤول", async () => {
    await expect(publicCaller.admin.reactions()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      publicCaller.admin.uploadMedia({
        reactionId: 1,
        fileName: "blocked.mp4",
        contentType: "video/mp4",
        dataBase64: "AAAAFGZ0eXBpc29tAAAA",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يرفض من المسؤول أي صيغة وسائط غير مسموح بها قبل التخزين", async () => {
    await expect(
      adminCaller.admin.uploadMedia({
        reactionId: 1,
        fileName: "not-a-video.txt",
        contentType: "text/plain",
        dataBase64: "dGVzdC1ub3QtYS12aWRlby1maWxl",
      }),
    ).rejects.toThrow("الصيغ المقبولة");
  });

  it("يفرض رفع الوسيط والحقوق قبل النشر ثم يسمح بالأرشفة", async () => {
    const created = await adminCaller.admin.createReaction({
      categoryId: "shock",
      status: "draft",
      quote: "اختبار إدارة",
      situation: "لما نتحقق من صلاحيات المسؤول",
      description: "سجل اختبار آلي يُحذف بعد الانتهاء.",
      keywords: "اختبار إدارة صلاحيات",
      searchOptimizer: "محسن بحث اختبار إدارة كلمات مرادفة",
      durationSeconds: 3,
      corner: "tr",
      sourceName: "اختبار Vitest",
      sourceUrl: null,
      rightsStatus: "original",
      isTestData: true,
    });
    createdReactionId = created.id;
    expect(created.status).toBe("draft");
    const availableCollections = await publicCaller.catalog.collections();
    expect(availableCollections.length).toBeGreaterThan(0);
    await adminCaller.admin.setReactionCollections({ reactionId: created.id, collectionIds: [availableCollections[0]!.id] });
    const adminItems = await adminCaller.admin.reactions();
    expect(adminItems.find(item => item.id === created.id)?.collectionIds).toEqual([availableCollections[0]!.id]);

    await expect(
      adminCaller.admin.updateReaction({
        id: created.id,
        data: {
          categoryId: "shock",
          status: "published",
          quote: "اختبار إدارة محدّث",
          situation: "لما نتحقق من تحديث المحتوى",
          description: "سجل اختبار آلي يُحذف بعد الانتهاء.",
          keywords: "اختبار تحديث إدارة",
          searchOptimizer: "محسن تحديث إدارة",
          durationSeconds: 4,
          corner: "tl",
          sourceName: "اختبار Vitest",
          sourceUrl: null,
          rightsStatus: "original",
          isTestData: true,
        },
      }),
    ).rejects.toThrow("لا يمكن النشر قبل رفع ملف فيديو");

    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة للاختبار.");
    await db
      .update(reactions)
      .set({
        mediaStatus: "uploaded",
        mediaKey: "tests/sample.mp4",
        mediaUrl: "/manus-storage/tests/sample.mp4",
        mediaMimeType: "video/mp4",
        mediaOriginalName: "sample.mp4",
        mediaSizeBytes: 16,
        mediaUploadedAt: new Date(),
      })
      .where(eq(reactions.id, created.id));

    const updated = await adminCaller.admin.updateReaction({
      id: created.id,
      data: {
        categoryId: "shock",
        status: "published",
        quote: "اختبار إدارة محدّث",
        situation: "لما نتحقق من تحديث المحتوى",
        description: "سجل اختبار آلي يُحذف بعد الانتهاء.",
        keywords: "اختبار تحديث إدارة",
        searchOptimizer: "محسن تحديث إدارة",
        durationSeconds: 4,
        corner: "tl",
        sourceName: "اختبار Vitest",
        sourceUrl: null,
        rightsStatus: "original",
        isTestData: true,
      },
    });
    expect(updated.status).toBe("published");
    expect(updated.corner).toBe("tl");

    await publicCaller.catalog.recordEngagement({ publicId: created.publicId, kind: "view" });
    await publicCaller.catalog.recordEngagement({ publicId: created.publicId, kind: "download" });
    const trackedItem = (await adminCaller.admin.reactions()).find(item => item.id === created.id);
    expect(trackedItem?.viewCount).toBeGreaterThanOrEqual(1);
    expect(trackedItem?.downloadCount).toBeGreaterThanOrEqual(1);

    const publicDetail = await publicCaller.catalog.detail({ publicId: created.publicId });
    expect(publicDetail?.reaction.mediaUrl).toBe("/manus-storage/tests/sample.mp4");

    await expect(adminCaller.admin.archiveReaction({ id: created.id })).resolves.toEqual({ success: true });
    const [archived] = await db.select().from(reactions).where(and(eq(reactions.id, created.id), eq(reactions.status, "archived"))).limit(1);
    expect(archived?.id).toBe(created.id);
  });
});
