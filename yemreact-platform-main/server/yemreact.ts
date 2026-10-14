import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { and, asc, desc, eq, gte, like, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  categories,
  collectionItems,
  collections,
  engagementEvents,
  failedSearchQueries,
  reactionSaves,
  reactionShareEvents,
  reactions,
  searchEvents,
  users,
} from "../drizzle/schema";
import { CATEGORY_SEED } from "../shared/yemreact";
import { MAX_REACTION_DURATION_SECONDS } from "../shared/reactionLimits";
import { getDb } from "./db";
import { decodeVideoBase64, MAX_VIDEO_BASE64_LENGTH as PROCESSING_BASE64_LIMIT, storeOriginalVideo, validateVideoUpload } from "./videoProcessing";
import { enqueueVideoJob, getVideoProcessingJobByIdempotencyKey, processNextVideoJob } from "./videoQueue";

const ALLOWED_RIGHTS_FOR_PUBLICATION = new Set(["cleared", "permission", "original"]);
export { MAX_REACTION_DURATION_SECONDS } from "../shared/reactionLimits";

export const catalogSearchInput = z.object({
  query: z.string().trim().max(255).optional().default(""),
  categoryId: z.string().trim().max(32).optional(),
  cursor: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(48).default(24),
});

export const collectionBrowseInput = z.object({
  slug: z.string().trim().min(1).max(96),
  cursor: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(48).default(24),
});

export const reactionWriteInput = z.object({
  categoryId: z.string().min(1).max(32),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  quote: z.string().trim().min(1).max(180),
  situation: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional().nullable(),
  keywords: z.string().trim().max(1500).optional().nullable(),
  searchOptimizer: z.string().trim().max(6000).optional().nullable(),
  durationSeconds: z.number().int().min(1).max(MAX_REACTION_DURATION_SECONDS),
  corner: z.enum(["tr", "tl"]).default("tr"),
  sourceName: z.string().trim().max(255).optional().nullable(),
  sourceUrl: z.string().trim().url().max(2048).optional().or(z.literal("")).nullable(),
  rightsStatus: z.enum(["pending", "cleared", "permission", "original", "restricted"]),
  isTestData: z.boolean().default(true),
});

export const reactionDraftInput = z.object({
  categoryId: z.string().trim().min(1).max(32).optional(),
});

export const mediaUploadInput = z.object({
  reactionId: z.number().int().positive(),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().max(127),
  dataBase64: z.string().min(16).max(PROCESSING_BASE64_LIMIT),
  idempotencyKey: z.string().trim().min(16).max(96).optional(),
});

export type ReactionWriteInput = z.infer<typeof reactionWriteInput>;

