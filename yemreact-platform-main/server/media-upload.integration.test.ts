import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ processVideoUpload: vi.fn() }));

vi.mock("./videoProcessing", async importOriginal => {
  const actual = await importOriginal<typeof import("./videoProcessing")>();
  return { ...actual, processVideoUpload: mocks.processVideoUpload };
});

import { reactions } from "../drizzle/schema";
import { getDb } from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const validMp4Base64 = "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAANdbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAAHgAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAod0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAAHgAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAB4AAAEAAABAAAAAAH/bWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAyAAAABgBVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABqm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAWpzdGJsAAAAvnN0c2QAAAAAAAAAAQAAAK5hdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2MC4zMS4xMDIgbGliWDY0AAAAAAAAAAAAAAAAGP//AAAANGF2Y0MBZAAK/+EAF2dkAAqs2V7ARAAAAwAEAAADAMg8SJZYAQAGaOvjyyLA/fj4AAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAAL7iAAC+4gAAABhzdHRzAAAAAAAAAAEAAAADAAACAAAAABRzdHNzAAAAAAAAAAEAAAABAAAAKGN0dHMAAAAAAAAAAwAAAAEAAAQAAAAAAQAABgAAAAABAAACAAAAABxzdHNjAAAAAAAAAAEAAAABAAAAAwAAAAEAAAAgc3RzegAAAAAAAAAAAAAAAwAAAsUAAAAMAAAADAAAABRzdGNvAAAAAAAAAAEAAAONAAAAYnVkdGEAAABabWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAtaWxzdAAAACWpdG9vAAAAHWRhdGEAAAABAAAAAExhdmY2MC4xNi4xMDAAAAAIZnJlZQAAAuVtZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NCByMzEwOCAzMWUxOWY5IC0gSC4yNjQvTVBFRy00IEFWQyBjb3N5bGVmdCAyMDAwLTIwMjMgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWw=AAAAAA8liIQAM//9+uy+BTYU6MEAAAAIQZoibEK//7sAAAAAIAZ5BeQr/xIE";

function adminContext(): TrpcContext {
  return {
    user: { id: 99903, openId: "media-admin", name: "Media Admin", email: "media-admin@example.test", loginMethod: "test", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("admin.uploadMedia", () => {
  const caller = appRouter.createCaller(adminContext());
  let createdId: number | null = null;

  beforeEach(() => {
    mocks.processVideoUpload.mockReset();
    mocks.processVideoUpload.mockResolvedValue({
      original: { key: "reactions/test/tiny-source.mp4", url: "/manus-storage/reactions/test/tiny-source.mp4", storage: "managed" },
      processed: { key: "reactions/test/tiny-processed.mp4", url: "/manus-storage/reactions/test/tiny-processed.mp4", storage: "managed" },
      thumbnail: { key: "reactions/test/tiny-thumb.jpg", url: "/manus-storage/reactions/test/tiny-thumb.jpg", storage: "managed" },
      durationSeconds: 20, width: 1280, height: 720, videoCodec: "h264", audioCodec: "aac", processedSizeBytes: 2048, mimeType: "video/mp4",
    });
  });

  afterAll(async () => {
    const db = await getDb();
    if (db && createdId) await db.delete(reactions).where(eq(reactions.id, createdId));
  });

  it("ينشئ مسودة بلا كابشن ثم يرفع MP4 صالحًا ويعالجه العامل قبل حفظ البيانات والنشر", async () => {
    await caller.catalog.categories();
    const created = await caller.admin.createReactionDraft({ categoryId: "shock" });
    createdId = created.id;
    expect(created).toMatchObject({ status: "draft", quote: "مسودة بانتظار البيانات", mediaStatus: "missing" });

    const uploaded = await caller.admin.uploadMedia({ reactionId: created.id, fileName: "tiny.mp4", contentType: "video/mp4", dataBase64: validMp4Base64 });
    expect(uploaded).toMatchObject({ job: { reactionId: created.id, jobType: "reaction", status: "pending" }, reused: false });
    expect(mocks.processVideoUpload).not.toHaveBeenCalled();
    await expect(caller.admin.processNextVideoJob()).resolves.toMatchObject({ processed: true, reactionId: created.id, status: "ready" });
    expect(mocks.processVideoUpload).toHaveBeenCalledWith(
      expect.objectContaining({ storagePrefix: `reactions/${created.publicId}`, contentType: "video/mp4", fileName: "tiny.mp4" }),
      expect.objectContaining({ onStage: expect.any(Function) }),
    );

    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة للاختبار.");
    const [saved] = await db.select().from(reactions).where(eq(reactions.id, created.id)).limit(1);
    expect(saved).toMatchObject({ mediaStatus: "uploaded", mediaKey: "reactions/test/tiny-processed.mp4", mediaUrl: "/manus-storage/reactions/test/tiny-processed.mp4", mediaMimeType: "video/mp4", mediaOriginalName: "reaction.mp4", thumbnailUrl: "/manus-storage/reactions/test/tiny-thumb.jpg", processingStatus: "ready" });
    expect(saved?.sourceMediaKey).toMatch(new RegExp(`^reactions/${created.publicId}/original/`));
    expect(saved?.mediaSizeBytes).toBe(2048);
    expect(saved?.mediaUploadedAt).toBeInstanceOf(Date);

    const published = await caller.admin.updateReaction({
      id: created.id,
      data: { categoryId: "shock", status: "published", quote: "اختبار وسيط", situation: "لما نتحقق من رفع ملف", description: null, keywords: "اختبار رفع", durationSeconds: 20, corner: "tr", sourceName: "اختبار Vitest", sourceUrl: null, rightsStatus: "original", isTestData: true },
    });
    expect(published).toMatchObject({ status: "published", durationSeconds: 20 });
  });
});
