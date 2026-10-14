import { describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import { SignJWT } from "jose";
import { COOKIE_NAME } from "../shared/const";
import { authenticateCronRequest } from "./_core/cronAuth";
import { runScheduledVideoWorker } from "./scheduledVideoWorker";

function signedCookie(payload: Record<string, unknown>) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET مطلوب لاختبار العامل الدوري.");
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(new TextEncoder().encode(secret));
}

describe("مصادقة عامل فيديو Heartbeat", () => {
  it("تقبل هوية cron_ الموقعة وترفض جلسة المستخدم العادية", async () => {
    const cronToken = await signedCookie({ openId: "cron_video_worker", taskUid: "task-video-worker" });
    const cronRequest = { headers: { cookie: `${COOKIE_NAME}=${cronToken}` } } as Request;
    await expect(authenticateCronRequest(cronRequest)).resolves.toEqual({ openId: "cron_video_worker", taskUid: "task-video-worker" });

    const userToken = await signedCookie({ userId: 1, googleSub: "reader", email: "reader@example.test" });
    const userRequest = { headers: { cookie: `${COOKIE_NAME}=${userToken}` } } as Request;
    await expect(authenticateCronRequest(userRequest)).resolves.toBeNull();
  });

  it("يرفض مسار العامل الطلب بلا هوية cron", async () => {
    let statusCode = 200;
    let payload: unknown;
    const response = {
      status: (code: number) => { statusCode = code; return response; },
      json: (value: unknown) => { payload = value; return response; },
    } as unknown as Response;
    await runScheduledVideoWorker({ headers: {} } as Request, response);
    expect(statusCode).toBe(403);
    expect(payload).toEqual({ error: "cron-only" });
  });
});
