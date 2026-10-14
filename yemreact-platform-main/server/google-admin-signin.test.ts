import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const oauthMock = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
const dbMock = vi.hoisted(() => ({ upsertGoogleUser: vi.fn(), getUserByGoogleSub: vi.fn() }));

vi.mock("google-auth-library", () => ({ OAuth2Client: class { verifyIdToken = oauthMock.verifyIdToken; } }));
vi.mock("./db", () => dbMock);

import { getGoogleSessionUser, resolveGoogleRole, signInWithGoogleToken } from "./googleAuth";

describe("تسجيل دخول Google للمسؤول", () => {
  it("يعين admin للبريد المحدد والموثق فقط وينشئ جلسة مسؤول", async () => {
    const admin = {
      id: 9001,
      openId: "google:admin-sub",
      googleSub: "admin-sub",
      email: "hamdanaltawaf@gmail.com",
      emailVerified: true,
      name: "Hamdan",
      loginMethod: "google",
      role: "admin" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    expect(resolveGoogleRole("HAMDANALTAWAF@GMAIL.COM", true)).toBe("admin");
    expect(resolveGoogleRole("HAMDANALTAWAF@GMAIL.COM", false)).toBe("user");
    expect(resolveGoogleRole("person@example.test", true)).toBe("user");
    oauthMock.verifyIdToken.mockResolvedValueOnce({ getPayload: () => ({ sub: "admin-sub", email: "HAMDANALTAWAF@GMAIL.COM", name: "Hamdan", email_verified: true }) });
    dbMock.upsertGoogleUser.mockResolvedValueOnce(admin);
    dbMock.getUserByGoogleSub.mockResolvedValueOnce(admin);
    const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
    const request = { protocol: "https", headers: {} } as Request;
    const response = { cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }) } as Response;

    await expect(signInWithGoogleToken(request, response, "x".repeat(120))).resolves.toMatchObject({ role: "admin", email: "hamdanaltawaf@gmail.com" });
    expect(dbMock.upsertGoogleUser).toHaveBeenCalledWith(expect.objectContaining({ email: "hamdanaltawaf@gmail.com", emailVerified: true }));
    const sessionRequest = { headers: { cookie: `${cookies[0]?.name}=${cookies[0]?.value}` } } as Request;
    await expect(getGoogleSessionUser(sessionRequest)).resolves.toMatchObject({ role: "admin" });
  });
});
