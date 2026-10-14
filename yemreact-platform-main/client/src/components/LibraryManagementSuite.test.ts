import { describe, expect, it } from "vitest";
import { filterLibraryManagerItems, processingMeta } from "./LibraryManagementSuite";

const items = [
  { id: 1, publicId: "YR-01", quote: "قوية!", situation: "لما ينجح اختبار الرفع", status: "published" as const, processingStatus: "ready" },
  { id: 2, publicId: "YR-02", quote: "اختبار", situation: "لما نراجع المحتوى", status: "draft" as const, processingStatus: "pending" },
  { id: 3, publicId: "YR-03", quote: "قديم", situation: "أرشيف", status: "archived" as const, processingStatus: "failed" },
];

describe("شبكة إدارة المكتبة", () => {
  it("تفلتر بالحالة وتبحث في الكابشن والموقف والمعرّف", () => {
    expect(filterLibraryManagerItems(items, "", "published").map(item => item.id)).toEqual([1]);
    expect(filterLibraryManagerItems(items, "نراجع", "all").map(item => item.id)).toEqual([2]);
    expect(filterLibraryManagerItems(items, "YR-03", "all").map(item => item.id)).toEqual([3]);
  });

  it("يعرض دلالات المعالجة المناسبة", () => {
    expect(processingMeta("ready").label).toBe("جاهز");
    expect(processingMeta("failed").className).toBe("failed");
    expect(processingMeta("pending").className).toBe("pending");
  });
});
