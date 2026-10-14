import { asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { auditEvents, categories, users } from "../drizzle/schema";
import { getDb, getUserByOpenId, upsertUser } from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { listCategories, listPublicReactions } from "./yemreact";

function createContext(user: NonNullable<TrpcContext["user"]>): TrpcContext {
  return { user, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] };
}

describe("أسماء التصنيفات الإدارية", () => {
  let original: { id: string; name: string; color: string; sortOrder: number } | null = null;
  let actorUserId: number | null = null;

  afterAll(async () => {
    if (!original) return;
    const db = await getDb();
    if (db) {
      await db.update(categories).set({ name: original.name }).where(eq(categories.id, original.id));
      if (actorUserId) {
        await db.delete(auditEvents).where(eq(auditEvents.actorUserId, actorUserId));
        await db.delete(users).where(eq(users.id, actorUserId));
      }
    }
  });

  it("يحدث الاسم الظاهر فقط ويبقي المعرّف واللون والترتيب ثابتة", async () => {
    await listCategories();
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة للاختبار.");
    const openId = `category-name-test-${Date.now()}`;
    await upsertUser({ openId, name: "مسؤول اختبار التصنيفات", email: `${openId}@example.test`, role: "admin" });
    const actor = await getUserByOpenId(openId);
    if (!actor) throw new Error("تعذر إنشاء مستخدم اختبار لسجل التدقيق.");
    actorUserId = actor.id;
    const [category] = await db.select().from(categories).orderBy(asc(categories.sortOrder)).limit(1);
    if (!category) throw new Error("التصنيفات غير متاحة للاختبار.");
    original = { id: category.id, name: category.name, color: category.color, sortOrder: category.sortOrder };

    const baseUser = { ...actor, role: "user" as const };
    await expect(appRouter.createCaller(createContext(baseUser)).admin.saveCategoryNames({ categories: [{ id: category.id, name: "اسم اختبار مؤقت" }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(createContext({ ...actor, role: "admin" })).admin.saveCategoryNames({ categories: [{ id: category.id, name: "اسم اختبار مؤقت" }] })).resolves.toEqual({ success: true });
    const [updated] = await db.select().from(categories).where(eq(categories.id, category.id)).limit(1);
    expect(updated).toMatchObject({ id: original.id, name: "اسم اختبار مؤقت", color: original.color, sortOrder: original.sortOrder });
    expect((await listCategories()).find(item => item.id === category.id)?.name).toBe("اسم اختبار مؤقت");
    const publicResults = await listPublicReactions({ query: "", categoryId: category.id });
    expect(publicResults.reactions.every(item => item.categoryName === "اسم اختبار مؤقت")).toBe(true);
  });
});