export function normalizeArabic(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u0621\u0624\u0626]/g, "ء")
    .replace(/[^ء-ياأإآؤئىة0-9A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function buildSearchDocument(input: Pick<ReactionWriteInput, "quote" | "situation" | "description" | "keywords" | "searchOptimizer">) {
  return [input.quote, input.situation, input.description, input.keywords, input.searchOptimizer]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
}

type SynonymData = { version: number; groups: string[][] };
const SYNONYM_GROUPS: string[][] = (() => {
  try {
    const filePath = path.resolve(process.cwd(), "data", "yemeni_synonyms.json");
    const data = JSON.parse(readFileSync(filePath, "utf8")) as SynonymData;
    return Array.isArray(data.groups) ? data.groups.filter(group => Array.isArray(group) && group.length > 0) : [];
  } catch (error) {
    console.warn("[Search] تعذر تحميل قاموس المرادفات اليمنية:", error);
    return [];
  }
})();

function levenshtein(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(current[rightIndex - 1]! + 1, previous[rightIndex]! + 1, previous[rightIndex - 1]! + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[right.length]!;
}

export function expandArabicQuery(query: string) {
  const normalized = normalizeArabic(query);
  if (!normalized) return [];
  const expanded = new Set([normalized]);
  const queryTokens = new Set(normalized.split(" ").filter(Boolean));
  for (const group of SYNONYM_GROUPS) {
    const normalizedGroup = group.map(normalizeArabic);
    if (normalizedGroup.some(term => term.split(" ").every(token => queryTokens.has(token)))) {
      normalizedGroup.forEach(term => expanded.add(term));
    }
  }
  return Array.from(expanded);
}

function tokenSimilarity(query: string, document: string) {
  const queryTokens = normalizeArabic(query).split(" ").filter(Boolean);
  const documentTokens = normalizeArabic(document).split(" ").filter(Boolean);
  if (!queryTokens.length || !documentTokens.length) return 0;
  const compact = (token: string) => token.replace(/(.)\1+/g, "$1");
  const matched = queryTokens.filter(token => documentTokens.some(candidate => candidate === token || compact(candidate) === compact(token) || (token.length >= 3 && levenshtein(token, candidate) <= 1)));
  return matched.length / queryTokens.length;
}

export function scoreHybridSearch(query: string, input: { quote: string; situation: string; description?: string | null; keywords?: string | null; searchOptimizer?: string | null; searchDocument?: string | null }) {
  const expanded = expandArabicQuery(query);
  if (!expanded.length) return 0;
  const caption = normalizeArabic(`${input.quote} ${input.situation}`);
  const optimizer = normalizeArabic(input.searchOptimizer || input.keywords || "");
  const document = normalizeArabic(input.searchDocument || `${caption} ${input.description || ""} ${optimizer}`);
  let score = 0;
  for (const term of expanded) {
    if (document.includes(term)) score += term === expanded[0] ? 150 : 80;
    if (optimizer.includes(term)) score += 90;
    if (caption.includes(term)) score += 45;
  }
  const similarity = tokenSimilarity(expanded[0]!, document);
  if (score === 0 && similarity < 0.8) return 0;
  score += Math.round(similarity * 100);
  return score;
}

const demoReactions = [
  {
    publicId: "YR-0001",
    categoryId: "shock",
    quote: "يا ساتر!",
    situation: "لما تسمع خبر ما كنت متوقعه",
    description: "بيانات اختبار داخلية لرحلة البحث بالموقف.",
    keywords: "خبر مفاجأة صدمة ما توقعت",
    durationSeconds: 2,
    corner: "tr" as const,
  },
  {
    publicId: "YR-0002",
    categoryId: "reject",
    quote: "عاد شي عقل؟",
    situation: "لما حد يقول كلام مالوش داعي",
    description: "بيانات اختبار داخلية لرحلة البحث بالموقف.",
    keywords: "رفض كلام زايد غير منطقي",
    durationSeconds: 3,
    corner: "tl" as const,
  },
  {
    publicId: "YR-0003",
    categoryId: "sarcasm",
    quote: "قوية... قوية جدًا",
    situation: "لما أحد يسولف عليك بثقة زيادة",
    description: "بيانات اختبار داخلية لرحلة البحث بالموقف.",
    keywords: "سخرية مبالغة كلام سوالف",
    durationSeconds: 5,
    corner: "tr" as const,
  },
  {
    publicId: "YR-0004",
    categoryId: "hype",
    quote: "قوية!",
    situation: "لما تسمع خبر يفرحك",
    description: "بيانات اختبار داخلية لرحلة البحث بالموقف.",
    keywords: "حماس فرحة خبر جميل",
    durationSeconds: 3,
    corner: "tl" as const,
  },
  {
    publicId: "YR-0005",
    categoryId: "surprise",
    quote: "صلّي على النبي",
    situation: "لما تشوف شيء ما تصدق عيونك",
    description: "بيانات اختبار داخلية لرحلة البحث بالموقف.",
    keywords: "استغراب انبهار عيونك تصدق",
    durationSeconds: 4,
    corner: "tr" as const,
  },
  {
    publicId: "YR-0006",
    categoryId: "laugh",
    quote: "ياخي وربي",
    situation: "لما صاحبك يقع بموقف محرج",
    description: "بيانات اختبار داخلية لرحلة البحث بالموقف.",
    keywords: "ضحك موقف محرج صديق",
    durationSeconds: 3,
    corner: "tr" as const,
  },
  {
    publicId: "YR-0007",
    categoryId: "embarrass",
    quote: "...",
    situation: "لما ما تلقى رد على كلامهم",
    description: "بيانات اختبار داخلية لرحلة البحث بالموقف.",
    keywords: "احراج صمت رد ما لقيت",
    durationSeconds: 4,
    corner: "tr" as const,
  },
  {
    publicId: "YR-0008",
    categoryId: "approve",
    quote: "معك حق",
    situation: "لما حد يقنعك بفكرة منطقية",
    description: "بيانات اختبار داخلية لرحلة البحث بالموقف.",
    keywords: "موافقة اقتناع فكرة حق",
    durationSeconds: 2,
    corner: "tr" as const,
  },
  {
    publicId: "YR-0009",
    categoryId: "anger",
    quote: "كفاية!",
    situation: "لما حد يضيّع وقتك مرة ثانية",
    description: "بيانات اختبار داخلية لرحلة البحث بالموقف.",
    keywords: "غضب وقت تضييع كفاية",
    durationSeconds: 3,
    corner: "tr" as const,
  },
  {
    publicId: "YR-0010",
    categoryId: "shock",
    quote: "معقول؟",
    situation: "لما الخبر يجيك من شخص ما تتوقعه",
    description: "بيانات اختبار داخلية لرحلة الرياكشنات القريبة.",
    keywords: "معقول خبر شخص مفاجأة صدمة",
    durationSeconds: 3,
    corner: "tr" as const,
  },
  {
    publicId: "YR-0011",
    categoryId: "shock",
    quote: "إيش هذا؟",
    situation: "لما تشوف نتيجة ما كانت في الحسبان",
    description: "بيانات اختبار داخلية لرحلة الرياكشنات القريبة.",
    keywords: "نتيجة صدمة ما توقعت استغراب",
    durationSeconds: 2,
    corner: "tl" as const,
  },
  {
    publicId: "YR-0012",
    categoryId: "reject",
    quote: "برضه؟",
    situation: "لما نفس الوعد يتكرر بدون نتيجة",
    description: "بيانات اختبار داخلية لرحلة الرياكشنات القريبة.",
    keywords: "وعد تكرار رفض بكرة",
    durationSeconds: 3,
    corner: "tr" as const,
  },
] as const;

function toReactionDto(reaction: typeof reactions.$inferSelect, category?: typeof categories.$inferSelect) {
  const isPublicMedia =
    reaction.status === "published" &&
    reaction.mediaStatus === "uploaded" &&
    Boolean(reaction.mediaUrl) &&
    ALLOWED_RIGHTS_FOR_PUBLICATION.has(reaction.rightsStatus);
  return {
    id: reaction.id,
    publicId: reaction.publicId,
    categoryId: reaction.categoryId,
    categoryName: category?.name ?? reaction.categoryId,
    categoryColor: category?.color ?? "#9C9289",
    status: reaction.status,
    quote: reaction.quote,
    situation: reaction.situation,
    description: reaction.description,
    keywords: reaction.keywords,
    searchOptimizer: reaction.searchOptimizer,
    semanticModel: reaction.semanticModel,
    durationSeconds: reaction.durationSeconds,
    viewCount: reaction.viewCount,
    downloadCount: reaction.downloadCount,
    corner: reaction.corner,
    sourceName: reaction.sourceName,
    sourceUrl: reaction.sourceUrl,
    rightsStatus: reaction.rightsStatus,
    mediaStatus: reaction.mediaStatus,
    mediaUrl: isPublicMedia ? reaction.mediaUrl : null,
    mediaMimeType: isPublicMedia ? reaction.mediaMimeType : null,
    mediaOriginalName: reaction.mediaOriginalName,
    mediaSizeBytes: reaction.mediaSizeBytes,
    mediaUploadedAt: reaction.mediaUploadedAt,
    thumbnailUrl: reaction.thumbnailUrl,
    processingStatus: reaction.processingStatus,
    processingError: reaction.processingError,
    hasMedia: reaction.mediaStatus === "uploaded",
    isTestData: reaction.isTestData,
    publishedAt: reaction.publishedAt,
    createdAt: reaction.createdAt,
  };
}

export async function ensureYemReactSeed() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");

  for (const category of CATEGORY_SEED) {
    await db
      .insert(categories)
      .values({ ...category, isActive: true })
      .onDuplicateKeyUpdate({
        set: { color: category.color, sortOrder: category.sortOrder, isActive: true },
      });
  }

  const existing = await db.select({ publicId: reactions.publicId }).from(reactions);
  const existingIds = new Set(existing.map(item => item.publicId));
  const createdAt = new Date();

  for (const reaction of demoReactions) {
    if (existingIds.has(reaction.publicId)) continue;
    await db.insert(reactions).values({
      ...reaction,
      searchOptimizer: reaction.keywords,
      searchDocument: buildSearchDocument({ ...reaction, searchOptimizer: reaction.keywords }),
      status: "published",
      sourceName: "YemReact — بيانات اختبار داخلية",
      sourceUrl: null,
      rightsStatus: "pending",
      isTestData: true,
      publishedAt: createdAt,
    });
  }

  const existingCollections = await db.select({ slug: collections.slug }).from(collections);
  const slugs = new Set(existingCollections.map(item => item.slug));
  const demoCollections = [
    { slug: "group-replies", title: "ردود القروبات", description: "مجموعة اختبار لمواقف الكلام السريع.", sortOrder: 1 },
    { slug: "unexpected-moments", title: "لما ما تتوقع", description: "مجموعة اختبار للخبر والمفاجأة.", sortOrder: 2 },
  ];

  for (const collection of demoCollections) {
    if (slugs.has(collection.slug)) continue;
    await db.insert(collections).values({ ...collection, status: "published", isTestData: true });
  }
}

export async function listCategories() {
  await ensureYemReactSeed();
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder));
}

