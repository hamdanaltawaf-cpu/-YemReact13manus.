import { Archive, CheckCircle2, CircleAlert, Clock3, Edit3, FileVideo, Loader2, Search, SlidersHorizontal } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

export type LibraryManagerItem = {
  id: number;
  publicId: string;
  quote: string;
  situation: string;
  status: "draft" | "published" | "archived";
  processingStatus: string;
  thumbnailUrl?: string | null;
  mediaUrl?: string | null;
  durationSeconds?: number;
};

type StatusFilter = "all" | LibraryManagerItem["status"];

const statusMeta = {
  published: { label: "منشور", className: "published" },
  draft: { label: "مسودة", className: "draft" },
  archived: { label: "مؤرشف", className: "archived" },
} as const;

export function processingMeta(status: string) {
  if (status === "ready" || status === "uploaded") return { label: "جاهز", className: "ready", Icon: CheckCircle2 };
  if (status === "failed") return { label: "فشلت المعالجة", className: "failed", Icon: CircleAlert };
  return { label: status === "processing" ? "قيد المعالجة" : "بانتظار المعالجة", className: "pending", Icon: Clock3 };
}

export function filterLibraryManagerItems(items: LibraryManagerItem[], query: string, status: StatusFilter) {
  const needle = query.trim().toLocaleLowerCase();
  return items.filter(item => (status === "all" || item.status === status) && (!needle || `${item.publicId} ${item.quote} ${item.situation}`.toLocaleLowerCase().includes(needle)));
}

function StatePill({ item }: { item: LibraryManagerItem }) {
  const meta = statusMeta[item.status];
  return <span className={`library-suite__pill library-suite__pill--${meta.className}`}><i />{meta.label}</span>;
}

function ProcessingPill({ status }: { status: string }) {
  const meta = processingMeta(status);
  return <span className={`library-suite__pill library-suite__pill--${meta.className}`}><meta.Icon size={13} />{meta.label}</span>;
}

function ReactionIdentity({ item }: { item: LibraryManagerItem }) {
  const initial = item.quote.trim().slice(0, 1) || "؟";
  return <div className="library-suite__identity">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt={`مصغرة ${item.quote}`} /> : <span aria-hidden="true">{initial}</span>}<div><b>{item.quote || "بدون كابشن"}</b><small>{item.situation || "لا يوجد وصف للموقف"}</small><code>{item.publicId}</code></div></div>;
}

function LibraryActions({ item, onEdit, onArchive, archivingId }: { item: LibraryManagerItem; onEdit: (item: LibraryManagerItem) => void; onArchive: (id: number) => void; archivingId?: number | null }) {
  const archiving = archivingId === item.id;
  return <div className="library-suite__actions"><button type="button" className="library-suite__edit" onClick={() => onEdit(item)}><Edit3 size={14} /> تعديل</button>{item.status !== "archived" && <button type="button" className="library-suite__archive" disabled={archiving} onClick={() => onArchive(item.id)}>{archiving ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />} أرشفة</button>}</div>;
}

export function LibraryManagementSuite({ items, isLoading = false, onEdit, onArchive, archivingId }: { items: LibraryManagerItem[]; isLoading?: boolean; onEdit: (item: LibraryManagerItem) => void; onArchive: (id: number) => void; archivingId?: number | null }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const deferredQuery = useDeferredValue(query);
  const visible = useMemo(() => filterLibraryManagerItems(items, deferredQuery, status), [deferredQuery, items, status]);
  const summary = `${visible.length.toLocaleString("ar-YE")} من ${items.length.toLocaleString("ar-YE")} عنصر`;

  return <section className="library-suite" aria-label="إدارة مكتبة الرياكشنات">
    <header className="library-suite__hero"><div><span><FileVideo size={14} /> محتوى الرياكشنات</span><h2>إدارة <em>المكتبة</em></h2><p>ابحث، صفِّ حسب الحالة، ثم نفّذ الإجراء المناسب دون مغادرة لوحة التحكم.</p></div><div className="library-suite__counter"><b>{summary}</b><span>نتائج الفلترة الحالية</span></div></header>
    <section className="library-suite__toolbar" aria-label="بحث وفرز المكتبة"><label className="library-suite__search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث بالكابشن أو الموقف أو المعرّف…" aria-label="بحث فوري في المكتبة" /></label><div className="library-suite__filters" role="tablist" aria-label="تصفية حالة الرياكشن">{([{ id: "all", label: "كل الحالات" }, { id: "published", label: "منشور" }, { id: "draft", label: "مسودة" }, { id: "archived", label: "مؤرشف" }] as const).map(filter => <button type="button" key={filter.id} role="tab" aria-selected={status === filter.id} className={status === filter.id ? "is-active" : ""} onClick={() => setStatus(filter.id)}>{filter.id === "all" && <SlidersHorizontal size={13} />}{filter.label}<small>{filter.id === "all" ? items.length : items.filter(item => item.status === filter.id).length}</small></button>)}</div></section>
    {isLoading ? <div className="library-suite__skeleton" aria-label="جارٍ تحميل المكتبة"><span /><span /><span /></div> : <><div className="library-suite__desktop"><table><thead><tr><th>الرياكشن</th><th>الحالة</th><th>المعالجة</th><th>الإجراء</th></tr></thead><tbody>{visible.map(item => <tr key={item.id}><td><ReactionIdentity item={item} /></td><td><StatePill item={item} /></td><td><ProcessingPill status={item.processingStatus} /></td><td><LibraryActions item={item} onEdit={onEdit} onArchive={onArchive} archivingId={archivingId} /></td></tr>)}</tbody></table></div><div className="library-suite__mobile">{visible.map(item => <article className="library-suite__card" key={item.id}><header><ReactionIdentity item={item} /><StatePill item={item} /></header><div className="library-suite__card-meta"><div><small>المعالجة</small><ProcessingPill status={item.processingStatus} /></div><div><small>المدة</small><b>{item.durationSeconds ? `${item.durationSeconds}ث` : "—"}</b></div></div><LibraryActions item={item} onEdit={onEdit} onArchive={onArchive} archivingId={archivingId} /></article>)}</div>{!visible.length && <div className="library-suite__empty"><FileVideo size={24} /><b>لا توجد عناصر مطابقة</b><p>جرّب تغيير البحث أو اختيار حالة أخرى.</p></div>}</>}
  </section>;
}
