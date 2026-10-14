import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SearchAnalyticsTimeline } from "./SearchAnalyticsTimeline";

describe("الرسم الزمني لتحليلات البحث", () => {
  it("يعرض مقاييس البحث والنقر والحفظ واتجاهها باللغة العربية", () => {
    const markup = renderToStaticMarkup(<SearchAnalyticsTimeline timeline={[
      { date: "2026-08-17", searches: 2, clicks: 1, saves: 0 },
      { date: "2026-08-18", searches: 5, clicks: 3, saves: 2 },
    ]} />);
    expect(markup).toContain("اتجاه تفاعل البحث");
    expect(markup).toContain("عمليات البحث");
    expect(markup).toContain("النقرات");
    expect(markup).toContain("عمليات الحفظ");
    expect(markup).toContain("اتجاه صاعد");
  });
});
