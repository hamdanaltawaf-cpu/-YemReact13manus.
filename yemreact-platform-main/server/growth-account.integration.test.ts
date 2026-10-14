import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { reactionSaves, users } from "../drizzle/schema";
import { createSaveFolder, listRecentReactionViews, listSaveFolders, recordRecentReactionView, saveReactionToFolder } from "./account";
import { getDb } from "./db";
import { getGrowthFunnel, recordReactionShare } from "./yemreact";

describe("الحساب وقمع النمو", () => {
  let userId = 0;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة للاختبار.");
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    await db.insert(users).values({ openId: `growth-user-${suffix}`, googleSub: `growth-user-${suffix}`, name: "مستخدم نمو", email: `growth-${suffix}@example.test`, emailVerified: true, loginMethod: "test", role: "user" });
    const [user] = await db.select().from(users).where(eq(users.openId, `growth-user-${suffix}`)).limit(1);
    userId = user?.id ?? 0;
  });

  afterAll(async () => {
    const db = await getDb();
    if (db && userId) {
      await db.delete(reactionSaves).where(eq(reactionSaves.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
    }
  });

  it("ينشئ المجلدات الافتراضية ويضيف رياكشناً لمجلد مخصص ويسجل المشاهدة الحديثة", async () => {
    const defaults = await listSaveFolders(userId);
    expect(defaults.map(folder => folder.name)).toEqual(expect.arrayContaining(["مفضلة", "مقاطع مضحكة", "ردود قروبات"]));
    const custom = await createSaveFolder(userId, "ردود الفريق");
    await saveReactionToFolder(userId, "YR-0001", custom.id);
    const folders = await listSaveFolders(userId);
    expect(folders.find(folder => folder.id === custom.id)?.items.map(item => item.publicId)).toContain("YR-0001");
    await recordRecentReactionView(userId, "YR-0001");
    expect((await listRecentReactionViews(userId)).map(item => item.publicId)).toContain("YR-0001");
  });

  it("يسجل مصدر المشاركة ويظهره في قمع النمو", async () => {
    const before = await getGrowthFunnel("30d");
    await expect(recordReactionShare("YR-0001", "copy", `growth-test-${Date.now()}`)).resolves.toMatchObject({ success: true, recorded: true });
    const after = await getGrowthFunnel("30d");
    expect(after.funnel.shares).toBeGreaterThanOrEqual(before.funnel.shares + 1);
    expect(after.shareSources.find(item => item.source === "copy")?.count ?? 0).toBeGreaterThan(0);
  });
});
