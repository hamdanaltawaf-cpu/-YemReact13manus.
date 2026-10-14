import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { ReactionCard } from "./ReactionCard";

describe("اسم التصنيف في بطاقة الرياكشن", () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, "location", { configurable: true, value: new URL("https://yemreact.example/") });
  });

  it("يعرض الاسم المعدل للتصنيف داخل بطاقة المكتبة", () => {
    const markup = renderToStaticMarkup(
      <ReactionCard
        reaction={{ id: 1, publicId: "YR-CATEGORY", categoryId: "laugh", categoryName: "ضحك ومزاح", categoryColor: "#F0A13A", quote: "ياخي وربي", situation: "موقف طريف", durationSeconds: 3, corner: "tr", isTestData: false }}
      />,
    );
    expect(markup).toContain("ضحك ومزاح");
    expect(markup).toContain('aria-label="ضحك ومزاح"');
  });
});
