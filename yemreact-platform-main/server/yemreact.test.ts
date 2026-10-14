import { describe, expect, it } from "vitest";
import { expandArabicQuery, MAX_REACTION_DURATION_SECONDS, normalizeArabic, reactionDraftInput, reactionWriteInput, scoreHybridSearch } from "./yemreact";

describe("normalizeArabic", () => {
  it("يوحد الحروف العربية الشائعة ويزيل التشكيل", () => {
    expect(normalizeArabic("إيش هٰذا؟")) .toBe("ايش هذا");
    expect(normalizeArabic("عاديّة  وأفكار")) .toBe("عاديه وافكار");
  });

  it("يزيل علامات الترقيم والمسافات المتكررة", () => {
    expect(normalizeArabic("  لما...  واحد، يكذب عليك! ")).toBe("لما واحد يكذب عليك");
  });
});

describe("مدة الرياكشن بعد المعالجة", () => {
  it("يقبل مدة 20 ثانية ولا يعيد حد 12 ثانية القديم", () => {
    const parsed = reactionWriteInput.parse({ categoryId: "hype", status: "draft", quote: "اختبار مدة", situation: "لما يكتمل فيديو مدته 20 ثانية", durationSeconds: 20, corner: "tr", rightsStatus: "original", isTestData: true });
    expect(parsed.durationSeconds).toBe(20);
    expect(MAX_REACTION_DURATION_SECONDS).toBe(60);
  });
});

describe("مسودة رفع الرياكشن", () => {
  it("تسمح ببدء رفع الفيديو قبل إدخال الكابشن وتقبل فئة اختيارية", () => {
    expect(reactionDraftInput.parse({})).toEqual({});
    expect(reactionDraftInput.parse({ categoryId: "shock" })).toEqual({ categoryId: "shock" });
  });
});

describe("البحث العربي الهجين", () => {
  it("يوسع مرادفات التطويل والكلام الكثير إلى سياق موحد", () => {
    const expanded = expandArabicQuery("يسولف كثير");
    expect(expanded).toContain("تطويل");
    expect(expanded).toContain("ملل");
    expect(expanded).toContain("سوالف");
  });

  it("يرفع صلة محسن البحث ويتحمل الخطأ الإملائي البسيط", () => {
    const optimized = scoreHybridSearch("ممطوط", { quote: "برضه؟", situation: "لما الواحد يطول في كلامه", searchOptimizer: "تطويل ملل رغي سوالف كثيرة" });
    const unrelated = scoreHybridSearch("ممطوط", { quote: "يا ساتر", situation: "خبر مفاجئ", searchOptimizer: "صدمة مفاجأة" });
    const typoTolerant = scoreHybridSearch("ممل", { quote: "برضه؟", situation: "كلام طويل", searchOptimizer: "ملل تطويل" });
    expect(optimized).toBeGreaterThan(unrelated);
    expect(optimized).toBeGreaterThan(0);
    expect(typoTolerant).toBeGreaterThan(0);
  });
});