async function recordFailedSearch(rawQuery: string) {
  const normalizedQuery = normalizeArabic(rawQuery);
  if (!normalizedQuery) return;

  const db = await getDb();
  if (!db) return;
  const [existing] = await db
    .select()
    .from(failedSearchQueries)
    .where(eq(failedSearchQueries.normalizedQuery, normalizedQuery))
    .limit(1);

  if (existing) {
    await db
      .update(failedSearchQueries)
      .set({ occurrences: sql`${failedSearchQueries.occurrences} + 1`, originalQuery: rawQuery, lastSeenAt: new Date() })
      .where(eq(failedSearchQueries.id, existing.id));
    return;
  }

  await db.insert(failedSearchQueries).values({ normalizedQuery, originalQuery: rawQuery });
}

export async function listPublicReactions(input: z.infer<typeof catalogSearchInput>) {
  await ensureYemReactSeed();
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");

  const baseConditions = [eq(reactions.status, "published")];
  if (input.categoryId) baseConditions.push(eq(reactions.categoryId, input.categoryId));
  if (input.cursor) baseConditions.push(lt(reactions.id, input.cursor));
  const conditions = [...baseConditions];
  const normalizedQuery = normalizeArabic(input.query);
  if (normalizedQuery) {
    const expanded = expandArabicQuery(input.query);
    const predicates = expanded.map(term => like(reactions.searchDocument, `%${term}%`));
    if (predicates.length) conditions.push(or(...predicates)!);
  }
  const candidateLimit = Math.min(Math.max(input.limit * 3, input.limit), 96);
  let rows = await db
    .select({ reaction: reactions, category: categories })
    .from(reactions)
    .innerJoin(categories, eq(reactions.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(desc(reactions.popularityScore), desc(reactions.publishedAt), desc(reactions.id))
    .limit(candidateLimit);
  if (normalizedQuery && rows.length === 0) {
    rows = await db
      .select({ reaction: reactions, category: categories })
      .from(reactions)
      .innerJoin(categories, eq(reactions.categoryId, categories.id))
      .where(and(...baseConditions))
      .orderBy(desc(reactions.popularityScore), desc(reactions.publishedAt), desc(reactions.id))
      .limit(candidateLimit);
  }
  const ranked = rows
    .map(({ reaction, category }) => ({
      reaction,
      category,
      searchScore: normalizedQuery ? scoreHybridSearch(input.query, reaction) : 0,
      engagementScore: reaction.popularityScore,
    }))
    .filter(item => !normalizedQuery || item.searchScore > 0)
    .sort((left, right) => right.searchScore - left.searchScore || right.engagementScore - left.engagementScore || Number(right.reaction.publishedAt ?? 0) - Number(left.reaction.publishedAt ?? 0) || left.reaction.publicId.localeCompare(right.reaction.publicId));

  if (normalizedQuery && ranked.length === 0) await recordFailedSearch(input.query);

  const page = ranked.slice(0, input.limit);
  return {
    reactions: page.map(({ reaction, category, searchScore }) => ({ ...toReactionDto(reaction, category), searchScore })),
    nextCursor: page.length === input.limit ? page.at(-1)?.reaction.id ?? null : null,
    isTestDataset: true,
  };
}

export async function recordSearchEvent(input: {
  query: string;
  publicId?: string | null;
  eventType: "result_view" | "result_click" | "save";
  resultCount?: number;
  sessionHash: string;
  userId?: number | null;
}) {
  const normalizedQuery = normalizeArabic(input.query);
  if (!normalizedQuery) return { recorded: false } as const;
  const db = await getDb();
  if (!db) return { recorded: false } as const;
  let reactionId: number | null = null;
  if (input.publicId) {
    const [reaction] = await db
      .select({ id: reactions.id })
      .from(reactions)
      .where(and(eq(reactions.publicId, input.publicId), eq(reactions.status, "published")))
      .limit(1);
    reactionId = reaction?.id ?? null;
  }
  let userId: number | null = null;
  if (input.userId) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1);
    userId = user?.id ?? null;
  }
  await db.insert(searchEvents).values({
    normalizedQuery,
    sessionHash: input.sessionHash,
    userId,
    reactionId,
    eventType: input.eventType,
    resultCount: Math.max(0, Math.min(999, input.resultCount ?? 0)),
  });
  return { recorded: true } as const;
}

