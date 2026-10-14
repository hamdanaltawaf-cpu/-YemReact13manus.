import { ArrowLeft, FolderKanban } from "lucide-react";
import { Link } from "wouter";
import { BrandMark } from "@/components/BrandMark";
import { trpc } from "@/lib/trpc";

export default function Groups() {
  const collections = trpc.catalog.collections.useQuery();

  return <main className="site-shell groups-page" dir="rtl">
    <nav className="public-nav" aria-label="التنقل الرئيسي">
      <Link href="/" className="brand-lockup" aria-label="YemReact — الصفحة الرئيسية"><BrandMark size={31} /><span>يمن رياكت</span></Link>
      <Link href="/" className="nav-copy">العودة للمكتبة</Link>
    </nav>
    <section className="groups-page__hero" aria-labelledby="groups-title">
      <span><FolderKanban size={15} /> تجميعات YemReact</span>
      <h1 id="groups-title" className="font-heading">المجموعات</h1>
      <p>ادخل من الباب الذي يناسب موقفك، ثم استعرض الرياكشنات داخل كل تجميعة.</p>
    </section>
    <section aria-label="كل المجموعات">
      {collections.isLoading ? <div className="groups-grid" aria-label="جارٍ تحميل المجموعات">{Array.from({ length: 6 }).map((_, index) => <div className="collection-loading groups-page__skeleton" key={index} />)}</div> : collections.isError ? <div className="empty-panel"><FolderKanban size={28} /><h2>تعذر تحميل المجموعات</h2><p>حاول تحديث الصفحة بعد قليل.</p><button type="button" className="outline-button" onClick={() => collections.refetch()}>حاول مجددًا</button></div> : collections.data?.length ? <div className="groups-grid">{collections.data.map(collection => <Link href={`/collection/${collection.slug}`} className="groups-card" key={collection.id}><BrandMark size={26} tone="paper" /><div><small>{collection.isTestData ? "بيانات اختبار" : "مجموعة YemReact"}</small><h2>{collection.title}</h2><p>{collection.description}</p></div><ArrowLeft size={19} /></Link>)}</div> : <div className="empty-panel"><FolderKanban size={28} /><h2>لا توجد مجموعات منشورة بعد</h2><Link href="/" className="outline-button">تصفح المكتبة</Link></div>}
    </section>
  </main>;
}
