import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { auditEvents, categories, collections, homePageSettings, reactions } from "../drizzle/schema";
import { getDb } from "./db";

export const homePageSettingsInput = z.object({
  weeklyReactionId: z.number().int().positive().nullable(),
  newLibraryLimit: z.number().int().min(4).max(30),
});

export const collectionWriteInput = z.object({
  id: z.number().int().positive().optional(),
  slug: z.string().trim().min(3).max(96).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(["draft", "published"]),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const categoryNamesInput = z.object({
  categories: z.array(z.object({ id: z.string().trim().min(1).max(32), name: z.string().trim().min(2).max(64) })).min(1).max(32),
});

export async function getHomePageAdminData() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [settings] = await db.select().from(homePageSettings).where(eq(homePageSettings.id, 1)).limit(1);
  const [allCollections, publishedReactions, allCategories] = await Promise.all([
    db.select().from(collections).orderBy(asc(collections.sortOrder), desc(collections.updatedAt)),
    db.select({ id: reactions.id, publicId: reactions.publicId, quote: reactions.quote, situation: reactions.situation }).from(reactions).where(eq(reactions.status, "published")).orderBy(desc(reactions.publishedAt)).limit(60),
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
  ]);
  return { settings: settings ?? { weeklyReactionId: null, newLibraryLimit: 12 }, collections: allCollections, reactions: publishedReactions, categories: allCategories };
}

export async function getPublicHomePageData() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [settings] = await db.select().from(homePageSettings).where(eq(homePageSettings.id, 1)).limit(1);
  const publishedCollections = await db.select().from(collections).where(eq(collections.status, "published")).orderBy(asc(collections.sortOrder));
  let weekly: { id: number; publicId: string; categoryId: string; categoryName: string; categoryColor: string; quote: string; situation: string; durationSeconds: number; corner: "tr" | "tl"; isTestData: boolean } | null = null;
  if (settings?.weeklyReactionId) {
    const [row] = await db.select({ reaction: reactions, category: categories }).from(reactions).innerJoin(categories, eq(reactions.categoryId, categories.id)).where(eq(reactions.id, settings.weeklyReactionId)).limit(1);
    if (row?.reaction.status === "published") weekly = { id: row.reaction.id, publicId: row.reaction.publicId, categoryId: row.reaction.categoryId, categoryName: row.category.name, categoryColor: row.category.color, quote: row.reaction.quote, situation: row.reaction.situation, durationSeconds: row.reaction.durationSeconds, corner: row.reaction.corner, isTestData: row.reaction.isTestData };
  }
  return { newLibraryLimit: settings?.newLibraryLimit ?? 12, weekly, collections: publishedCollections };
}

export async function saveHomePageSettings(adminUserId: number, input: z.infer<typeof homePageSettingsInput>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  if (input.weeklyReactionId) {
    const [reaction] = await db.select().from(reactions).where(eq(reactions.id, input.weeklyReactionId)).limit(1);
    if (!reaction || reaction.status !== "published") throw new Error("اختر رياكشناً منشوراً لمختار الأسبوع.");
  }
  await db.transaction(async tx => {
    await tx.insert(homePageSettings).values({ id: 1, weeklyReactionId: input.weeklyReactionId, newLibraryLimit: input.newLibraryLimit, updatedByUserId: adminUserId }).onDuplicateKeyUpdate({ set: { weeklyReactionId: input.weeklyReactionId, newLibraryLimit: input.newLibraryLimit, updatedByUserId: adminUserId, updatedAt: new Date() } });
    await tx.insert(auditEvents).values({ actorUserId: adminUserId, entityType: "homepage", entityId: 1, action: "settings_updated", details: JSON.stringify(input) });
  });
  return { success: true } as const;
}

export async function saveCollection(adminUserId: number, input: z.infer<typeof collectionWriteInput>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const values = { slug: input.slug, title: input.title, description: input.description || null, status: input.status, sortOrder: input.sortOrder, isTestData: false };
  return db.transaction(async tx => {
    if (input.id) {
      await tx.update(collections).set({ ...values, updatedAt: new Date() }).where(eq(collections.id, input.id));
      await tx.insert(auditEvents).values({ actorUserId: adminUserId, entityType: "homepage", entityId: input.id, action: "collection_updated", details: JSON.stringify(values) });
      return { id: input.id, updated: true };
    }
    await tx.insert(collections).values(values);
    const [created] = await tx.select().from(collections).where(eq(collections.slug, input.slug)).limit(1);
    if (!created) throw new Error("تعذر حفظ المجموعة.");
    await tx.insert(auditEvents).values({ actorUserId: adminUserId, entityType: "homepage", entityId: created.id, action: "collection_created", details: JSON.stringify(values) });
    return { id: created.id, updated: false };
  });
}

export async function saveCategoryNames(adminUserId: number, input: z.infer<typeof categoryNamesInput>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const uniqueIds = new Set(input.categories.map(category => category.id));
  if (uniqueIds.size !== input.categories.length) throw new Error("لا يمكن تكرار التصنيف في طلب الحفظ.");
  const existing = await db.select({ id: categories.id }).from(categories);
  const existingIds = new Set(existing.map(category => category.id));
  if (input.categories.some(category => !existingIds.has(category.id))) throw new Error("إحدى التصنيفات غير معروفة.");
  await db.transaction(async tx => {
    for (const category of input.categories) {
      await tx.update(categories).set({ name: category.name }).where(eq(categories.id, category.id));
    }
    await tx.insert(auditEvents).values({ actorUserId: adminUserId, entityType: "homepage", entityId: 1, action: "category_names_updated", details: JSON.stringify(input.categories) });
  });
  return { success: true } as const;
}