export type SearchAnalyticsPeriod = "today" | "7d" | "30d";

function analyticsWindow(period: SearchAnalyticsPeriod) {
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const days = period === "today" ? 1 : period === "7d" ? 7 : 30;
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { days, start };
}

export async function getSearchAnalytics(period: SearchAnalyticsPeriod = "7d", limit = 30) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const { days, start } = analyticsWindow(period);
  const createdAfter = gte(searchEvents.createdAt, start);
  const rows = await db.select({
    query: searchEvents.normalizedQuery,
    searches: sql<number>`SUM(CASE WHEN ${searchEvents.eventType} = 'result_view' THEN 1 ELSE 0 END)`,
    clicks: sql<number>`SUM(CASE WHEN ${searchEvents.eventType} = 'result_click' THEN 1 ELSE 0 END)`,
    saves: sql<number>`SUM(CASE WHEN ${searchEvents.eventType} = 'save' THEN 1 ELSE 0 END)`,
    averageResults: sql<number>`AVG(CASE WHEN ${searchEvents.eventType} = 'result_view' THEN ${searchEvents.resultCount} ELSE NULL END)`,
  }).from(searchEvents).where(createdAfter).groupBy(searchEvents.normalizedQuery).orderBy(desc(sql`SUM(CASE WHEN ${searchEvents.eventType} IN ('result_click', 'save') THEN 1 ELSE 0 END)`)).limit(Math.max(1, Math.min(limit, 100)));
  const items = rows.map(row => {
    const searches = Number(row.searches ?? 0);
    const clicks = Number(row.clicks ?? 0);
    const saves = Number(row.saves ?? 0);
    return {
      query: row.query,
      searches,
      clicks,
      saves,
      averageResults: Math.round(Number(row.averageResults ?? 0) * 10) / 10,
      clickThroughRate: searches ? Math.round((clicks / searches) * 1000) / 10 : 0,
      noAction: searches > 0 && clicks === 0 && saves === 0,
    };
  });
  const dayExpression = sql<string>`DATE(${searchEvents.createdAt})`.as("eventDate");
  const trendRows = await db.select({
    date: dayExpression,
    searches: sql<number>`SUM(CASE WHEN ${searchEvents.eventType} = 'result_view' THEN 1 ELSE 0 END)`,
    clicks: sql<number>`SUM(CASE WHEN ${searchEvents.eventType} = 'result_click' THEN 1 ELSE 0 END)`,
    saves: sql<number>`SUM(CASE WHEN ${searchEvents.eventType} = 'save' THEN 1 ELSE 0 END)`,
  }).from(searchEvents).where(createdAfter).groupBy(sql.raw("eventDate")).orderBy(asc(sql.raw("eventDate")));
  const byDate = new Map(trendRows.map(row => [String(row.date).slice(0, 10), row]));
  const timeline = Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const row = byDate.get(key);
    return { date: key, searches: Number(row?.searches ?? 0), clicks: Number(row?.clicks ?? 0), saves: Number(row?.saves ?? 0) };
  });
  const totals = timeline.reduce((total, point) => ({ searches: total.searches + point.searches, clicks: total.clicks + point.clicks, saves: total.saves + point.saves }), { searches: 0, clicks: 0, saves: 0 });
  return { period, topQueries: items, noActionQueries: items.filter(item => item.noAction), timeline, totals };
}

