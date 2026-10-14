import { Link, useParams } from "wouter";
import { FolderSearch2 } from "lucide-react";
import { ReactionCard } from "@/components/ReactionCard";
import { trpc } from "@/lib/trpc";

export default function CategoryArchive() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const categories = trpc.catalog.categories.useQuery();
  const category = categories.data?.find(item => item.id === categoryId);
  const catalog = trpc.catalog.list.useQuery({ categoryId, query: "", limit: 24 });
  return <main className="site-shell home-page"><nav className="public-nav"><Link href="/" className="brand-lockup">يمن رياكت</Link><Link href="/" className="nav-copy">العودة للمكتبة</Link></nav><section className="catalog-section"><div className="section-heading"><span>أرشيف قابل للمشاركة</span><h1>{category?.name ?? "التصنيف"}</h1></div>{catalog.isLoading ? <p className="inline-empty">جارٍ تحميل التصنيف…</p> : catalog.data?.reactions.length ? <div className="reaction-grid">{catalog.data.reactions.map(reaction => <ReactionCard key={reaction.publicId} reaction={reaction} />)}</div> : <div className="empty-panel"><FolderSearch2 size={28} /><h2>لا توجد رياكشنات منشورة هنا بعد</h2><Link href="/" className="outline-button">تصفح كل المكتبة</Link></div>}</section></main>;
}
