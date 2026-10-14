import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { auditEvents, categories, collectionItems, collections, reactions } from "../drizzle/schema";
import { getDb } from "./db";

const MAX_IMPORT_ROWS = 300;
const PUBLISHABLE_RIGHTS = new Set(["cleared", "permission", "original"]);
const statusSchema = z.enum(["draft", "published"]);
const rightsSchema = z.enum(["pending", "cleared", "permission", "original", "restricted"]);

export const contentBatchInput = z.object({
  format: z.enum(["csv", "json"]),
  content: z.string().min(2).max(2_000_000),
});

type RawRecord = Record<string, unknown>;
type ParsedItem = {
  line: number;
  caption: string;
  description: string | null;
  situation: string;
  keywords: string | null;
  searchOptimizer: string | null;
  category: string;
  collectionRefs: string[];
  sourceName: string | null;
  sourceUrl: string | null;
  videoKey: string | null;
  videoUrl: string | null;
  durationSeconds: number | null;
  status: "draft" | "published";
  rightsStatus: z.infer<typeof rightsSchema>;
};

function normalizeKey(key: string) {
  return key.trim().toLocaleLowerCase("ar-YE").replace(/[\s_\-]+/g, "");
}

function value(record: RawRecord, ...keys: string[]) {
  const normalized = new Map(Object.entries(record).map(([key, item]) => [normalizeKey(key), item]));
  for (const key of keys) {
    const found = normalized.get(normalizeKey(key));
    if (found !== undefined && found !== null) return String(found).trim();
  }
  return "";
}

function parseCsv(content: string) {
  const cells: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]!;
    const next = content[index + 1];
    if (char === '"' && quoted && next === '"') { field += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === "," && !quoted) { row.push(field); field = ""; continue; }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some(cell => cell.trim())) cells.push(row);
      row = []; field = ""; continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some(cell => cell.trim())) cells.push(row);
  if (quoted) throw new Error("يوجد اقتباس غير مغلق في ملف CSV.");
  if (cells.length < 2) throw new Error("يجب أن يحتوي CSV على صف عناوين وصف بيانات واحد على الأقل.");
  const headers = cells[0]!.map(header => header.replace(/^\uFEFF/, "").trim());
  return cells.slice(1).map(rowValues => Object.fromEntries(headers.map((header, index) => [header, rowValues[index] ?? ""])));
}

function parseRaw(input: z.infer<typeof contentBatchInput>) {
  if (input.format === "csv") return parseCsv(input.content);
  const parsed: unknown = JSON.parse(input.content);
  const rows = Array.isArray(parsed) ? parsed : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { rows?: unknown }).rows) ? (parsed as { rows: unknown[] }).rows : null;
  if (!rows) throw new Error("يجب أن يكون JSON مصفوفة عناصر أو كائناً يحوي الحقل rows.");
  if (rows.some(row => typeof row !== "object" || row === null || Array.isArray(row))) throw new Error("كل عنصر في JSON يجب أن يكون كائناً يمثل رياكشن واحداً.");
  return rows as RawRecord[];
}

function asOptionalUrl(raw: string, label: string) {
  if (!raw) return null;
  if (raw.startsWith("/manus-storage/")) return raw;
  try { return new URL(raw).toString(); } catch { throw new Error(`${label} يجب أن يكون رابطاً صالحاً.`); }
}