export async function getPublicReaction(publicId: string) {
  await ensureYemReactSeed();
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");

  const [found] = await db
    .select({ reaction: reactions, category: categories })
    .from(reactions)
    .innerJoin(categories, eq(reactions.categoryId, categories.id))
    .where(and(eq(reactions.publicId, publicId), eq(reactions.status, "published")))
    .limit(1);

  if (!found) return null;

  const nearby = await db
    .select({ reaction: reactions, category: categories })
    .from(reactions)
    .innerJoin(categories, eq(reactions.categoryId, categories.id))
    .where(and(eq(reactions.status, "published"), eq(reactions.categoryId, found.reaction.categoryId)))
    .orderBy(desc(reactions.publishedAt))
    .limit(5);

  return {
    reaction: toReactionDto(found.reaction, found.category),
    nearby: nearby
      .filter(item => item.reaction.publicId !== publicId)
      .map(item => toReactionDto(item.reaction, item.category)),
  };
}

export async function recordReactionEngagement(publicId: string, kind: "view" | "download", fingerprintHash: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [reaction] = await db.select({ id: reactions.id }).from(reactions).where(and(eq(reactions.publicId, publicId), eq(reactions.status, "published"))).limit(1);
  if (!reaction) return { success: true, counted: false } as const;
  const windowBucket = new Date().toISOString().slice(0, 13);
  await db.transaction(async tx => {
    const [existing] = await tx.select({ id: engagementEvents.id }).from(engagementEvents)
      .where(and(eq(engagementEvents.reactionId, reaction.id), eq(engagementEvents.kind, kind), eq(engagementEvents.fingerprintHash, fingerprintHash), eq(engagementEvents.windowBucket, windowBucket)))
      .limit(1)
      .for("update");
    if (existing) return;
    await tx.insert(engagementEvents).values({ reactionId: reaction.id, kind, fingerprintHash, windowBucket });
    const field = kind === "view" ? reactions.viewCount : reactions.downloadCount;
    const popularityWeight = kind === "view" ? 1 : 3;
    await tx.update(reactions).set({
      [kind === "view" ? "viewCount" : "downloadCount"]: sql`${field} + 1`,
      popularityScore: sql`${reactions.popularityScore} + ${popularityWeight}`,
      updatedAt: new Date(),
    }).where(eq(reactions.id, reaction.id));
  });
  return { success: true } as const;
}

