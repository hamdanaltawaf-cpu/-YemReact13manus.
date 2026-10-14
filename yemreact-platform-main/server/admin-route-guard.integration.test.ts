import { createServer, type Server } from "node:http";
import express from "express";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { users } from "../drizzle/schema";
import { createGoogleSession, registerGoogleRouteGuards } from "./googleAuth";
import { getDb, upsertGoogleUser } from "./db";

describe("admin route guards", () => {
  let server: Server;
  let baseUrl = "";
  let adminCookie = "";
  let userId: number | null = null;

  beforeAll(async () => {
    const app = express();
    registerGoogleRouteGuards(app);
    app.get("/admin", (_req, res) => res.status(200).send("admin-ok"));
    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("تعذر بدء خادم الاختبار.");
    baseUrl = `http://127.0.0.1:${address.port}`;

    const user = await upsertGoogleUser({ googleSub: `guard-${Date.now()}`, email: `guard-${Date.now()}@example.test`, name: "مسؤول اختبار" });
    userId = user.id;
    const db = await getDb();
    if (!db) throw new Error("قاعدة البيانات غير متاحة للاختبار.");
    await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
    const [admin] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    adminCookie = `app_session_id=${await createGoogleSession(admin!)}`;
  });

  afterAll(async () => {
    server?.close();
    const db = await getDb();
    if (db && userId) await db.delete(users).where(eq(users.id, userId));
  });

  it("يعيد الزائر من /admin.html ويمنع /api/admin بطلب 403", async () => {
    const page = await fetch(`${baseUrl}/admin.html`, { redirect: "manual" });
    expect(page.status).toBe(302);
    expect(page.headers.get("location")).toBe("/");
    const api = await fetch(`${baseUrl}/api/admin/reactions`);
    expect(api.status).toBe(403);
  });

  it("يسمح لجلسة مسؤول موثقة بفتح /admin", async () => {
    const response = await fetch(`${baseUrl}/admin`, { headers: { cookie: adminCookie }, redirect: "manual" });
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("admin-ok");
  });
});
