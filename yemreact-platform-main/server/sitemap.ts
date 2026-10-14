import type { Request, Response } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { categories, collections, reactions } from "../drizzle/schema";
import { getDb } from "./db";

function xmlEscape(value: string) {
  return value.replace(/[<>&'\"]/g, character => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[character] ?? character);
}

function publicBaseUrl(req: Request) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? req.protocol).split(",")[0].trim() || "https";
  const host = String(req.headers["x-forwarded-host"] ?? req.get("host") ?? "").split(",")[0].trim();
  return host ? `${forwardedProto}://${host}` : "";
}

export async function buildPublicSitemap(baseUrl: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  const [allCategories, publishedCollections, publishedReactions] = await Promise.all([
    db.select({ id: categories.id }).from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder)),
    db.select({ slug: collections.slug, updatedAt: collections.updatedAt }).from(collections).where(eq(collections.status, "published")).orderBy(asc(collections.sortOrder)),
    db.select({ publicId: reactions.publicId, updatedAt: reactions.updatedAt }).from(reactions).where(eq(reactions.status, "published")).orderBy(desc(reactions.updatedAt)),
  ]);
  const urls = [
    { path: "/", lastModified: null },
    ...allCategories.map(category => ({ path: `/categories/${encodeURIComponent(category.id)}`, lastModified: null })),
    ...publishedCollections.map(collection => ({ path: `/collections/${encodeURIComponent(collection.slug)}`, lastModified: collection.updatedAt })),
    ...publishedReactions.map(reaction => ({ path: `/r/${encodeURIComponent(reaction.publicId)}`, lastModified: reaction.updatedAt })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `  <url><loc>${xmlEscape(`${baseUrl}${url.path}`)}</loc>${url.lastModified ? `<lastmod>${url.lastModified.toISOString()}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>`;
}

export async function servePublicSitemap(req: Request, res: Response) {
  try {
    const xml = await buildPublicSitemap(publicBaseUrl(req));
    res.set({
      "Cache-Control": "public, max-age=0, s-maxage=60, must-revalidate",
      Vary: "Host, X-Forwarded-Host, X-Forwarded-Proto",
    });
    return res.status(200).type("application/xml").send(xml);
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر توليد sitemap.";
    return res.status(500).type("application/xml").send(`<?xml version="1.0"?><error>${xmlEscape(message)}</error>`);
  }
}