export async function recordReactionShare(publicId: string, source: "whatsapp" | "telegram" | "x" | "copy", sessionHash: string, userId?: number | null) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [reaction] = await db.select({ id: reactions.id }).from(reactions).where(and(eq(reactions.publicId, publicId), eq(reactions.status, "published"))).limit(1);
  if (!reaction) return { success: true, recorded: false } as const;
  const [user] = userId ? await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1) : [];
  await db.insert(reactionShareEvents).values({ reactionId: reaction.id, userId: user?.id ?? null, sessionHash, source });
  return { success: true, recorded: true } as const;
}

export async function getGrowthFunnel(period: SearchAnalyticsPeriod = "7d") {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const { start } = analyticsWindow(period);
  const [searchRows, engagementRows, saveRows, shareRows, topSavedRows, topSharedRows, shareSourceRows] = await Promise.all([
    db.select({ type: searchEvents.eventType, count: sql<number>`COUNT(*)` }).from(searchEvents).where(gte(searchEvents.createdAt, start)).groupBy(searchEvents.eventType),
    db.select({ type: engagementEvents.kind, count: sql<number>`COUNT(*)` }).from(engagementEvents).where(gte(engagementEvents.createdAt, start)).groupBy(engagementEvents.kind),
    db.select({ count: sql<number>`COUNT(*)` }).from(reactionSaves).where(gte(reactionSaves.createdAt, start)),
    db.select({ count: sql<number>`COUNT(*)` }).from(reactionShareEvents).where(gte(reactionShareEvents.createdAt, start)),
    db.select({ reaction: reactions, count: sql<number>`COUNT(*)` }).from(reactionSaves).innerJoin(reactions, eq(reactionSaves.reactionId, reactions.id)).where(gte(reactionSaves.createdAt, start)).groupBy(reactions.id).orderBy(desc(sql`COUNT(*)`)).limit(8),
    db.select({ reaction: reactions, count: sql<number>`COUNT(*)` }).from(reactionShareEvents).innerJoin(reactions, eq(reactionShareEvents.reactionId, reactions.id)).where(gte(reactionShareEvents.createdAt, start)).groupBy(reactions.id).orderBy(desc(sql`COUNT(*)`)).limit(8),
    db.select({ source: reactionShareEvents.source, count: sql<number>`COUNT(*)` }).from(reactionShareEvents).where(gte(reactionShareEvents.createdAt, start)).groupBy(reactionShareEvents.source),
  ]);
  const searchByType = new Map(searchRows.map(row => [row.type, Number(row.count)]));
  const engagementByType = new Map(engagementRows.map(row => [row.type, Number(row.count)]));
  const toRanking = (rows: Array<{ reaction: typeof reactions.$inferSelect; count: number }>) => rows.map(row => ({ publicId: row.reaction.publicId, quote: row.reaction.quote, count: Number(row.count) }));
  return {
    period,
    startsAt: start,
    funnel: { resultViews: searchByType.get("result_view") ?? 0, resultOpens: searchByType.get("result_click") ?? 0, detailViews: engagementByType.get("view") ?? 0, saves: Number(saveRows[0]?.count ?? 0), downloads: engagementByType.get("download") ?? 0, shares: Number(shareRows[0]?.count ?? 0) },
    topSaved: toRanking(topSavedRows),
    topShared: toRanking(topSharedRows),
    shareSources: shareSourceRows.map(row => ({ source: row.source, count: Number(row.count) })),
  };
}

