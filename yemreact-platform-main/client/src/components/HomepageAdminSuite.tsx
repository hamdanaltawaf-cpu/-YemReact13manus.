import { Check, ChevronDown, Edit3, FolderPlus, Home, Layers3, Plus, Save, Search, Sparkles, Tag, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

type HomepageEditorData = {
  settings: { weeklyReactionId: number | null; newLibraryLimit: number };
  reactions: Array<{ id: number; publicId: string; quote: string; situation: string }>;
  categories: Array<{ id: string; name: string; color: string; sortOrder: number }>;
  collections: Array<{ id: number; slug: string; title: string; description: string | null; status: "draft" | "published"; sortOrder: number }>;
};

type CollectionDraft = { id: number | null; slug: string; title: string; description: string; status: "draft" | "published"; sortOrder: string };

const emptyDraft: CollectionDraft = { id: null, slug: "", title: "", description: "", status: "draft", sortOrder: "0" };

export function normalizeCollectionSlug(value: string) {
  return value.toLocaleLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96);
}

export function getCollectionDraftErrors(draft: CollectionDraft) {
  const errors: Partial<Record<keyof CollectionDraft, string>> = {};
  if (draft.slug.length < 3) errors.slug = "استخدم 3 أحرف إنجليزية أو أرقام على الأقل.";
  if (!/^[a-z0-9-]+$/.test(draft.slug)) errors.slug = "الرابط المختصر يقبل الحروف الإنجليزية والأرقام والشرطة فقط.";
  if (draft.title.trim().length < 2) errors.title = "اكتب عنوانًا واضحًا من حرفين على الأقل.";
  const order = Number(draft.sortOrder);
  if (!Number.isInteger(order) || order < 0 || order > 999) errors.sortOrder = "أدخل ترتيبًا صحيحًا بين 0 و999.";
  return errors;
}

function StatusPill({ status }: { status: "draft" | "published" }) {
  return <span className={`homepage-suite__status homepage-suite__status--${status}`}>{status === "published" ? "منشورة" : "مسودة"}</span>;
}

