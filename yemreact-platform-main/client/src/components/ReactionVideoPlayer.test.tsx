import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatTime, ReactionVideoPlayer } from "./ReactionVideoPlayer";

describe("مشغل فيديو الرياكشن", () => {
  it("يعرض توقيتًا سليمًا وتحكمات التشغيل والصوت وملء الشاشة", () => {
    expect(formatTime(63.2)).toBe("1:03");
    expect(formatTime(Number.NaN)).toBe("0:00");
    const markup = renderToStaticMarkup(<ReactionVideoPlayer src="/video.mp4" poster="/thumb.jpg" label="مالك دخل" />);
    expect(markup).toContain('aria-label="مشغل فيديو: مالك دخل"');
    expect(markup).toContain('aria-label="تقدم الفيديو"');
    expect(markup).toContain('aria-label="تشغيل"');
    expect(markup).toContain('aria-label="ملء الشاشة"');
  });
});