export async function listPublicCollections() {
  await ensureYemReactSeed();
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db
    .select()
    .from(collections)
    .where(eq(collections.status, "published"))
    .orderBy(asc(collections.sortOrder));
}

export async function listPublicCollectionReactions(input: z.infer<typeof collectionBrowseInput>) {
  await ensureYemReactSeed();
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [collection] = await db.select().from(collections)
    .where(and(eq(collections.slug, input.slug), eq(collections.status, "published"))).limit(1);
  if (!collection) return null;
  const conditions = [eq(collectionItems.collectionId, collection.id), eq(reactions.status, "published")];
  if (input.cursor) conditions.push(lt(reactions.id, input.cursor));
  const rows = await db.select({ reaction: reactions, category: categories })
    .from(collectionItems)
    .innerJoin(reactions, eq(collectionItems.reactionId, reactions.id))
    .innerJoin(categories, eq(reactions.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(asc(collectionItems.position), desc(reactions.id))
    .limit(input.limit);
  return {
    collection,
    reactions: rows.map(({ reaction, category }) => toReactionDto(reaction, category)),
    nextCursor: rows.length === input.limit ? rows.at(-1)?.reaction.id ?? null : null,
  };
}

export async function listAdminReactions() {
  await ensureYemReactSeed();
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const rows = await db
    .select({ reaction: reactions, category: categories })
    .from(reactions)
    .innerJoin(categories, eq(reactions.categoryId, categories.id))
    .orderBy(desc(reactions.updatedAt));
  const memberships = await db.select({ reactionId: collectionItems.reactionId, collectionId: collectionItems.collectionId }).from(collectionItems);
  const collectionIdsByReaction = new Map<number, number[]>();
  for (const membership of memberships) {
    collectionIdsByReaction.set(membership.reactionId, [...(collectionIdsByReaction.get(membership.reactionId) ?? []), membership.collectionId]);
  }
  return rows.map(({ reaction, category }) => ({ ...toReactionDto(reaction, category), collectionIds: collectionIdsByReaction.get(reaction.id) ?? [] }));
}

export async function createReaction(input: ReactionWriteInput) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  if (input.status === "published") {
    throw new Error("لا يمكن نشر الرياكشن قبل رفع وسيط والتحقق من حقوق النشر.");
  }
  const [count] = await db.select({ count: sql<number>`count(*)` }).from(reactions);
  const publicId = `YR-${String(Number(count?.count ?? 0) + 1).padStart(4, "0")}`;
  await db.insert(reactions).values({
    publicId,
    ...input,
    searchOptimizer: input.searchOptimizer || input.keywords || null,
    searchDocument: buildSearchDocument(input),
    sourceUrl: input.sourceUrl || null,
    publishedAt: null,
  });
  const [created] = await db.select().from(reactions).where(eq(reactions.publicId, publicId)).limit(1);
  if (!created) throw new Error("تعذر إنشاء الرياكشن.");
  return created;
}

export async function createReactionDraft(input: z.infer<typeof reactionDraftInput>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [fallbackCategory] = await db.select({ id: categories.id }).from(categories).orderBy(asc(categories.sortOrder)).limit(1);
  const categoryId = input.categoryId ?? fallbackCategory?.id;
  if (!categoryId) throw new Error("لا توجد فئة متاحة لإنشاء مسودة الرياكشن.");
  const [category] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).limit(1);
  if (!category) throw new Error("الفئة المختارة غير موجودة.");
  const [count] = await db.select({ count: sql<number>`count(*)` }).from(reactions);
  const publicId = `YR-${String(Number(count?.count ?? 0) + 1).padStart(4, "0")}`;
  const placeholder = "مسودة بانتظار البيانات";
  await db.insert(reactions).values({
    publicId,
    categoryId,
    status: "draft",
    quote: placeholder,
    situation: placeholder,
    searchDocument: placeholder,
    durationSeconds: 1,
    corner: "tr",
    rightsStatus: "original",
    isTestData: false,
  });
  const [created] = await db.select().from(reactions).where(eq(reactions.publicId, publicId)).limit(1);
  if (!created) throw new Error("تعذر إنشاء مسودة الرياكشن.");
  return created;
}

