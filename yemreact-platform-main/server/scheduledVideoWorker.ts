import type { Request, Response } from "express";
import { authenticateCronRequest } from "./_core/cronAuth";
import { processQueuedVideoJobs } from "./videoQueue";

/** يعالج مهمة واحدة لكل نبضة لمنع تجاوز ذاكرة/مهلة الاستضافة الحالية. */
export async function runScheduledVideoWorker(req: Request, res: Response) {
  const cron = await authenticateCronRequest(req);
  if (!cron) return res.status(403).json({ error: "cron-only" });
  try {
    const jobs = await processQueuedVideoJobs(1);
    return res.json({ ok: true, taskUid: cron.taskUid ?? null, processed: jobs.length, job: jobs[0] ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message, context: { taskUid: cron.taskUid ?? null }, timestamp: new Date().toISOString() });
  }
}
