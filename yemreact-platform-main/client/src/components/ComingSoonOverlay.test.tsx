import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ComingSoonOverlay, comingSoonCopy } from "./ComingSoonOverlay";

describe("طبقة الأقسام المؤجلة", () => {
  it("تعرض قفلاً وحوارًا حاجبًا للقسم المؤجل", () => {
    expect(comingSoonCopy.images.title).toBe("قسم الصور");
    const markup = renderToStaticMarkup(<ComingSoonOverlay section="people" onClose={vi.fn()} />);
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("قريباً");
    expect(markup).toContain("قسم الشخصيات مقفل حالياً");
  });
});