export async function updateReaction(id: number, input: ReactionWriteInput) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [existing] = await db.select().from(reactions).where(eq(reactions.id, id)).limit(1);
  if (!existing) throw new Error("الرياكشن غير موجود.");
  if (
    input.status === "published" &&
    (existing.mediaStatus !== "uploaded" || !existing.mediaUrl || !ALLOWED_RIGHTS_FOR_PUBLICATION.has(input.rightsStatus))
  ) {
    throw new Error("لا يمكن النشر قبل رفع ملف فيديو وتحديد حالة حقوق تسمح بالنشر.");
  }
  await db
    .update(reactions)
    .set({
      ...input,
      searchOptimizer: input.searchOptimizer || input.keywords || null,
      searchDocument: buildSearchDocument(input),
      sourceUrl: input.sourceUrl || null,
      publishedAt: input.status === "published" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(reactions.id, id));
  const [updated] = await db.select().from(reactions).where(eq(reactions.id, id)).limit(1);
  if (!updated) throw new Error("الرياكشن غير موجود.");
  return updated;
}

export const reactionCollectionsInput = z.object({
  reactionId: z.number().int().positive(),
  collectionIds: z.array(z.number().int().positive()).max(24).default([]),
});

export async function setReactionCollections(input: z.infer<typeof reactionCollectionsInput>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [reaction] = await db.select({ id: reactions.id }).from(reactions).where(eq(reactions.id, input.reactionId)).limit(1);
  if (!reaction) throw new Error("الرياكشن غير موجود.");
  const collectionIds = Array.from(new Set(input.collectionIds));
  if (collectionIds.length) {
    const available = await db.select({ id: collections.id }).from(collections);
    const availableIds = new Set(available.map(collection => collection.id));
    if (collectionIds.some(id => !availableIds.has(id))) throw new Error("إحدى المجموعات المختارة غير موجودة.");
  }
  await db.transaction(async tx => {
    await tx.delete(collectionItems).where(eq(collectionItems.reactionId, input.reactionId));
    if (collectionIds.length) {
      await tx.insert(collectionItems).values(collectionIds.map((collectionId, position) => ({ reactionId: input.reactionId, collectionId, position })));
    }
  });
  return { reactionId: input.reactionId, collectionIds };
}

export async function uploadReactionMedia(input: z.infer<typeof mediaUploadInput>) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [reaction] = await db.select().from(reactions).where(eq(reactions.id, input.reactionId)).limit(1);
  if (!reaction) throw new Error("احفظ بيانات الرياكشن أولًا قبل رفع الوسيط.");
  const data = decodeVideoBase64(input.dataBase64);
  validateVideoUpload(data, input.contentType);
  if (reaction.status === "archived") throw new Error("لا يمكن رفع وسيط لرياكشن مؤرشف.");
  if (reaction.status === "published") throw new Error("أرشف الرياكشن أو حوّله إلى مسودة قبل استبدال الفيديو المنشور.");
  const idempotencyKey = input.idempotencyKey || crypto.randomUUID();
  if (reaction.mediaIdempotencyKey === idempotencyKey) {
    const existing = await getVideoProcessingJobByIdempotencyKey(`reaction-${idempotencyKey}`);
    if (existing) return { job: existing, idempotencyKey, reused: true };
  }
  const original = await storeOriginalVideo({ data, fileName: input.fileName, contentType: input.contentType, storagePrefix: `reactions/${reaction.publicId}` });
  const now = new Date();
  await db.update(reactions).set({
    mediaStatus: "missing",
    processingStatus: "pending",
    processingError: null,
    mediaIdempotencyKey: idempotencyKey,
    sourceMediaKey: original.stored.key,
    sourceMediaUrl: original.stored.url,
    sourceMediaMimeType: original.mimeType,
    sourceMediaOriginalName: original.safeName,
    sourceMediaSizeBytes: data.length,
    updatedAt: now,
  }).where(eq(reactions.id, reaction.id));
  const job = await enqueueVideoJob({ jobType: "reaction", reactionId: reaction.id, idempotencyKey: `reaction-${idempotencyKey}` });
  if (process.env.NODE_ENV === "development" && !process.env.VITEST && !process.env.VITEST_WORKER_ID) {
    void processNextVideoJob().catch(error => console.error("[VideoQueue] Development worker failed:", error));
  }
  return { job, idempotencyKey, reused: false };
}

export async function archiveReaction(id: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  await db.update(reactions).set({ status: "archived", updatedAt: new Date() }).where(eq(reactions.id, id));
  return { success: true } as const;
}

export async function listFailedSearchQueries() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db.select().from(failedSearchQueries).orderBy(desc(failedSearchQueries.occurrences), desc(failedSearchQueries.lastSeenAt)).limit(20);
}
