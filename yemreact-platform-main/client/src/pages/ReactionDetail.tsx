import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowRight, Bookmark, BookmarkCheck, Copy, Download, Share2 } from "lucide-react";
import { ReactionCard } from "@/components/ReactionCard";
import { ReactionVideoPlayer } from "@/components/ReactionVideoPlayer";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

function DetailSkeleton() {
  return <div className="detail-skeleton" aria-label="جارٍ تحميل تفاصيل الرياكشن"><span /><span /><span /></div>;
}

export default function ReactionDetail() {
  const [, params] = useRoute<{ publicId: string }>("/r/:publicId");
  const detail = trpc.catalog.detail.useQuery({ publicId: params?.publicId ?? "" }, { enabled: Boolean(params?.publicId) });
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const saved = trpc.account.saved.useQuery(undefined, { enabled: Boolean(user) });
  const saveFolders = trpc.account.saveFolders.useQuery(undefined, { enabled: Boolean(user) });
  const toggleSave = trpc.account.toggleSave.useMutation({ onSuccess: () => utils.account.saved.invalidate() });
  const recordEngagement = trpc.catalog.recordEngagement.useMutation();
  const recordSearchEvent = trpc.catalog.recordSearchEvent.useMutation();
  const recordShare = trpc.catalog.recordShare.useMutation();
  const recordRecentView = trpc.account.recordRecentView.useMutation();
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [selectedFolderId, setSelectedFolderId] = useState<number | undefined>();
  useEffect(() => {
    const publicId = detail.data?.reaction.publicId;
    if (publicId) recordEngagement.mutate({ publicId, kind: "view" });
  }, [detail.data?.reaction.publicId]);
  useEffect(() => {
    const publicId = detail.data?.reaction.publicId;
    if (user && publicId) recordRecentView.mutate({ publicId });
  }, [detail.data?.reaction.publicId, user?.id]);
  useEffect(() => {
    if (!selectedFolderId && saveFolders.data?.[0]) setSelectedFolderId(saveFolders.data[0].id);
  }, [saveFolders.data, selectedFolderId]);

  if (detail.isLoading) return <main className="site-shell detail-page"><DetailSkeleton /></main>;

  if (detail.isError) {
    return (
      <main className="site-shell detail-page empty-panel">
        <h1>تعذر الوصول إلى الرياكشن</h1>
        <p>{detail.error.message}</p>
        <Link href="/" className="text-link"><ArrowRight size={17} /> العودة إلى المكتبة</Link>
      </main>
    );
  }

  if (!detail.data) {
    return (
      <main className="site-shell detail-page empty-panel">
        <h1>هذا الرياكشن غير متاح</h1>
        <p>قد يكون مؤرشفًا أو أن الرابط غير صحيح.</p>
        <Link href="/" className="text-link"><ArrowRight size={17} /> العودة إلى المكتبة</Link>
      </main>
    );
  }

  const { reaction, nearby } = detail.data;
  const isSaved = saved.data?.some(item => item.publicId === reaction.publicId) ?? false;
  const shareUrl = typeof window === "undefined" ? `/r/${reaction.publicId}` : window.location.href;
  const shareText = `${reaction.quote} — YemReact`;
  const lastSearchQuery = typeof window === "undefined" ? "" : sessionStorage.getItem("yemreact:last-search-query")?.trim() ?? "";
  const saveReaction = () => {
    toggleSave.mutate({ publicId: reaction.publicId, folderId: isSaved ? undefined : selectedFolderId });
    if (!isSaved && lastSearchQuery) recordSearchEvent.mutate({ query: lastSearchQuery, publicId: reaction.publicId, eventType: "save" });
  };
  const trackShare = (source: "whatsapp" | "telegram" | "x" | "copy") => recordShare.mutate({ publicId: reaction.publicId, source });
  const copyShareLink = async () => {
    trackShare("copy");
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  };
  return (
    <main className="site-shell detail-page">
      <header className="detail-nav">
        <Link href="/" className="back-link"><ArrowRight size={17} /> المكتبة</Link>
        {reaction.isTestData && <span className="test-banner">نسخة معاينة — بيانات اختبار داخلية</span>}
      </header>

      <section className="detail-hero">{reaction.mediaUrl ? <ReactionVideoPlayer src={reaction.mediaUrl} poster={reaction.thumbnailUrl} label={reaction.quote} /> : <div className="reaction-player reaction-player--unavailable"><div><span className="category-dot" style={{ background: reaction.categoryColor }} /><p>لا توجد معاينة فيديو عامة لهذا الرياكشن بعد.</p></div></div>}</section>
      <section className="detail-actions" aria-label="حفظ ومشاركة الرياكشن"><div className="detail-save-row">{user ? <span className="detail-save-controls">{!isSaved && <select value={selectedFolderId ?? ""} onChange={event => setSelectedFolderId(event.target.value ? Number(event.target.value) : undefined)} aria-label="اختر مجلد الحفظ">{saveFolders.data?.map(folder => <option value={folder.id} key={folder.id}>{folder.name}</option>)}</select>}<button type="button" className="outline-button" disabled={toggleSave.isPending || (!isSaved && !selectedFolderId)} onClick={saveReaction}>{isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}{toggleSave.isPending ? "جارٍ التحديث…" : isSaved ? "إزالة من المحفوظات" : "حفظ الرياكشن"}</button></span> : <div className="detail-signin"><span>افتح القائمة في أعلى اليسار ثم سجّل دخولك لحفظ هذا الرياكشن.</span></div>}<span className="detail-share" aria-label="مشاركة الرياكشن"><Share2 size={15} /><a onClick={() => trackShare("whatsapp")} href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`} target="_blank" rel="noreferrer">واتساب</a><a onClick={() => trackShare("telegram")} href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">تيليغرام</a><a onClick={() => trackShare("x")} href={`https://x.com/intent/post?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`} target="_blank" rel="noreferrer">إكس</a><button type="button" className="detail-copy-link" onClick={copyShareLink}><Copy size={13} /> {copyStatus === "copied" ? "تم النسخ" : copyStatus === "error" ? "تعذر النسخ" : "نسخ الرابط"}</button></span></div>{reaction.mediaUrl ? <a className="detail-download-link" href={reaction.mediaUrl} download onClick={() => recordEngagement.mutate({ publicId: reaction.publicId, kind: "download" })}><Download size={15} /> تنزيل الرياكشن</a> : <div className="detail-notice">لا توجد معاينة فيديو عامة لهذا الرياكشن بعد.</div>}</section>

      <section className="nearby-section" aria-labelledby="nearby-title">
        <div className="section-heading"><span>من نفس السياق</span><h2 id="nearby-title">رياكشنات قريبة</h2></div>
        {nearby.length ? <div className="nearby-grid">{nearby.map(item => <ReactionCard key={item.publicId} reaction={item} compact />)}</div> : <p className="inline-empty">ستظهر هنا عناصر إضافية من الفئة نفسها عند إضافة المكتبة.</p>}
      </section>
    </main>
  );
}
