import { and, desc, eq, inArray } from "drizzle-orm";
import { reactionSaves, reactions, categories, contributions, recentlyViewedReactions, saveFolderItems, saveFolders } from "../drizzle/schema";
import { getDb } from "./db";

const DEFAULT_SAVE_FOLDERS = ["مفضلة", "مقاطع مضحكة", "ردود قروبات"];

async function ensureDefaultSaveFolders(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  for (const name of DEFAULT_SAVE_FOLDERS) {
    await db.insert(saveFolders).values({ userId, name, isDefault: true }).onDuplicateKeyUpdate({ set: { isDefault: true } });
  }
}

export async function listSavedReactions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const rows = await db
    .select({ save: reactionSaves, reaction: reactions, category: categories })
    .from(reactionSaves)
    .innerJoin(reactions, eq(reactionSaves.reactionId, reactions.id))
    .innerJoin(categories, eq(reactions.categoryId, categories.id))
    .where(and(eq(reactionSaves.userId, userId), eq(reactions.status, "published")))
    .orderBy(desc(reactionSaves.createdAt));
  return rows.map(({ save, reaction, category }) => ({
    savedAt: save.createdAt,
    publicId: reaction.publicId,
    quote: reaction.quote,
    situation: reaction.situation,
    categoryName: category.name,
    categoryColor: category.color,
    durationSeconds: reaction.durationSeconds,
    corner: reaction.corner,
    isTestData: reaction.isTestData,
  }));
}

export async function toggleReactionSave(userId: number, publicId: string, folderId?: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [reaction] = await db.select().from(reactions).where(and(eq(reactions.publicId, publicId), eq(reactions.status, "published"))).limit(1);
  if (!reaction) throw new Error("الرياكشن غير متاح للحفظ.");
  const [existing] = await db.select().from(reactionSaves).where(and(eq(reactionSaves.userId, userId), eq(reactionSaves.reactionId, reaction.id))).limit(1);
  if (existing && !folderId) {
    const folders = await db.select({ id: saveFolders.id }).from(saveFolders).where(eq(saveFolders.userId, userId));
    await db.transaction(async tx => {
      await tx.delete(reactionSaves).where(eq(reactionSaves.id, existing.id));
      if (folders.length) await tx.delete(saveFolderItems).where(and(eq(saveFolderItems.reactionId, reaction.id), inArray(saveFolderItems.folderId, folders.map(folder => folder.id))));
    });
    return { saved: false } as const;
  }
  if (!existing) await db.insert(reactionSaves).values({ userId, reactionId: reaction.id });
  if (folderId) await addReactionToSaveFolder(userId, reaction.id, folderId);
  return { saved: true } as const;
}

async function addReactionToSaveFolder(userId: number, reactionId: number, folderId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [folder] = await db.select({ id: saveFolders.id }).from(saveFolders).where(and(eq(saveFolders.id, folderId), eq(saveFolders.userId, userId))).limit(1);
  if (!folder) throw new Error("مجلد الحفظ غير متاح.");
  await db.insert(saveFolderItems).values({ folderId: folder.id, reactionId }).onDuplicateKeyUpdate({ set: { createdAt: new Date() } });
}

export async function listSaveFolders(userId: number) {
  await ensureDefaultSaveFolders(userId);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const rows = await db.select({ folder: saveFolders, item: saveFolderItems, reaction: reactions, category: categories })
    .from(saveFolders)
    .leftJoin(saveFolderItems, eq(saveFolderItems.folderId, saveFolders.id))
    .leftJoin(reactions, eq(saveFolderItems.reactionId, reactions.id))
    .leftJoin(categories, eq(reactions.categoryId, categories.id))
    .where(eq(saveFolders.userId, userId))
    .orderBy(desc(saveFolders.updatedAt), desc(saveFolderItems.createdAt));
  const folders = new Map<number, { id: number; name: string; isDefault: boolean; items: Array<{ publicId: string; quote: string; categoryName: string; categoryColor: string }> }>();
  for (const row of rows) {
    if (!folders.has(row.folder.id)) folders.set(row.folder.id, { id: row.folder.id, name: row.folder.name, isDefault: row.folder.isDefault, items: [] });
    if (row.reaction && row.category && row.reaction.status === "published") folders.get(row.folder.id)!.items.push({ publicId: row.reaction.publicId, quote: row.reaction.quote, categoryName: row.category.name, categoryColor: row.category.color });
  }
  return Array.from(folders.values());
}

export async function createSaveFolder(userId: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 80) throw new Error("اسم المجلد مطلوب وبحد أقصى 80 حرفاً.");
  await db.insert(saveFolders).values({ userId, name: cleanName, isDefault: false });
  const [folder] = await db.select().from(saveFolders).where(and(eq(saveFolders.userId, userId), eq(saveFolders.name, cleanName))).limit(1);
  if (!folder) throw new Error("تعذر إنشاء مجلد الحفظ.");
  return folder;
}

export async function saveReactionToFolder(userId: number, publicId: string, folderId: number) {
  return toggleReactionSave(userId, publicId, folderId);
}

export async function recordRecentReactionView(userId: number, publicId: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [reaction] = await db.select({ id: reactions.id }).from(reactions).where(and(eq(reactions.publicId, publicId), eq(reactions.status, "published"))).limit(1);
  if (!reaction) return { recorded: false } as const;
  await db.insert(recentlyViewedReactions).values({ userId, reactionId: reaction.id }).onDuplicateKeyUpdate({ set: { viewedAt: new Date() } });
  return { recorded: true } as const;
}

export async function listRecentReactionViews(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const rows = await db.select({ view: recentlyViewedReactions, reaction: reactions, category: categories })
    .from(recentlyViewedReactions)
    .innerJoin(reactions, eq(recentlyViewedReactions.reactionId, reactions.id))
    .innerJoin(categories, eq(reactions.categoryId, categories.id))
    .where(and(eq(recentlyViewedReactions.userId, userId), eq(reactions.status, "published")))
    .orderBy(desc(recentlyViewedReactions.viewedAt)).limit(12);
  return rows.map(({ view, reaction, category }) => ({ viewedAt: view.viewedAt, publicId: reaction.publicId, quote: reaction.quote, categoryName: category.name, categoryColor: category.color }));
}

export async function listUserContributions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db.select().from(contributions).where(eq(contributions.userId, userId)).orderBy(desc(contributions.createdAt));
}
