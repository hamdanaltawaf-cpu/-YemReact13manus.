import { describe, expect, it } from "vitest";
import { categoryIconFor, trendingKeywords, visibleTrendingKeywords } from "./DiscoveryHub";

describe("محور الاكتشاف", () => {
  it("يحافظ على اقتراحات الرواج ضمن المجال من اثنين إلى خمسة", () => {
    expect(trendingKeywords).toContain("#تعز");
    expect(visibleTrendingKeywords()).toHaveLength(5);
    expect(visibleTrendingKeywords(["كلمة واحدة"])).toHaveLength(5);
  });

  it("يعيد أيقونة آمنة حتى للتصنيفات غير المعروفة", () => {
    expect(categoryIconFor("hype")).toBeDefined();
    expect(categoryIconFor("unknown")).toBeDefined();
    expect(categoryIconFor("unknown")).toBe(categoryIconFor("unknown"));
  });
});
