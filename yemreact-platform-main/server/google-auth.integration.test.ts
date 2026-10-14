import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

const oauthMock = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    verifyIdToken = oauthMock.verifyIdToken;
  },
}));

import { reactionSaves, users } from "../drizzle/schema";
import { getDb, upsertGoogleUser } from "./db";
import { listSavedReactions, toggleReactionSave } from "./account";
import { createGoogleSession, getGoogleSessionUser, isAdminEmail, normalizeGoogleEmail, resolveGoogleRole, signInWithGoogleToken, verifyGoogleIdToken } from "./googleAuth";
import type { Request, Response } from "express";

describe("Google auth and account", () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const googleSub = `test-google-${suffix}`;
  const email = `reader-${suffix}@example.test`;
  let userId: number | null = null;

  afterAll(async () => {
    const db = await getDb();
    if (!db || !userId) return;
    await db.delete(reactionSaves).where(eq(reactionSaves.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  it("يطبع البريد ويمنح admin للبريد المحدد فقط عندما تؤكد Google تحقق البريد", () => {
    expect(normalizeGoogleEmail("  HAMDANALTAWAF@GMAIL.COM ")).toBe("hamdanaltawaf@gmail.com");
    expect(isAdminEmail("HAMDANALTAWAF@GMAIL.COM", true)).toBe(true);
    expect(isAdminEmail("HAMDANALTAWAF@GMAIL.COM", false)).toBe(false);
    expect(isAdminEmail("other@gmail.com", true)).toBe(false);
    expect(resolveGoogleRole("HAMDANALTAWAF@GMAIL.COM", true)).toBe("admin");
    expect(resolveGoogleRole("HAMDANALTAWAF@GMAIL.COM", false)).toBe("user");
    expect(resolveGoogleRole("reader@example.test", true)).toBe("user");
  });

  it("يقبل Google ID Token لبريد عادي حتى عند غياب علامة email_verified ويحتفظ بحالتها", async () => {
    oauthMock.verifyIdToken.mockResolvedValueOnce({ getPayload: () => ({ sub: "google-sub", email: " Reader@Example.Test ", name: "قارئ", email_verified: true }) });
    await expect(verifyGoogleIdToken("x".repeat(120))).resolves.toEqual({ googleSub: "google-sub", email: "reader@example.test", emailVerified: true, name: "قارئ" });
    oauthMock.verifyIdToken.mockResolvedValueOnce({ getPayload: () => ({ sub: "google-sub", email: "reader@example.test", email_verified: false }) });
    await expect(verifyGoogleIdToken("x".repeat(120))).resolves.toEqual({ googleSub: "google-sub", email: "reader@example.test", emailVerified: false, name: null });
  });

  it("يسجل دخول حساب Google عادي بدور user وينشئ جلسة ثم يتيح حفظ الرياكشن وإزالته", async () => {
    const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    oauthMock.verifyIdToken.mockResolvedValueOnce({ getPayload: () => ({ sub: googleSub, email, name: "قارئ اختبار", email_verified: false }) });
    const request = { protocol: "https", headers: {} } as Request;
    const response = { cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }) } as Response;
    const user = await signInWithGoogleToken(request, response, "x".repeat(120));
    userId = user.id;
    expect(user.role).toBe("user");
    expect(user.emailVerified).toBe(false);
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax" });
    const sessionRequest = { headers: { cookie: `${cookies[0]?.name}=${cookies[0]?.value}` } } as Request;
    await expect(getGoogleSessionUser(sessionRequest)).resolves.toMatchObject({ id: user.id, email, googleSub, role: "user" });

    await expect(toggleReactionSave(user.id, "YR-0001")).resolves.toEqual({ saved: true });
    await expect(listSavedReactions(user.id)).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ publicId: "YR-0001" })]));
    await expect(toggleReactionSave(user.id, "YR-0001")).resolves.toEqual({ saved: false });
  });
});
