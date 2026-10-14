import { describe, expect, it } from "vitest";
import { getCollectionDraftErrors, normalizeCollectionSlug } from "./HomepageAdminSuite";

describe("تحقق محرر الصفحة الرئيسية", () => {
  it("ينظف الرابط المختصر إلى صيغة URL آمنة", () => {
    expect(normalizeCollectionSlug(" Weekly Reactions!! 2026 ")).toBe("weekly-reactions-2026");
    expect(normalizeCollectionSlug("###")).toBe("");
  });

  it("يرفض العنوان أو الرابط أو الترتيب غير الصالح قبل الحفظ", () => {
    expect(getCollectionDraftErrors({ id: null, slug: "x", title: "", description: "", status: "draft", sortOrder: "-1" })).toMatchObject({ slug: expect.any(String), title: expect.any(String), sortOrder: expect.any(String) });
    expect(getCollectionDraftErrors({ id: null, slug: "weekly-reactions", title: "ردود القروبات", description: "", status: "published", sortOrder: "2" })).toEqual({});
  });
});