export function HomepageAdminSuite({ data }: { data?: HomepageEditorData }) {
  const utils = trpc.useUtils();
  const saveSettings = trpc.admin.saveHomepageSettings.useMutation({ onSuccess: () => utils.admin.homepage.invalidate() });
  const saveCategoryNames = trpc.admin.saveCategoryNames.useMutation({ onSuccess: () => utils.admin.homepage.invalidate() });
  const saveCollection = trpc.admin.saveCollection.useMutation({ onSuccess: () => utils.admin.homepage.invalidate() });
  const [weeklySearch, setWeeklySearch] = useState("");
  const [weeklyReactionId, setWeeklyReactionId] = useState<number | null>(null);
  const [limitInput, setLimitInput] = useState("12");
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<CollectionDraft>(emptyDraft);
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!data) return;
    setWeeklyReactionId(data.settings.weeklyReactionId);
    setLimitInput(String(data.settings.newLibraryLimit));
    setCategoryNames(Object.fromEntries(data.categories.map(category => [category.id, category.name])));
  }, [data]);

  const weeklyOptions = useMemo(() => {
    const query = weeklySearch.trim().toLocaleLowerCase();
    return (data?.reactions ?? []).filter(item => !query || `${item.publicId} ${item.quote} ${item.situation}`.toLocaleLowerCase().includes(query));
  }, [data?.reactions, weeklySearch]);
  const limit = Number(limitInput);
  const settingsValid = Number.isInteger(limit) && limit >= 4 && limit <= 30;
  const categoryErrors = useMemo(() => Object.fromEntries((data?.categories ?? []).filter(category => (categoryNames[category.id] ?? "").trim().length < 2 || (categoryNames[category.id] ?? "").trim().length > 64).map(category => [category.id, "اكتب اسمًا بين حرفين و64 حرفًا."])), [categoryNames, data?.categories]);
  const draftErrors = getCollectionDraftErrors(draft);
  const canSaveCollection = Object.keys(draftErrors).length === 0 && !saveCollection.isPending;

  const saveGeneralSettings = async () => {
    if (!settingsValid) return setMessage("تحقق من عدد عناصر «جديد المكتبة» قبل الحفظ.");
    setMessage("");
    try {
      await saveSettings.mutateAsync({ weeklyReactionId, newLibraryLimit: limit });
      setMessage("تم حفظ إعدادات الواجهة الرئيسية.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر حفظ الإعدادات."); }
  };
  const saveCategories = async () => {
    if (Object.keys(categoryErrors).length) return setMessage("أكمل أسماء التصنيفات الصحيحة قبل الحفظ.");
    setMessage("");
    try {
      await saveCategoryNames.mutateAsync({ categories: (data?.categories ?? []).map(category => ({ id: category.id, name: (categoryNames[category.id] ?? category.name).trim() })) });
      setMessage("حُفظت أسماء التصنيفات. بقيت المعرّفات والألوان والترتيب محمية.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر حفظ أسماء التصنيفات."); }
  };
  const saveDraft = async () => {
    setTouched({ slug: true, title: true, sortOrder: true });
    if (!canSaveCollection) return;
    setMessage("");
    try {
      await saveCollection.mutateAsync({ id: draft.id ?? undefined, slug: draft.slug, title: draft.title.trim(), description: draft.description.trim() || null, status: draft.status, sortOrder: Number(draft.sortOrder) });
      setMessage(draft.id ? "تم تحديث المجموعة وترتيبها." : "تمت إضافة المجموعة إلى الإدارة.");
      setDraft(emptyDraft); setTouched({});
    } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر حفظ المجموعة."); }
  };
  const editCollection = (item: HomepageEditorData["collections"][number]) => {
    setDraft({ id: item.id, slug: item.slug, title: item.title, description: item.description ?? "", status: item.status, sortOrder: String(item.sortOrder) });
    setTouched({}); setMessage(`أنت تعدّل الآن مجموعة «${item.title}».`);
  };

  return <section className="homepage-suite" aria-label="جناح تعديل الصفحة الرئيسية">
    <header className="homepage-suite__hero"><div><span><Sparkles size={14} /> واجهة المكتبة العامة</span><h2>عدّل <em>الواجهة الرئيسية</em> بثقة</h2><p>كل قسم هنا يغيّر ما يراه الزائر فقط. الحقول محمية بتحقق فوري قبل الحفظ.</p></div><div className="homepage-suite__hero-stat"><b>{data?.collections.filter(item => item.status === "published").length ?? 0}</b><span>مجموعة منشورة</span></div></header>
    {message && <p className="homepage-suite__message" role="status">{message}</p>}

    <div className="homepage-suite__grid">
      <section className="homepage-suite__panel homepage-suite__panel--settings"><div className="homepage-suite__panel-head"><div><Home size={18} /><div><span>الظهور والاختيار</span><h3>إعدادات الواجهة</h3></div></div><span className="homepage-suite__step">01</span></div><div className="homepage-suite__field"><label htmlFor="weekly-search">ابحث عن رياكشن لمختار الأسبوع</label><div className="homepage-suite__search"><Search size={15} /><input id="weekly-search" value={weeklySearch} onChange={event => setWeeklySearch(event.target.value)} placeholder="ابحث بالكابشن أو المعرف…" /></div></div><label className="homepage-suite__field">مختار الأسبوع<select value={weeklyReactionId ?? ""} onChange={event => setWeeklyReactionId(event.target.value ? Number(event.target.value) : null)}><option value="">[بدون اختيار]</option>{weeklyOptions.map(item => <option key={item.id} value={item.id}>{item.publicId} — {item.quote}</option>)}</select><small>{weeklyOptions.length ? `${weeklyOptions.length} رياكشن متاح للاختيار` : "لا توجد نتيجة مطابقة للبحث."}</small></label><label className="homepage-suite__field">عدد عناصر «جديد المكتبة»<div className="homepage-suite__number"><input inputMode="numeric" type="number" min="4" max="30" value={limitInput} onChange={event => { setLimitInput(event.target.value); setTouched(current => ({ ...current, limit: true })); }} /><span>بين 4 و30</span></div>{touched.limit && !settingsValid && <small className="homepage-suite__error">اختر رقمًا صحيحًا بين 4 و30.</small>}</label><button type="button" className="primary-button homepage-suite__save" disabled={!settingsValid || saveSettings.isPending} onClick={saveGeneralSettings}>{saveSettings.isPending ? "جارٍ الحفظ…" : <><Save size={16} /> حفظ إعدادات الواجهة</>}</button></section>

      <section className="homepage-suite__panel homepage-suite__panel--categories"><div className="homepage-suite__panel-head"><div><Tag size={18} /><div><span>اسم يظهر للزائر</span><h3>التصنيفات</h3></div></div><span className="homepage-suite__step">02</span></div><p className="homepage-suite__note">يمكنك تعديل الاسم الظاهر فقط. <b>المعرّف واللون والترتيب ثابتة ومحمية.</b></p><div className="homepage-suite__categories">{data?.categories.map(category => <label className="homepage-suite__category" key={category.id}><span className="homepage-suite__swatch" style={{ background: category.color }} /><span className="homepage-suite__category-copy"><b>{category.id}</b><small>ترتيب {category.sortOrder}</small></span><input value={categoryNames[category.id] ?? ""} maxLength={64} onChange={event => { setCategoryNames(current => ({ ...current, [category.id]: event.target.value })); setTouched(current => ({ ...current, [`category-${category.id}`]: true })); }} aria-label={`الاسم الظاهر للتصنيف ${category.id}`} />{(touched[`category-${category.id}`] || categoryErrors[category.id]) && categoryErrors[category.id] && <small className="homepage-suite__error">{categoryErrors[category.id]}</small>}</label>)}</div><button type="button" className="outline-button homepage-suite__save" disabled={Boolean(Object.keys(categoryErrors).length) || saveCategoryNames.isPending} onClick={saveCategories}>{saveCategoryNames.isPending ? "جارٍ حفظ الأسماء…" : <><Check size={16} /> حفظ أسماء التصنيفات</>}</button></section>
    </div>

    <section className="homepage-suite__collections"><div className="homepage-suite__collections-head"><div><Layers3 size={19} /><div><span>تنظيم واكتشاف</span><h3>إدارة المجموعات</h3></div></div><p>أضف مجموعة جديدة أو حرّر مجموعة قائمة. رتّبها برقم أصغر لتظهر أولًا.</p></div><div className="homepage-suite__collection-layout"><form className="homepage-suite__collection-form" onSubmit={event => { event.preventDefault(); void saveDraft(); }}><div className="homepage-suite__form-title"><span>{draft.id ? "تعديل مجموعة" : "مجموعة جديدة"}</span>{draft.id && <button type="button" onClick={() => { setDraft(emptyDraft); setTouched({}); }}>إلغاء التعديل <X size={14} /></button>}</div><div className="homepage-suite__form-grid"><label>الرابط المختصر<input value={draft.slug} onChange={event => { setDraft(current => ({ ...current, slug: normalizeCollectionSlug(event.target.value) })); setTouched(current => ({ ...current, slug: true })); }} placeholder="weekly-reactions" autoCapitalize="none" />{touched.slug && draftErrors.slug && <small className="homepage-suite__error">{draftErrors.slug}</small>}</label><label>عنوان المجموعة<input value={draft.title} onChange={event => { setDraft(current => ({ ...current, title: event.target.value })); setTouched(current => ({ ...current, title: true })); }} placeholder="مثال: ردود القروبات" />{touched.title && draftErrors.title && <small className="homepage-suite__error">{draftErrors.title}</small>}</label><label>الحالة<select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value as CollectionDraft["status"] }))}><option value="draft">مسودة — غير ظاهرة للزوار</option><option value="published">منشورة — ظاهرة للزوار</option></select></label><label>الترتيب<input inputMode="numeric" type="number" min="0" max="999" value={draft.sortOrder} onChange={event => { setDraft(current => ({ ...current, sortOrder: event.target.value })); setTouched(current => ({ ...current, sortOrder: true })); }} />{touched.sortOrder && draftErrors.sortOrder && <small className="homepage-suite__error">{draftErrors.sortOrder}</small>}</label><label className="homepage-suite__form-span">وصف مختصر<textarea value={draft.description} maxLength={2000} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} placeholder="اشرح للزائر متى يستخدم هذه المجموعة…" /></label></div><button className="primary-button homepage-suite__save" disabled={!canSaveCollection}>{saveCollection.isPending ? "جارٍ حفظ المجموعة…" : <><FolderPlus size={16} /> {draft.id ? "تحديث المجموعة" : "إضافة المجموعة"}</>}</button></form><aside className="homepage-suite__collection-list"><div><b>المجموعات الحالية</b><span>{data?.collections.length ?? 0}</span></div>{data?.collections.length ? data.collections.map(item => <article key={item.id} className="homepage-suite__collection-card"><div><StatusPill status={item.status} /><small>ترتيب {item.sortOrder}</small></div><h4>{item.title}</h4><p>{item.description || "لا يوجد وصف حتى الآن."}</p><footer><code>/{item.slug}</code><button type="button" onClick={() => editCollection(item)}><Edit3 size={14} /> تعديل سريع</button></footer></article>) : <div className="homepage-suite__empty">لا توجد مجموعات بعد. ابدأ بأول مجموعة من النموذج.</div>}</aside></div></section>
  </section>;
}
