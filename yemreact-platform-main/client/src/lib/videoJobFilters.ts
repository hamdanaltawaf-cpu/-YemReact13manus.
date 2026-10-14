export type VideoJobStatus = "pending" | "processing" | "ready" | "failed" | "cancelled";
export type VideoJobSource = "reaction" | "contribution";
export type JobStatusFilter = "all" | VideoJobStatus;
export type JobSourceFilter = "all" | VideoJobSource;
export type JobPeriodFilter = "all" | "today" | "7d" | "30d";

export type FilterableVideoJob = {
  id: number;
  status: VideoJobStatus;
  jobType: VideoJobSource;
  createdAt: Date | string;
  reactionPublicId: string | null;
  reactionCaption: string | null;
  contributionTrackingCode: string | null;
  lastError: string | null;
  attempts: number;
  maxAttempts: number;
  updatedAt: Date | string;
};

export function jobPeriodStart(period: JobPeriodFilter, now = new Date()) {
  if (period === "all") return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (period === "today" ? 0 : period === "7d" ? 6 : 29));
  return start;
}

export function filterVideoJobs<T extends FilterableVideoJob>(jobs: T[], filters: { status: JobStatusFilter; source: JobSourceFilter; period: JobPeriodFilter; search: string }, now = new Date()) {
  const normalizedSearch = filters.search.trim().toLocaleLowerCase("ar-YE");
  const start = jobPeriodStart(filters.period, now);
  return jobs.filter(job => {
    if (filters.status !== "all" && job.status !== filters.status) return false;
    if (filters.source !== "all" && job.jobType !== filters.source) return false;
    if (start && new Date(job.createdAt) < start) return false;
    if (!normalizedSearch) return true;
    const haystack = [job.id, job.reactionPublicId, job.reactionCaption, job.contributionTrackingCode, job.lastError].filter(Boolean).join(" ").toLocaleLowerCase("ar-YE");
    return haystack.includes(normalizedSearch);
  });
}
