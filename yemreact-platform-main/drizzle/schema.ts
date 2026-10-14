import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  googleSub: varchar("googleSub", { length: 255 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const categories = mysqlTable("categories", {
  id: varchar("id", { length: 32 }).primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  color: varchar("color", { length: 7 }).notNull(),
  sortOrder: int("sortOrder").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const reactions = mysqlTable(
  "reactions",
  {
    id: int("id").autoincrement().primaryKey(),
    publicId: varchar("publicId", { length: 32 }).notNull().unique(),
    categoryId: varchar("categoryId", { length: 32 }).notNull().references(() => categories.id),
    status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
    quote: varchar("quote", { length: 180 }).notNull(),
    situation: varchar("situation", { length: 255 }).notNull(),
    description: text("description"),
    keywords: text("keywords"),
    searchOptimizer: text("searchOptimizer"),
    searchDocument: text("searchDocument"),
    semanticEmbedding: text("semanticEmbedding"),
    semanticModel: varchar("semanticModel", { length: 96 }),
    semanticIndexedAt: timestamp("semanticIndexedAt"),
    durationSeconds: int("durationSeconds").notNull(),
    viewCount: int("viewCount").default(0).notNull(),
    downloadCount: int("downloadCount").default(0).notNull(),
    popularityScore: int("popularityScore").default(0).notNull(),
    corner: mysqlEnum("corner", ["tr", "tl"]).default("tr").notNull(),
    sourceName: varchar("sourceName", { length: 255 }),
    sourceUrl: varchar("sourceUrl", { length: 2048 }),
    rightsStatus: mysqlEnum("rightsStatus", ["pending", "cleared", "permission", "original", "restricted"]).default("pending").notNull(),
    mediaStatus: mysqlEnum("mediaStatus", ["missing", "uploaded"]).default("missing").notNull(),
    mediaKey: varchar("mediaKey", { length: 512 }),
    mediaUrl: varchar("mediaUrl", { length: 1024 }),
    mediaMimeType: varchar("mediaMimeType", { length: 127 }),
    mediaOriginalName: varchar("mediaOriginalName", { length: 255 }),
    mediaSizeBytes: int("mediaSizeBytes"),
    mediaUploadedAt: timestamp("mediaUploadedAt"),
    sourceMediaKey: varchar("sourceMediaKey", { length: 512 }),
    sourceMediaUrl: varchar("sourceMediaUrl", { length: 1024 }),
    sourceMediaMimeType: varchar("sourceMediaMimeType", { length: 127 }),
    sourceMediaOriginalName: varchar("sourceMediaOriginalName", { length: 255 }),
    sourceMediaSizeBytes: int("sourceMediaSizeBytes"),
    thumbnailKey: varchar("thumbnailKey", { length: 512 }),
    thumbnailUrl: varchar("thumbnailUrl", { length: 1024 }),
    processingStatus: mysqlEnum("processingStatus", ["pending", "processing", "ready", "failed"]).default("pending").notNull(),
    processingError: text("processingError"),
    mediaIdempotencyKey: varchar("mediaIdempotencyKey", { length: 96 }).unique(),
    isTestData: boolean("isTestData").default(true).notNull(),
    publishedAt: timestamp("publishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("reactions_status_idx").on(table.status),
    index("reactions_category_status_idx").on(table.categoryId, table.status),
    index("reactions_processing_idx").on(table.processingStatus, table.updatedAt),
    index("reactions_engagement_idx").on(table.status, table.popularityScore, table.publishedAt),
  ],
);

export const reactionSaves = mysqlTable(
  "reactionSaves",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    reactionId: int("reactionId").notNull().references(() => reactions.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("user_reaction_save_unique").on(table.userId, table.reactionId),
    index("reaction_saves_user_idx").on(table.userId),
  ],
);

export const saveFolders = mysqlTable(
  "saveFolders",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    isDefault: boolean("isDefault").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("save_folder_user_name_unique").on(table.userId, table.name),
    index("save_folder_user_idx").on(table.userId, table.updatedAt),
  ],
);

export const saveFolderItems = mysqlTable(
  "saveFolderItems",
  {
    id: int("id").autoincrement().primaryKey(),
    folderId: int("folderId").notNull().references(() => saveFolders.id, { onDelete: "cascade" }),
    reactionId: int("reactionId").notNull().references(() => reactions.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("save_folder_reaction_unique").on(table.folderId, table.reactionId),
    index("save_folder_items_reaction_idx").on(table.reactionId, table.createdAt),
  ],
);

export const recentlyViewedReactions = mysqlTable(
  "recentlyViewedReactions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    reactionId: int("reactionId").notNull().references(() => reactions.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("recent_view_user_reaction_unique").on(table.userId, table.reactionId),
    index("recent_view_user_time_idx").on(table.userId, table.viewedAt),
  ],
);

export const contributions = mysqlTable(
  "contributions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    trackingCode: varchar("trackingCode", { length: 48 }).unique(),
    note: text("note"),
    status: mysqlEnum("status", ["pending", "reviewing", "processing", "approved", "rejected"]).default("pending").notNull(),
    processingStatus: mysqlEnum("processingStatus", ["pending", "processing", "ready", "failed"]).default("pending").notNull(),
    processingError: text("processingError"),
    uploadIdempotencyKey: varchar("uploadIdempotencyKey", { length: 96 }).unique(),
    approvalIdempotencyKey: varchar("approvalIdempotencyKey", { length: 96 }).unique(),
    rejectionIdempotencyKey: varchar("rejectionIdempotencyKey", { length: 96 }).unique(),
    originalMediaKey: varchar("originalMediaKey", { length: 512 }),
    originalMediaUrl: varchar("originalMediaUrl", { length: 1024 }),
    originalMediaMimeType: varchar("originalMediaMimeType", { length: 127 }),
    originalMediaOriginalName: varchar("originalMediaOriginalName", { length: 255 }),
    originalMediaSizeBytes: int("originalMediaSizeBytes"),
    processedMediaKey: varchar("processedMediaKey", { length: 512 }),
    processedMediaUrl: varchar("processedMediaUrl", { length: 1024 }),
    processedMediaSizeBytes: int("processedMediaSizeBytes"),
    thumbnailKey: varchar("thumbnailKey", { length: 512 }),
    thumbnailUrl: varchar("thumbnailUrl", { length: 1024 }),
    durationSeconds: int("durationSeconds"),
    quote: varchar("quote", { length: 180 }),
    situation: varchar("situation", { length: 255 }),
    description: text("description"),
    keywords: text("keywords"),
    categoryId: varchar("categoryId", { length: 32 }).references(() => categories.id),
    corner: mysqlEnum("corner", ["tr", "tl"]),
    sourceName: varchar("sourceName", { length: 255 }),
    sourceUrl: varchar("sourceUrl", { length: 2048 }),
    rightsStatus: mysqlEnum("rightsStatus", ["pending", "cleared", "permission", "original", "restricted"]),
    rejectionReason: text("rejectionReason"),
    reviewedByUserId: int("reviewedByUserId").references(() => users.id),
    reviewedAt: timestamp("reviewedAt"),
    publishedReactionId: int("publishedReactionId").references(() => reactions.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("contributions_user_idx").on(table.userId, table.status),
    index("contributions_status_created_idx").on(table.status, table.createdAt),
    index("contributions_processing_idx").on(table.processingStatus, table.updatedAt),
  ],
);

export const collections = mysqlTable(
  "collections",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 96 }).notNull().unique(),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description"),
    status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
    sortOrder: int("sortOrder").default(0).notNull(),
    isTestData: boolean("isTestData").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("collections_status_idx").on(table.status, table.sortOrder)],
);

export const collectionItems = mysqlTable(
  "collectionItems",
  {
    id: int("id").autoincrement().primaryKey(),
    collectionId: int("collectionId").notNull().references(() => collections.id),
    reactionId: int("reactionId").notNull().references(() => reactions.id),
    position: int("position").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("collection_reaction_unique").on(table.collectionId, table.reactionId),
    index("collection_items_position_idx").on(table.collectionId, table.position),
  ],
);

export const failedSearchQueries = mysqlTable(
  "failedSearchQueries",
  {
    id: int("id").autoincrement().primaryKey(),
    normalizedQuery: varchar("normalizedQuery", { length: 255 }).notNull().unique(),
    originalQuery: varchar("originalQuery", { length: 255 }).notNull(),
    occurrences: int("occurrences").default(1).notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().onUpdateNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("failed_search_occurrences_idx").on(table.occurrences)],
);

export const videoProcessingJobs = mysqlTable(
  "videoProcessingJobs",
  {
    id: int("id").autoincrement().primaryKey(),
    jobType: mysqlEnum("jobType", ["reaction", "contribution"]).notNull(),
    reactionId: int("reactionId").references(() => reactions.id, { onDelete: "cascade" }),
    contributionId: int("contributionId").references(() => contributions.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", ["pending", "processing", "ready", "failed", "cancelled"]).default("pending").notNull(),
    attempts: int("attempts").default(0).notNull(),
    maxAttempts: int("maxAttempts").default(3).notNull(),
    runAfter: timestamp("runAfter").defaultNow().notNull(),
    lockedAt: timestamp("lockedAt"),
    lockToken: varchar("lockToken", { length: 96 }),
    stage: varchar("stage", { length: 48 }).default("queued").notNull(),
    stageStartedAt: timestamp("stageStartedAt"),
    processingStartedAt: timestamp("processingStartedAt"),
    progressPercent: int("progressPercent").default(0).notNull(),
    originalSizeBytes: int("originalSizeBytes"),
    processedSizeBytes: int("processedSizeBytes"),
    sourceDurationSeconds: int("sourceDurationSeconds"),
    processingLog: text("processingLog"),
    lastError: text("lastError"),
    idempotencyKey: varchar("idempotencyKey", { length: 96 }).notNull().unique(),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("video_jobs_status_run_after_idx").on(table.status, table.runAfter),
    index("video_jobs_reaction_idx").on(table.reactionId),
    index("video_jobs_contribution_idx").on(table.contributionId),
  ],
);

export const engagementEvents = mysqlTable(
  "engagementEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    reactionId: int("reactionId").notNull().references(() => reactions.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", ["view", "download"]).notNull(),
    fingerprintHash: varchar("fingerprintHash", { length: 128 }).notNull(),
    windowBucket: varchar("windowBucket", { length: 32 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("engagement_window_unique").on(table.reactionId, table.kind, table.fingerprintHash, table.windowBucket),
    index("engagement_reaction_created_idx").on(table.reactionId, table.createdAt),
  ],
);

export const reactionShareEvents = mysqlTable(
  "reactionShareEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    reactionId: int("reactionId").notNull().references(() => reactions.id, { onDelete: "cascade" }),
    userId: int("userId").references(() => users.id, { onDelete: "set null" }),
    sessionHash: varchar("sessionHash", { length: 128 }).notNull(),
    source: mysqlEnum("source", ["whatsapp", "telegram", "x", "copy"]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("reaction_shares_reaction_created_idx").on(table.reactionId, table.createdAt),
    index("reaction_shares_source_created_idx").on(table.source, table.createdAt),
  ],
);

export const searchEvents = mysqlTable(
  "searchEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    normalizedQuery: varchar("normalizedQuery", { length: 255 }).notNull(),
    sessionHash: varchar("sessionHash", { length: 128 }).notNull(),
    userId: int("userId").references(() => users.id, { onDelete: "set null" }),
    reactionId: int("reactionId").references(() => reactions.id, { onDelete: "cascade" }),
    eventType: mysqlEnum("eventType", ["result_view", "result_click", "save"]).notNull(),
    resultCount: int("resultCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("search_events_query_type_idx").on(table.normalizedQuery, table.eventType, table.createdAt),
    index("search_events_reaction_idx").on(table.reactionId, table.createdAt),
  ],
);

export const rateLimitBuckets = mysqlTable(
  "rateLimitBuckets",
  {
    keyHash: varchar("keyHash", { length: 128 }).primaryKey(),
    windowStartedAt: timestamp("windowStartedAt").notNull(),
    count: int("count").default(0).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("rate_limit_expires_idx").on(table.expiresAt)],
);

export const auditEvents = mysqlTable(
  "auditEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actorUserId").references(() => users.id),
    entityType: mysqlEnum("entityType", ["contribution", "reaction", "homepage"]).notNull(),
    entityId: int("entityId").notNull(),
    action: varchar("action", { length: 96 }).notNull(),
    details: text("details"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("audit_events_entity_idx").on(table.entityType, table.entityId, table.createdAt),
    index("audit_events_actor_idx").on(table.actorUserId, table.createdAt),
  ],
);

export const userNotifications = mysqlTable(
  "userNotifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    contributionId: int("contributionId").references(() => contributions.id),
    type: mysqlEnum("type", ["contribution_approved", "contribution_rejected"]).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    body: text("body").notNull(),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("notifications_user_read_idx").on(table.userId, table.readAt, table.createdAt)],
);

export const homePageSettings = mysqlTable("homePageSettings", {
  id: int("id").primaryKey(),
  weeklyReactionId: int("weeklyReactionId").references(() => reactions.id),
  newLibraryLimit: int("newLibraryLimit").default(12).notNull(),
  updatedByUserId: int("updatedByUserId").references(() => users.id),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
