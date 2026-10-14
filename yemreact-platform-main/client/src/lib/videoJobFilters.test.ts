import { describe, expect, it } from "vitest";
import { filterVideoJobs } from "./videoJobFilters";

const now = new Date("2026-08-18T12:00:00Z");
const jobs = [
  { id: 41, status: "failed" as const, jobType: "reaction" as const, createdAt: new Date("2026-08-18T09:00:00Z"), reactionPublicId: "YR-0041", reactionCaption: "اختبار رفع مسؤول", contributionTrackingCode: null, lastError: "تعذر الترميز" },
  { id: 42, status: "ready" as const, jobType: "contribution" as const, createdAt: new Date("2026-08-15T09:00:00Z"), reactionPublicId: null, reactionCaption: null, contributionTrackingCode: "YRC-0042", lastError: null },
  { id: 43, status: "pending" as const, jobType: "contribution" as const, createdAt: new Date("2026-07-10T09:00:00Z"), reactionPublicId: null, reactionCaption: null, contributionTrackingCode: "YRC-0043", lastError: null },
];

describe("فلاتر مهام الفيديو", () => {
  it("ترشح حسب الحالة والمصدر والفترة والنص معًا", () => {
    expect(filterVideoJobs(jobs, { status: "failed", source: "reaction", period: "today", search: "YR-0041" }, now).map(job => job.id)).toEqual([41]);
    expect(filterVideoJobs(jobs, { status: "all", source: "contribution", period: "7d", search: "yrc-0042" }, now).map(job => job.id)).toEqual([42]);
    expect(filterVideoJobs(jobs, { status: "all", source: "all", period: "30d", search: "" }, now).map(job => job.id)).toEqual([41, 42]);
  });
});
