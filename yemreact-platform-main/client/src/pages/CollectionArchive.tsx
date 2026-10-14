import { Link, useParams } from "wouter";
import { FolderSearch2 } from "lucide-react";
import { ReactionCard } from "@/components/ReactionCard";
import { trpc } from "@/lib/trpc";

export default function CollectionArchive() {
  const { slug } = useParams<{ slug: string }>();
  const collection = trpc.catalog.collection.useQuery({ slug, limit: 24 });
  const data = collection.data;
  return <main className="site-shell home-page"><nav className="public-nav"><Link href="/" className="brand-lockup">يمن رياكت</Link><Link href="/" className="nav-copy">العودة للمكتبة</Link></nav><section className="catalog-section"><div className="section-heading"><span>مجموعة YemReact</span><h1>{data?.collection.title ?? "المجموعة"}</h1>{data?.collection.description && <p>{data.collection.description}</p>}</div>{collection.isLoading ? <p className="inline-empty">جارٍ تحميل المجموعة…</p> : data?.reactions.length ? <div className="reaction-grid">{data.reactions.map(reaction => <ReactionCard key={reaction.publicId} reaction={reaction} />)}</div> : <div className="empty-panel"><FolderSearch2 size={28} /><h2>لا توجد رياكشنات منشورة في هذه المجموعة</h2><Link href="/" className="outline-button">تصفح كل المكتبة</Link></div>}</section></main>;
}
