import { parse as parseCookie } from "cookie";
import type { Request } from "express";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "../../shared/const";
import { ENV } from "./env";

export type CronIdentity = { openId: string; taskUid?: string };

function cronKey() {
  if (!ENV.cookieSecret) throw new Error("JWT_SECRET غير مضبوط.");
  return new TextEncoder().encode(ENV.cookieSecret);
}

/**
 * تحقق معزول لمسارات /api/scheduled فقط. لا يغيّر تدفق Google؛ فهو يقبل
 * هوية cron_ الموقعة من المنصة ويرفض أي جلسة مستخدم عادية أو طلب بلا جلسة.
 */
export async function authenticateCronRequest(req: Request): Promise<CronIdentity | null> {
  const token = parseCookie(req.headers.cookie ?? "")[COOKIE_NAME];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, cronKey(), { algorithms: ["HS256"] });
    const openId = typeof payload.openId === "string" ? payload.openId : "";
    if (!openId.startsWith("cron_")) return null;
    const taskUid = typeof payload.taskUid === "string" ? payload.taskUid : undefined;
    return { openId, taskUid };
  } catch {
    return null;
  }
}
