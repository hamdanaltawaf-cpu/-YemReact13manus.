import { describe, expect, it } from "vitest";
import { injectSeoMeta, resolveSeoMeta } from "./seo";
import { listCategories } from "./yemreact";

function requestFor(path: string) {
  return { path, protocol: "https", headers: { "x-forwarded-host": "yemreact.test", "x-forwarded-proto": "https" }, get: () => "ignored.test" } as never;
}

describe("بيانات Open Graph للاكتشاف", () => {
  it("تنتج عنواناً ووصفاً وصورة ورابطاً دائماً لرياكشن منشور", async () => {
    const meta = await resolveSeoMeta(requestFor("/r/YR-0001"));
    expect(meta).toMatchObject({ type: "video.other", canonical: "https://yemreact.test/r/YR-0001" });
    expect(meta.title).toContain("YemReact");
    expect(injectSeoMeta("<html><head></head><body></body></html>", meta)).toContain('property="og:image"');
  });

  it("يدعم روابط التصنيف والمجموعة المفردة للمشاركة والفهرسة", async () => {
    await listCategories();
    const [category, collection] = await Promise.all([resolveSeoMeta(requestFor("/category/shock")), resolveSeoMeta(requestFor("/collection/group-replies"))]);
    expect(category.canonical).toBe("https://yemreact.test/category/shock");
    expect(collection.canonical).toBe("https://yemreact.test/collection/group-replies");
  });
});
