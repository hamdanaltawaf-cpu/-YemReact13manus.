import { z } from "zod";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import {
  archiveReaction,
  collectionBrowseInput,
  catalogSearchInput,
  createReactionDraft,
  createReaction,
  getSearchAnalytics,
  getGrowthFunnel,
  getPublicReaction,
  listAdminReactions,
  listCategories,
  listFailedSearchQueries,
  listPublicCollections,
  listPublicCollectionReactions,
  listPublicReactions,
  mediaUploadInput,
  recordReactionEngagement,
  recordReactionShare,
  recordSearchEvent,
  reactionCollectionsInput,
  reactionDraftInput,
  reactionWriteInput,
  setReactionCollections,
  updateReaction,
  uploadReactionMedia,
} from "./yemreact";
import { clearGoogleSession, signInWithGoogleToken } from "./googleAuth";
import { createSaveFolder, listRecentReactionViews, listSavedReactions, listSaveFolders, recordRecentReactionView, saveReactionToFolder, toggleReactionSave } from "./account";
import {
  approveContribution,
  contributionListInput,
  contributionRejectInput,
  contributionReviewInput,
  contributionUploadInput,
  listAdminContributions,
  listAuditEvents,
  listOwnContributions,
  listUnreadNotifications,
  markNotificationsRead,
  rejectContribution,
  submitContribution,
} from "./contributionWorkflow";
import { categoryNamesInput, collectionWriteInput, getHomePageAdminData, getPublicHomePageData, homePageSettingsInput, saveCategoryNames, saveCollection, saveHomePageSettings } from "./homePageAdmin";
import { cancelVideoProcessingJob, getVideoProcessingJob, listVideoProcessingJobs, processNextVideoJob, recoverStuckVideoJobs, retryVideoProcessingJob } from "./videoQueue";
import { enforceRateLimit, requestFingerprint } from "./rateLimit";
import { contentBatchInput, importContentBatch, previewContentBatch } from "./contentImport";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    googleConfig: publicProcedure.query(() => ({ clientId: process.env.GOOGLE_CLIENT_ID ?? "" })),
    googleSignIn: publicProcedure
      .input(z.object({ idToken: z.string().min(100).max(20_000) }))
      .mutation(async ({ ctx, input }) => {
        await enforceRateLimit({ scope: "google-signin", fingerprint: requestFingerprint(ctx.req), limit: 12, windowSeconds: 15 * 60 });
        return signInWithGoogleToken(ctx.req, ctx.res, input.idToken);
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearGoogleSession(ctx.req, ctx.res);
      return { success: true } as const;
    }),
  }),
  catalog: router({
    categories: publicProcedure.query(() => listCategories()),
    list: publicProcedure.input(catalogSearchInput).query(({ input }) => listPublicReactions(input)),
    detail: publicProcedure.input(z.object({ publicId: z.string().min(1).max(32) })).query(({ input }) => getPublicReaction(input.publicId)),
    recordEngagement: publicProcedure.input(z.object({ publicId: z.string().min(1).max(32), kind: z.enum(["view", "download"]) })).mutation(async ({ ctx, input }) => {
      await enforceRateLimit({ scope: `engagement-${input.kind}`, fingerprint: requestFingerprint(ctx.req, ctx.user?.id), limit: 30, windowSeconds: 60 });
      return recordReactionEngagement(input.publicId, input.kind, requestFingerprint(ctx.req, ctx.user?.id));
    }),
    recordShare: publicProcedure.input(z.object({ publicId: z.string().min(1).max(32), source: z.enum(["whatsapp", "telegram", "x", "copy"]) })).mutation(async ({ ctx, input }) => {
      await enforceRateLimit({ scope: "reaction-share", fingerprint: requestFingerprint(ctx.req, ctx.user?.id), limit: 30, windowSeconds: 60 });
      return recordReactionShare(input.publicId, input.source, requestFingerprint(ctx.req, ctx.user?.id), ctx.user?.id);
    }),
    recordSearchEvent: publicProcedure.input(z.object({ query: z.string().trim().min(1).max(255), publicId: z.string().min(1).max(32).optional(), eventType: z.enum(["result_view", "result_click", "save"]), resultCount: z.number().int().min(0).max(999).optional() })).mutation(async ({ ctx, input }) => {
      await enforceRateLimit({ scope: "search-event", fingerprint: requestFingerprint(ctx.req, ctx.user?.id), limit: 90, windowSeconds: 60 });
      return recordSearchEvent({ ...input, sessionHash: requestFingerprint(ctx.req, ctx.user?.id), userId: ctx.user?.id });
    }),
    collections: publicProcedure.query(() => listPublicCollections()),
    collection: publicProcedure.input(collectionBrowseInput).query(({ input }) => listPublicCollectionReactions(input)),
    homepage: publicProcedure.query(() => getPublicHomePageData()),
  }),
  account: router({
    saved: protectedProcedure.query(({ ctx }) => listSavedReactions(ctx.user.id)),
    contributions: protectedProcedure.query(({ ctx }) => listOwnContributions(ctx.user.id)),
    submitContribution: protectedProcedure.input(contributionUploadInput).mutation(async ({ ctx, input }) => {
      await enforceRateLimit({ scope: "contribution-upload", fingerprint: requestFingerprint(ctx.req, ctx.user.id), limit: 5, windowSeconds: 60 * 60 });
      return submitContribution(ctx.user.id, input);
    }),
    unreadNotifications: protectedProcedure.query(({ ctx }) => listUnreadNotifications(ctx.user.id)),
    markNotificationsRead: protectedProcedure.input(z.object({ notificationIds: z.array(z.number().int().positive()).max(100) })).mutation(({ ctx, input }) => markNotificationsRead(ctx.user.id, input.notificationIds)),
    toggleSave: protectedProcedure
      .input(z.object({ publicId: z.string().min(1).max(32), folderId: z.number().int().positive().optional() }))
      .mutation(({ ctx, input }) => toggleReactionSave(ctx.user.id, input.publicId, input.folderId)),
    saveFolders: protectedProcedure.query(({ ctx }) => listSaveFolders(ctx.user.id)),
    createSaveFolder: protectedProcedure.input(z.object({ name: z.string().trim().min(1).max(80) })).mutation(({ ctx, input }) => createSaveFolder(ctx.user.id, input.name)),
    saveToFolder: protectedProcedure.input(z.object({ publicId: z.string().min(1).max(32), folderId: z.number().int().positive() })).mutation(({ ctx, input }) => saveReactionToFolder(ctx.user.id, input.publicId, input.folderId)),
    recentViews: protectedProcedure.query(({ ctx }) => listRecentReactionViews(ctx.user.id)),
    recordRecentView: protectedProcedure.input(z.object({ publicId: z.string().min(1).max(32) })).mutation(({ ctx, input }) => recordRecentReactionView(ctx.user.id, input.publicId)),
  }),
  admin: router({
    reactions: adminProcedure.query(() => listAdminReactions()),
    failedSearches: adminProcedure.query(() => listFailedSearchQueries()),
    previewContentBatch: adminProcedure.input(contentBatchInput).mutation(({ input }) => previewContentBatch(input)),
    importContentBatch: adminProcedure.input(contentBatchInput).mutation(({ ctx, input }) => importContentBatch(input, ctx.user.id)),
    searchAnalytics: adminProcedure.input(z.object({ period: z.enum(["today", "7d", "30d"]) }).optional()).query(({ input }) => getSearchAnalytics(input?.period)),
    growthFunnel: adminProcedure.input(z.object({ period: z.enum(["today", "7d", "30d"]) }).optional()).query(({ input }) => getGrowthFunnel(input?.period)),
    createReaction: adminProcedure.input(reactionWriteInput).mutation(({ input }) => createReaction(input)),
    createReactionDraft: adminProcedure.input(reactionDraftInput).mutation(({ input }) => createReactionDraft(input)),
    setReactionCollections: adminProcedure.input(reactionCollectionsInput).mutation(({ input }) => setReactionCollections(input)),
    uploadMedia: adminProcedure.input(mediaUploadInput).mutation(async ({ ctx, input }) => {
      await enforceRateLimit({ scope: "admin-media-upload", fingerprint: requestFingerprint(ctx.req, ctx.user.id), limit: 12, windowSeconds: 60 * 60 });
      return uploadReactionMedia(input);
    }),
    videoJob: adminProcedure.input(z.object({ jobId: z.number().int().positive() })).query(({ input }) => getVideoProcessingJob(input.jobId)),
    videoJobs: adminProcedure.query(() => listVideoProcessingJobs()),
    retryVideoJob: adminProcedure.input(z.object({ jobId: z.number().int().positive() })).mutation(({ ctx, input }) => retryVideoProcessingJob(input.jobId, ctx.user.id)),
    cancelVideoJob: adminProcedure.input(z.object({ jobId: z.number().int().positive() })).mutation(({ ctx, input }) => cancelVideoProcessingJob(input.jobId, ctx.user.id)),
    recoverStuckVideoJobs: adminProcedure.mutation(({ ctx }) => recoverStuckVideoJobs(ctx.user.id)),
    processNextVideoJob: adminProcedure.mutation(async ({ ctx }) => {
      await enforceRateLimit({ scope: "admin-video-worker", fingerprint: requestFingerprint(ctx.req, ctx.user.id), limit: 30, windowSeconds: 60 });
      return processNextVideoJob();
    }),
    updateReaction: adminProcedure
      .input(z.object({ id: z.number().int().positive(), data: reactionWriteInput }))
      .mutation(({ input }) => updateReaction(input.id, input.data)),
    archiveReaction: adminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => archiveReaction(input.id)),
    contributions: adminProcedure.input(contributionListInput).query(({ input }) => listAdminContributions(input.status)),
    approveContribution: adminProcedure.input(contributionReviewInput).mutation(({ ctx, input }) => approveContribution(ctx.user.id, input)),
    rejectContribution: adminProcedure.input(contributionRejectInput).mutation(({ ctx, input }) => rejectContribution(ctx.user.id, input)),
    activity: adminProcedure.query(() => listAuditEvents()),
    homepage: adminProcedure.query(() => getHomePageAdminData()),
    saveHomepageSettings: adminProcedure.input(homePageSettingsInput).mutation(({ ctx, input }) => saveHomePageSettings(ctx.user.id, input)),
    saveCategoryNames: adminProcedure.input(categoryNamesInput).mutation(({ ctx, input }) => saveCategoryNames(ctx.user.id, input)),
    saveCollection: adminProcedure.input(collectionWriteInput).mutation(({ ctx, input }) => saveCollection(ctx.user.id, input)),
  }),
});

export type AppRouter = typeof appRouter;