function parseItem(record: RawRecord, line: number): ParsedItem {
  const caption = value(record, "caption", "quote", "الكابشن", "النص");
  const description = value(record, "description", "الوصف") || null;
  const situation = value(record, "situation", "الموقف") || description || "محتوى مستورد من إدارة YemReact";
  const statusRaw = value(record, "status", "الحالة") || "draft";
  const rightsRaw = value(record, "rightsStatus", "rights", "الحقوق") || "pending";
  const collectionText = value(record, "collections", "collection", "المجموعة", "المجموعات");
  const durationRaw = value(record, "durationSeconds", "duration", "المدة");
  const durationSeconds = durationRaw ? Number(durationRaw) : null;
  return {
    line,
    caption,
    description,
    situation,
    keywords: value(record, "keywords", "الكلماتالمفتاحية", "keywords") || null,
    searchOptimizer: value(record, "searchOptimizer", "search", "محسنالبحث") || null,
    category: value(record, "category", "categoryId", "الفئة"),
    collectionRefs: collectionText ? collectionText.split(/[|،;]/).map(item => item.trim()).filter(Boolean) : [],
    sourceName: value(record, "source", "sourceName", "المصدر") || null,
    sourceUrl: asOptionalUrl(value(record, "sourceUrl", "رابطالمصدر"), "رابط المصدر"),
    videoKey: value(record, "videoKey", "mediaKey", "fileKey", "مفتاحالفيديو") || null,
    videoUrl: asOptionalUrl(value(record, "videoUrl", "mediaUrl", "رابطالفيديو"), "رابط الفيديو"),
    durationSeconds: Number.isInteger(durationSeconds) ? durationSeconds : null,
    status: statusSchema.parse(statusRaw),
    rightsStatus: rightsSchema.parse(rightsRaw),
  };
}

function isSafeStorageKey(value: string) {
  return value.length <= 512 && !value.includes("..") && !value.startsWith("/") && /^[A-Za-z0-9_./-]+$/.test(value);
}

async function validateBatch(input: z.infer<typeof contentBatchInput>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const rawRows = parseRaw(input);
  if (!rawRows.length) throw new Error("ملف الاستيراد فارغ.");
  if (rawRows.length > MAX_IMPORT_ROWS) throw new Error(`الحد الأقصى للاستيراد الدفعي هو ${MAX_IMPORT_ROWS} رياكشن.`);
  const [availableCategories, availableCollections] = await Promise.all([db.select().from(categories), db.select().from(collections)]);
  const categoryByReference = new Map(availableCategories.flatMap(category => [[category.id.toLocaleLowerCase("ar-YE"), category.id], [category.name.toLocaleLowerCase("ar-YE"), category.id]]));
  const collectionByReference = new Map(availableCollections.flatMap(collection => [[collection.slug.toLocaleLowerCase("ar-YE"), collection.id], [collection.title.toLocaleLowerCase("ar-YE"), collection.id]]));
  return rawRows.map((record, index) => {
    const line = index + 2;
    try {
      const item = parseItem(record, line);
      const errors: string[] = [];
      if (!item.caption || item.caption.length > 180) errors.push("الكابشن مطلوب وبحد أقصى 180 حرفاً.");
      const categoryId = categoryByReference.get(item.category.toLocaleLowerCase("ar-YE"));
      if (!categoryId) errors.push("الفئة غير موجودة؛ استخدم معرّف الفئة أو اسمها الحالي.");
      if (!item.durationSeconds || item.durationSeconds < 1 || item.durationSeconds > 60) errors.push("المدة مطلوبة بين 1 و60 ثانية.");
      if (item.collectionRefs.length > 24) errors.push("لا يمكن ربط أكثر من 24 مجموعة بالرياكشن.");
      const collectionIds = item.collectionRefs.map(reference => collectionByReference.get(reference.toLocaleLowerCase("ar-YE"))).filter((id): id is number => Boolean(id));
      if (collectionIds.length !== item.collectionRefs.length) errors.push("إحدى المجموعات غير موجودة؛ استخدم slug أو اسم المجموعة.");
      if (item.videoKey && !isSafeStorageKey(item.videoKey)) errors.push("مفتاح الفيديو غير آمن أو لا يطابق صيغة التخزين.");
      const mediaUrl = item.videoUrl || (item.videoKey ? `/manus-storage/${item.videoKey}` : null);
      if (item.status === "published" && (!mediaUrl || !PUBLISHABLE_RIGHTS.has(item.rightsStatus))) errors.push("النشر المباشر يتطلب رابط/مفتاح فيديو وحالة حقوق cleared أو permission أو original.");
      return { line, valid: errors.length === 0, errors, item, categoryId: categoryId ?? null, collectionIds, mediaUrl };
    } catch (error) {
      return { line, valid: false, errors: [error instanceof Error ? error.message : "تعذر تحليل الصف."], item: null, categoryId: null, collectionIds: [], mediaUrl: null };
    }
  });
}

