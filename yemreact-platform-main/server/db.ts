import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { normalizeGoogleEmail, resolveGoogleRole } from "../shared/googleRoles";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByGoogleSub(googleSub: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.googleSub, googleSub)).limit(1);
  return rows[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0];
}

export async function upsertGoogleUser(identity: { googleSub: string; email: string; emailVerified: boolean; name: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const email = normalizeGoogleEmail(identity.email);
  const role = resolveGoogleRole(email, identity.emailVerified);
  const existing = (await getUserByGoogleSub(identity.googleSub)) ?? (await getUserByEmail(email));
  if (existing) {
    await db.update(users).set({ googleSub: identity.googleSub, email, emailVerified: identity.emailVerified, name: identity.name, loginMethod: "google", role, lastSignedIn: new Date() }).where(eq(users.id, existing.id));
    const [updated] = await db.select().from(users).where(eq(users.id, existing.id)).limit(1);
    if (!updated) throw new Error("تعذر تحديث المستخدم.");
    return updated;
  }
  await db.insert(users).values({ openId: `google:${identity.googleSub}`, googleSub: identity.googleSub, email, emailVerified: identity.emailVerified, name: identity.name, loginMethod: "google", role, lastSignedIn: new Date() });
  const created = await getUserByGoogleSub(identity.googleSub);
  if (!created) throw new Error("تعذر إنشاء المستخدم.");
  return created;
}

// TODO: add feature queries here as your schema grows.
