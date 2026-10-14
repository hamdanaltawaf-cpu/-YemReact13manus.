import type { Request, Response } from "express";
import { getPublicReaction, listCategories, listPublicCollectionReactions } from "./yemreact";

type SeoMeta = { title: string; description: string; image: string; type: "website" | "video.other"; canonical: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function publicBaseUrl(req: Request) {
  const protocol = String(req.headers["x-forwarded-proto"] ?? req.protocol).split(",")[0].trim() || "https";
  const host = String(req.headers["x-forwarded-host"] ?? req.get("host") ?? "").split(",")[0].trim();
  return host ? `${protocol}://${host}` : "";
}

function absolute(baseUrl: string, url: string | null | undefined) {
  if (!url) return `${baseUrl}/og/yemreact.svg`;
  return /^https?:\/\//.test(url) ? url : `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function resolveSeoMeta(req: Request): Promise<SeoMeta> {
  const baseUrl = publicBaseUrl(req);
  const path = req.path.replace(/\/+$/, "") || "/";
  const fallback = { title: "YemReact — مكتبة رياكشنات يمنية", description: "مكتبة يمنية تساعدك تجد الرياكشن المناسب للموقف، مو بس باسم الشعور.", image: `${baseUrl}/og/yemreact.svg`, type: "website" as const, canonical: `${baseUrl}${path}` };
  const reactionMatch = path.match(/^\/r\/([^/]+)$/);
  if (reactionMatch) {
    const detail = await getPublicReaction(decodeURIComponent(reactionMatch[1]!));
    if (!detail) return fallback;
    const reaction = detail.reaction;
    return { title: `${reaction.quote} — YemReact`, description: reaction.description || reaction.situation || "رياكشن يمني من مكتبة YemReact.", image: absolute(baseUrl, reaction.thumbnailUrl), type: "video.other", canonical: `${baseUrl}/r/${encodeURIComponent(reaction.publicId)}` };
  }
  const categoryMatch = path.match(/^\/(?:category|categories)\/([^/]+)$/);
  if (categoryMatch) {
    const categories = await listCategories();
    const category = categories.find(item => item.id === decodeURIComponent(categoryMatch[1]!));
    if (!category) return fallback;
    return { ...fallback, title: `${category.name} — رياكشنات يمنية | YemReact`, description: `تصفح رياكشنات ${category.name} اليمنية المنتقاة حسب الموقف.`, canonical: `${baseUrl}/category/${encodeURIComponent(category.id)}` };
  }
  const collectionMatch = path.match(/^\/(?:collection|collections)\/([^/]+)$/);
  if (collectionMatch) {
    const collection = await listPublicCollectionReactions({ slug: decodeURIComponent(collectionMatch[1]!), limit: 1 });
    if (!collection) return fallback;
    return { ...fallback, title: `${collection.collection.title} — YemReact`, description: collection.collection.description || `مجموعة رياكشنات يمنية: ${collection.collection.title}.`, image: absolute(baseUrl, collection.reactions[0]?.thumbnailUrl), canonical: `${baseUrl}/collection/${encodeURIComponent(collection.collection.slug)}` };
  }
  return fallback;
}

export function injectSeoMeta(template: string, meta: SeoMeta) {
  const tags = `<title>${escapeHtml(meta.title)}</title><meta name="description" content="${escapeHtml(meta.description)}" /><link rel="canonical" href="${escapeHtml(meta.canonical)}" /><meta property="og:locale" content="ar_YE" /><meta property="og:site_name" content="YemReact" /><meta property="og:title" content="${escapeHtml(meta.title)}" /><meta property="og:description" content="${escapeHtml(meta.description)}" /><meta property="og:type" content="${meta.type}" /><meta property="og:url" content="${escapeHtml(meta.canonical)}" /><meta property="og:image" content="${escapeHtml(meta.image)}" /><meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="${escapeHtml(meta.title)}" /><meta name="twitter:description" content="${escapeHtml(meta.description)}" /><meta name="twitter:image" content="${escapeHtml(meta.image)}" />`;
  return template.replace(/<title>[\s\S]*?<\/title>/i, "").replace("</head>", `${tags}</head>`);
}

export function serveDefaultOpenGraphImage(_req: Request, res: Response) {
  res.set("Cache-Control", "public, max-age=86400").type("image/svg+xml").send(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><radialGradient id="g" cx="62%" cy="70%" r="70%"><stop stop-color="#c1592e" stop-opacity=".6"/><stop offset="1" stop-color="#121214"/></radialGradient></defs><rect width="1200" height="630" fill="#121214"/><rect width="1200" height="630" fill="url(#g)"/><text x="1060" y="150" fill="#f3eae0" font-size="48" font-family="Arial" text-anchor="end">يمن رياكت</text><text x="1060" y="330" fill="#f3eae0" font-size="96" font-family="Arial" text-anchor="end">دوّر على الرياكشن</text><text x="1060" y="430" fill="#e0824b" font-size="88" font-family="Arial" text-anchor="end">اللي يقول كلامك.</text><circle cx="104" cy="92" r="34" fill="#ff5a36"/></svg>`);
}