export async function previewContentBatch(input: z.infer<typeof contentBatchInput>) {
  const rows = await validateBatch(input);
  return { total: rows.length, validCount: rows.filter(row => row.valid).length, errorCount: rows.filter(row => !row.valid).length, rows: rows.map(row => ({ line: row.line, valid: row.valid, errors: row.errors, caption: row.item?.caption ?? "", category: row.item?.category ?? "", collections: row.item?.collectionRefs ?? [], hasMedia: Boolean(row.mediaUrl), status: row.item?.status ?? "draft" })) };
}

export async function importContentBatch(input: z.infer<typeof contentBatchInput>, adminUserId: number) {
  const rows = await validateBatch(input);
  const invalidRows = rows.filter(row => !row.valid);
  if (invalidRows.length) throw new Error(`تعذر الاستيراد: أصلح ${invalidRows.length} صفاً غير صالح في المعاينة أولاً.`);
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db.transaction(async tx => {
    const [latest] = await tx.select({ publicId: reactions.publicId }).from(reactions).orderBy(desc(reactions.id)).limit(1);
    let nextId = Number(latest?.publicId.match(/^YR-(\d+)$/)?.[1] ?? 0) + 1;
    const publicIds: string[] = [];
    for (const row of rows) {
      const item = row.item!;
      const publicId = `YR-${String(nextId).padStart(4, "0")}`;
      nextId += 1;
      const now = new Date();
      const mediaKey = item.videoKey ?? (item.videoUrl?.startsWith("/manus-storage/") ? item.videoUrl.replace(/^\/manus-storage\//, "") : null);
      const searchOptimizer = item.searchOptimizer || item.keywords;
      const searchDocument = [item.caption, item.situation, item.description, item.keywords, searchOptimizer].filter(Boolean).join(" ");
      await tx.insert(reactions).values({
        publicId, categoryId: row.categoryId!, status: item.status, quote: item.caption, situation: item.situation, description: item.description,
        keywords: item.keywords, searchOptimizer: searchOptimizer || null, searchDocument, durationSeconds: item.durationSeconds!, corner: "tr",
        sourceName: item.sourceName, sourceUrl: item.sourceUrl, rightsStatus: item.rightsStatus, mediaStatus: row.mediaUrl ? "uploaded" : "missing",
        mediaKey, mediaUrl: row.mediaUrl, mediaMimeType: row.mediaUrl ? "video/mp4" : null, mediaOriginalName: mediaKey?.split("/").at(-1) ?? null,
        mediaUploadedAt: row.mediaUrl ? now : null, processingStatus: row.mediaUrl ? "ready" : "pending", isTestData: false, publishedAt: item.status === "published" ? now : null,
      });
      const [created] = await tx.select({ id: reactions.id }).from(reactions).where(and(eq(reactions.publicId, publicId))).limit(1);
      if (!created) throw new Error("تعذر إنشاء أحد الرياكشنات المستوردة.");
      if (row.collectionIds.length) await tx.insert(collectionItems).values(row.collectionIds.map((collectionId, position) => ({ reactionId: created.id, collectionId, position })));
      publicIds.push(publicId);
    }
    await tx.insert(auditEvents).values({ actorUserId: adminUserId, entityType: "homepage", entityId: 0, action: "content_batch_imported", details: JSON.stringify({ count: publicIds.length, publicIds }) });
    return { imported: publicIds.length, publicIds };
  });
}
