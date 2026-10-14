import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { auditEvents, collectionItems, reactions, users } from "../drizzle/schema";
import { importContentBatch, previewContentBatch } from "./contentImport";
import { getDb } from "./db";
import { listCategories } from "./yemreact";

describe("استيراد المحتوى الدفعي", () => {
  let adminId = 0;
  let importedIds: number[] = [];

  beforeAll(async () => {
    await listCategories();
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة للاختبار.");
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    await db.insert(users).values({ openId: `batch-admin-${suffix}`, googleSub: `batch-admin-${suffix}`, name: "مسؤول الاستيراد", email: `batch-${suffix}@example.test`, emailVerified: true, loginMethod: "test", role: "admin" });
    const [admin] = await db.select().from(users).where(eq(users.openId, `batch-admin-${suffix}`)).limit(1);
    adminId = admin?.id ?? 0;
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    if (importedIds.length) {
      await db.delete(collectionItems).where(inArray(collectionItems.reactionId, importedIds));
      await db.delete(auditEvents).where(and(eq(auditEvents.actorUserId, adminId), eq(auditEvents.action, "content_batch_imported")));
      await db.delete(reactions).where(inArray(reactions.id, importedIds));
    }
    if (adminId) await db.delete(users).where(eq(users.id, adminId));
  });

  it("يعاين CSV ثم يستورد رياكشناً ويربطه بفيديو موجود ومجموعة تحريرية", async () => {
    const content = [
      "caption,description,keywords,category,collections,source,videoKey,durationSeconds,status,rightsStatus",
      "استيراد تجريبي,وصف رياكشن مستورد,اختبار استيراد,hype,group-replies,اختبار Vitest,reactions/imported/existing.mp4,4,draft,original",
    ].join("\n");
    const preview = await previewContentBatch({ format: "csv", content });
    expect(preview).toMatchObject({ total: 1, validCount: 1, errorCount: 0 });
    expect(preview.rows[0]).toMatchObject({ hasMedia: true, category: "hype" });

    const imported = await importContentBatch({ format: "csv", content }, adminId);
    expect(imported).toMatchObject({ imported: 1 });
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة للاختبار.");
    const [reaction] = await db.select().from(reactions).where(eq(reactions.publicId, imported.publicIds[0]!)).limit(1);
    expect(reaction).toMatchObject({ quote: "استيراد تجريبي", mediaKey: "reactions/imported/existing.mp4", mediaStatus: "uploaded", processingStatus: "ready", isTestData: false });
    if (reaction) importedIds.push(reaction.id);
  });

  it("يمنع التنفيذ عندما تكشف المعاينة صفًا بلا فئة أو مدة صالحة", async () => {
    const preview = await previewContentBatch({ format: "json", content: JSON.stringify([{ caption: "صف خاطئ", category: "غير موجود" }]) });
    expect(preview).toMatchObject({ total: 1, validCount: 0, errorCount: 1 });
    await expect(importContentBatch({ format: "json", content: JSON.stringify([{ caption: "صف خاطئ", category: "غير موجود" }]) }, adminId)).rejects.toThrow("أصلح");
  });
});
