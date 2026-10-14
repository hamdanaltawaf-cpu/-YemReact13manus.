import { ArrowLeft, FolderSearch2, GalleryHorizontalEnd } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { BrandMark } from "@/components/BrandMark";
import { CategoryTabs, type ContentTab } from "@/components/CategoryTabs";
import { ComingSoonOverlay, type DeferredSection } from "@/components/ComingSoonOverlay";
import { LibraryHeader, type LibrarySort } from "@/components/LibraryHeader";
import { ReactionCard } from "@/components/ReactionCard";
import { SearchBar } from "@/components/SearchBar";
import { trpc } from "@/lib/trpc";

function CatalogSkeleton() { return <div className="reaction-grid" aria-label="جارٍ تحميل المكتبة">{Array.from({ length: 8 }).map((_, index) => <div className="card-skeleton" key={index}><span /><i /><b /></div>)}</div>; }

export default function Home() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySort>("popular");
  const [contentTab, setContentTab] = useState<ContentTab>("all");
  const [lockedSection, setLockedSection] = useState<DeferredSection | null>(null);
  const hasQuery = Boolean(query.trim());
  const catalog = trpc.catalog.list.useInfiniteQuery({ query, limit: 24 }, { getNextPageParam: page => page.nextCursor ?? undefined });
  const recordSearchEvent = trpc.catalog.recordSearchEvent.useMutation();
  const lastSearchView = useRef("");
  const allReactions = useMemo(() => catalog.data?.pages.flatMap(page => page.reactions) ?? [], [catalog.data?.pages]);
  const visibleReactions = useMemo(() => [...allReactions].sort((left, right) => { if (sort === "latest") return Number(new Date(right.publishedAt ?? 0)) - Number(new Date(left.publishedAt ?? 0)); if (sort === "popular") return (right.viewCount + right.downloadCount) - (left.viewCount + left.downloadCount); return (right.searchScore ?? 0) - (left.searchScore ?? 0) || (right.viewCount + right.downloadCount) - (left.viewCount + left.downloadCount); }), [allReactions, sort]);
  useEffect(() => { if (hasQuery) setSort("relevance"); }, [hasQuery]);
  useEffect(() => { const first = visibleReactions[0]; const normalized = query.trim(); const key = `${normalized}:${visibleReactions.length}:${first?.publicId ?? ""}`; if (!normalized || catalog.isLoading || key === lastSearchView.current) return; lastSearchView.current = key; sessionStorage.setItem("yemreact:last-search-query", normalized); recordSearchEvent.mutate({ query: normalized, publicId: first?.publicId, eventType: "result_view", resultCount: visibleReactions.length }); }, [catalog.isLoading, query, visibleReactions]);
  const clearSearch = () => { setQuery(""); setSort("popular"); };
  const trackSearchOpen = (publicId: string) => { const normalized = query.trim(); if (normalized) recordSearchEvent.mutate({ query: normalized, publicId, eventType: "result_click", resultCount: visibleReactions.length }); };

  return <><main className="site-shell home-page home-page--refined" dir="rtl">
    <nav className="public-nav" aria-label="التنقل الرئيسي"><Link href="/" className="brand-lockup" aria-label="YemReact — الصفحة الرئيسية"><BrandMark size={31} /><span>يمن رياكت</span></Link><div className="nav-copy">مكتبة رياكشنات يمنية</div></nav>
    <section className="home-hero" aria-labelledby="home-title"><h1 id="home-title" className="font-heading">دوّر على الرياكشن<br /><em>اللي يقول كلامك.</em></h1><p>احكِ لنا الموقف كما صار، وخذ ردًا يمنيًا جاهزًا قبل ما يطول السوالف.</p><SearchBar query={query} resultCount={visibleReactions.length} onQueryChange={setQuery} onClear={clearSearch} /></section>
    <section className="catalog-section catalog-section--refined" id="library" aria-labelledby="catalog-title"><CategoryTabs value={contentTab} onChange={setContentTab} onLockedSection={setLockedSection} /><LibraryHeader hasQuery={hasQuery} sort={sort} onSortChange={setSort} />{contentTab === "images" ? <div className="empty-panel"><GalleryHorizontalEnd size={28} /><h3>قسم الصور في الطريق</h3><p>جهّزنا مكانه من الآن حتى يندمج مع نفس تجربة البحث عند إطلاقه.</p></div> : catalog.isLoading && !visibleReactions.length ? <CatalogSkeleton /> : catalog.isError ? <div className="empty-panel"><h3>تعذر تحميل المكتبة</h3><p>{catalog.error.message}</p><button type="button" className="outline-button" onClick={() => catalog.refetch()}>حاول مجددًا</button></div> : visibleReactions.length ? <><div className="reaction-grid">{visibleReactions.map(reaction => <ReactionCard key={reaction.publicId} reaction={reaction} onOpen={() => trackSearchOpen(reaction.publicId)} />)}</div>{catalog.hasNextPage && <div className="catalog-more"><button type="button" className="outline-button" disabled={catalog.isFetchingNextPage} onClick={() => void catalog.fetchNextPage()}>{catalog.isFetchingNextPage ? "جارٍ جلب لقطات جديدة…" : "عرض المزيد من المكتبة"}<ArrowLeft size={16} /></button><small>نُحمّل ما تحتاجه فقط، بلا إغراق أو وميض.</small></div>}</> : <div className="empty-panel"><FolderSearch2 size={28} /><h3>ما لقينا رياكشن يطابق بحثك</h3><p>سجّلنا الاستعلام لتحسين المكتبة لاحقًا.</p><button type="button" className="outline-button" onClick={clearSearch}>مسح الفلاتر</button></div>}</section>
    <footer className="public-footer public-footer--evolved"><div><BrandMark size={22} /><b>YemReact</b><span>خذها. حطها. يمنية.</span></div><nav aria-label="روابط التذييل"><a href="#library">المكتبة</a><Link href="/groups">المجموعات</Link></nav><small>مكتبة رياكشنات يمنية — {new Date().getFullYear()}</small></footer>
  </main>{lockedSection && <ComingSoonOverlay section={lockedSection} onClose={() => setLockedSection(null)} />}</>;
}
