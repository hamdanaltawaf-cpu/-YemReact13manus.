import { OAuth2Client } from "google-auth-library";
import { parse as parseCookie } from "cookie";
import type { Express, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../drizzle/schema";
import * as db from "./db";
import { ENV } from "./_core/env";
import { COOKIE_NAME } from "../shared/const";
import { normalizeGoogleEmail, resolveGoogleRole } from "../shared/googleRoles";

const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 14;
type GoogleSession = { userId: number; googleSub: string; email: string };

function sessionKey() {
  if (!ENV.cookieSecret) throw new Error("JWT_SECRET غير مضبوط.");
  return new TextEncoder().encode(ENV.cookieSecret);
}

function isSecureRequest(req: Request) {
  const forwarded = req.headers["x-forwarded-proto"];
  return req.protocol === "https" || forwarded === "https" || ENV.isProduction;
}

export function googleSessionCookieOptions(req: Request) {
  return { httpOnly: true, secure: isSecureRequest(req), sameSite: "lax" as const, path: "/" };
}

export function isAdminEmail(email: string, emailVerified = false) {
  return resolveGoogleRole(email, emailVerified) === "admin";
}

export { normalizeGoogleEmail, resolveGoogleRole };

export async function verifyGoogleIdToken(idToken: string) {
  if (!ENV.googleClientId) throw new Error("GOOGLE_CLIENT_ID غير مضبوط.");
  const client = new OAuth2Client(ENV.googleClientId);
  const ticket = await client.verifyIdToken({ idToken, audience: ENV.googleClientId });
  const payload = ticket.getPayload();
  const email = payload?.email ? normalizeGoogleEmail(payload.email) : "";
  const emailVerified = payload?.email_verified === true;

  if (!payload?.sub || !email) throw new Error("لم نتمكن من استخراج هوية Google أو البريد الإلكتروني.");
  return { googleSub: payload.sub, email, emailVerified, name: payload.name?.trim() || null };
}

export async function createGoogleSession(user: User) {
  if (!user.googleSub || !user.email) throw new Error("بيانات حساب Google غير مكتملة.");
  return new SignJWT({ userId: user.id, googleSub: user.googleSub, email: normalizeGoogleEmail(user.email) })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + SESSION_LIFETIME_MS) / 1000))
    .sign(sessionKey());
}

async function readGoogleSession(req: Request): Promise<GoogleSession | null> {
  const cookie = parseCookie(req.headers.cookie ?? "")[COOKIE_NAME];
  if (!cookie) return null;
  try {
    const { payload } = await jwtVerify(cookie, sessionKey(), { algorithms: ["HS256"] });
    const userId = payload.userId;
    const googleSub = payload.googleSub;
    const email = payload.email;
    if (typeof userId !== "number" || typeof googleSub !== "string" || typeof email !== "string") return null;
    return { userId, googleSub, email: normalizeGoogleEmail(email) };
  } catch {
    return null;
  }
}

export async function getGoogleSessionUser(req: Request): Promise<User | null> {
  const session = await readGoogleSession(req);
  if (!session) return null;
  const user = await db.getUserByGoogleSub(session.googleSub);
  if (!user || !user.email || normalizeGoogleEmail(user.email) !== session.email) return null;
  return user;
}

export async function signInWithGoogleToken(req: Request, res: Response, idToken: string) {
  const identity = await verifyGoogleIdToken(idToken);
  const user = await db.upsertGoogleUser(identity);
  const session = await createGoogleSession(user);
  res.cookie(COOKIE_NAME, session, { ...googleSessionCookieOptions(req), maxAge: SESSION_LIFETIME_MS });
  return user;
}

export function clearGoogleSession(req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, googleSessionCookieOptions(req));
}

export function registerGoogleRouteGuards(app: Express) {
  const requireAdmin = async (req: Request, res: Response, next: () => void) => {
    const user = await getGoogleSessionUser(req);
    if (!user || user.role !== "admin") {
      if (req.originalUrl.startsWith("/api/admin")) return res.status(403).json({ error: "forbidden" });
      return res.redirect(302, "/");
    }
    return next();
  };

  app.get(["/admin", "/admin.html"], requireAdmin);
  app.use("/api/admin", requireAdmin, (_req, res) => res.status(404).json({ error: "not_found" }));
}
