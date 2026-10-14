import { describe, expect, it, vi } from "vitest";
import { listCategories } from "./yemreact";
import { buildPublicSitemap, servePublicSitemap } from "./sitemap";

describe("sitemap العامة", () => {
  it("تولد XML للصفحات المفهرسة فقط من البيانات المنشورة", async () => {
    await listCategories();
    const xml = await buildPublicSitemap("https://yemreact.example");

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("https://yemreact.example/");
    expect(xml).toContain("https://yemreact.example/categories/shock");
    expect(xml).toContain("https://yemreact.example/r/YR-0001");
    expect(xml).not.toContain("/account");
    expect(xml).not.toContain("/admin");
  });

  it("تستخرج النطاق العام من الطلب وتطلب إعادة التحقق من sitemap خلال دقيقة", async () => {
    await listCategories();
    const response = {
      set: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
    await servePublicSitemap({ protocol: "https", headers: { "x-forwarded-host": "public.yemreact.test", "x-forwarded-proto": "https" }, get: () => "ignored.test" } as never, response as never);
    expect(response.set).toHaveBeenCalledWith(expect.objectContaining({ "Cache-Control": "public, max-age=0, s-maxage=60, must-revalidate" }));
    expect(response.send).toHaveBeenCalledWith(expect.stringContaining("https://public.yemreact.test/r/YR-0001"));
  });
});
