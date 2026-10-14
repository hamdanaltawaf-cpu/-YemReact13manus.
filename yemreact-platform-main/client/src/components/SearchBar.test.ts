import { describe, expect, it } from "vitest";
import { applySearchSuggestion, searchSuggestions } from "./SearchBar";

describe("اقتراحات شريط البحث", () => {
  it("تعرض قائمة موجزة وفريدة لتجنب تضخم قائمة البحث", () => {
    expect(searchSuggestions).toHaveLength(5);
    expect(new Set(searchSuggestions).size).toBe(searchSuggestions.length);
  });

  it("يملأ الاستعلام ويغلق الاقتراحات فور اختيار كبسولة", () => {
    const values: string[] = [];
    let closed = false;
    applySearchSuggestion("مصطفى المومري", value => values.push(value), () => { closed = true; });
    expect(values).toEqual(["مصطفى المومري"]);
    expect(closed).toBe(true);
  });
});
