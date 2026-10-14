import { describe, expect, it } from "vitest";
import { filterAdminActivity, filterAdminContributions, filterAdminLibrary } from "./adminViewFilters";

describe("فلاتر عرض الإدارة", () => {
  it("تبحث في المكتبة وتطبق حالة النشر دون تعديل البيانات", () => {
    const rows = [{ status: "published", publicId: "YR-10", quote: "قوية!", situation: "لما تنجح", id: 1 }, { status: "draft", publicId: "YR-11", quote: "تمام", situation: "لما تتفق", id: 2 }];
    expect(filterAdminLibrary(rows, "تنجح", "all").map(row => row.id)).toEqual([1]);
    expect(filterAdminLibrary(rows, "", "draft").map(row => row.id)).toEqual([2]);
  });

  it("تفلتر المساهمات وسجل النشاط محليًا", () => {
    expect(filterAdminContributions([{ status: "pending" }, { status: "approved" }], "pending")).toHaveLength(1);
    expect(filterAdminActivity([{ action: "approved", actorName: "المسؤول" }, { action: "submitted", actorEmail: "user@example.test" }], "user@")).toHaveLength(1);
  });
});
