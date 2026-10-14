import { Check, FileVideo, Flame, FolderPlus, Image, Loader2, Save, Sparkles, Tag, UploadCloud, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export type ReactionUploadForm = { categoryId: string; quote: string; searchOptimizer: string };
type Category = { id: string; name: string; color: string };
type Collection = { id: number; title: string; status: "draft" | "published" };
type FailedSearch = { id: number; originalQuery: string; occurrences: number };

function extractTags(value: string) { return Array.from(new Set(value.split(/[\s،,#]+/).map(tag => tag.trim()).filter(tag => tag.length >= 2))).slice(0, 16); }

async function captureThumbnail(file: File) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<string>((resolve, reject) => {
      const video = document.createElement("video");
      video.muted = true; video.preload = "metadata"; video.src = url;
      video.onloadeddata = () => { video.currentTime = Math.min(0.75, Math.max(0, (video.duration || 1) / 4)); };
      video.onseeked = () => { const canvas = document.createElement("canvas"); canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 360; canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL("image/jpeg", .8)); };
      video.onerror = () => reject(new Error("تعذر توليد معاينة الفيديو."));
    });
  } finally { URL.revokeObjectURL(url); }
}

export function ReactionUploadSuite({ form, categories, collections, selectedCollectionIds, failedSearches, isSaving, onFormChange, onToggleCollection, onStartVideo, onSaveMetadata, onReset, notice, error, editingId }: { form: ReactionUploadForm; categories: Category[]; collections: Collection[]; selectedCollectionIds: number[]; failedSearches: FailedSearch[]; isSaving: boolean; onFormChange: (field: keyof ReactionUploadForm, value: string) => void; onToggleCollection: (id: number) => void; onStartVideo: (file: File) => Promise<void>; onSaveMetadata: () => Promise<void>; onReset: () => void; notice: string; error: string; editingId: number | null }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const tags = useMemo(() => extractTags(form.searchOptimizer), [form.searchOptimizer]);
  const canSaveMetadata = Boolean(form.quote.trim() && form.categoryId && !isSaving);
  const addTag = (raw: string) => { const tag = raw.trim().replace(/^#/, ""); if (tag.length < 2) return; const next = Array.from(new Set([...tags, tag])); onFormChange("searchOptimizer", next.join(" ")); setTagInput(""); };
  const removeTag = (tag: string) => onFormChange("searchOptimizer", tags.filter(item => item !== tag).join(" "));
  const acceptFile = async (file?: File) => {
    if (!file) return;
    if (!new Set(["video/mp4", "video/webm", "video/quicktime"]).has(file.type) || file.size > 10 * 1024 * 1024) return;
    setUploading(true); setFileName(file.name);
    try { setPreview(await captureThumbnail(file)); await onStartVideo(file); } finally { setUploading(false); }
  };
  useEffect(() => () => { if (preview.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);
  return <section className="upload-suite" aria-label="رفع رياكشن جديد">
    <header className="upload-suite__hero"><div><span><Sparkles size={14} /> مسار رفع ذكي</span><h2>الفيديو أولًا،<em> والباقي على راحتك.</em></h2><p>ابدأ بالفيديو الآن؛ تُنشأ مسودة وتبدأ المعالجة في الخلفية، ثم أكمل الكابشن وبيانات البحث قبل النشر.</p></div>{editingId && <button type="button" onClick={onReset}><X size={15} /> رياكشن جديد</button>}</header>
    <div className="upload-suite__layout"><section className="upload-suite__stream"><div className="upload-suite__section-head"><span>01 — الفيديو والمعاينة</span><b>{uploading ? "جارٍ تجهيز الرفع" : fileName ? "المعالجة في الخلفية" : "ابدأ من هنا"}</b></div><div className={`upload-suite__dropzone ${dragging ? "is-dragging" : ""} ${preview ? "has-preview" : ""}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void acceptFile(event.dataTransfer.files[0]); }} onClick={() => fileRef.current?.click()} role="button" tabIndex={0} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") fileRef.current?.click(); }}><input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={event => void acceptFile(event.target.files?.[0])} />{preview ? <><img src={preview} alt="معاينة مصغرة تلقائية للفيديو" /><div className="upload-suite__preview-copy"><span><Image size={14} /> معاينة تلقائية</span><b>{fileName}</b><small>اضغط لتغيير الفيديو أو اختيار لقطة جديدة</small></div></> : <><UploadCloud size={32} /><b>اسحب الفيديو هنا أو اختره من جهازك</b><span>MP4 · WebM · MOV — حتى 10MB و60 ثانية</span></>}</div>{uploading && <div className="upload-suite__progress"><i /><span>نحفظ الملف وننشئ مهمة المعالجة…</span></div>}{notice && <p className="upload-suite__notice" role="status"><Check size={14} /> {notice}</p>}{error && <p className="upload-suite__error" role="alert">{error}</p>}
      <div className="upload-suite__section-head"><span>02 — البيانات والاكتشاف</span><b>يمكن حفظها بعد الرفع</b></div><div className="upload-suite__fields"><label className="upload-suite__caption">الكابشن<input value={form.quote} onChange={event => onFormChange("quote", event.target.value)} placeholder="مثال: عاد شي عقل؟" /><small>سيظهر للجمهور بعد حفظ البيانات.</small></label><label>الفئة<select value={form.categoryId} onChange={event => onFormChange("categoryId", event.target.value)}>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><div className="upload-suite__tags"><label>محسّن البحث</label><div className="upload-suite__tag-box">{tags.map(tag => <button type="button" key={tag} onClick={() => removeTag(tag)}>#{tag} <X size={12} /></button>)}<input value={tagInput} onChange={event => setTagInput(event.target.value)} onKeyDown={event => { if (["Enter", " ", ","].includes(event.key)) { event.preventDefault(); addTag(tagInput); } }} onBlur={() => addTag(tagInput)} placeholder={tags.length ? "أضف كلمة…" : "ممطوط، يسولف كثير، تطويل…"} /></div><small>اضغط مسافة أو Enter لتحويل الكلمة إلى وسم.</small></div><fieldset className="upload-suite__groups"><legend>المجموعات <small>اختياري</small></legend><div>{collections.map(collection => <button type="button" aria-pressed={selectedCollectionIds.includes(collection.id)} key={collection.id} onClick={() => onToggleCollection(collection.id)}><FolderPlus size={13} /> {collection.title}</button>)}</div></fieldset></div><button type="button" className="primary-button upload-suite__save" disabled={!canSaveMetadata} onClick={() => void onSaveMetadata()}>{isSaving ? <><Loader2 size={16} className="animate-spin" /> جارٍ حفظ البيانات…</> : <><Save size={16} /> حفظ بيانات الرياكشن</>}</button></section>
      <aside className="upload-suite__dead-ends"><header><div><Flame size={18} /><div><span>فرصة محتوى</span><h3>استعلامات بلا نتيجة</h3></div></div><small>ما يبحث عنه الجمهور ولم يجده</small></header>{failedSearches.length ? <ol>{failedSearches.slice(0, 4).map(item => <li key={item.id}><b>{item.originalQuery}</b><span>{item.occurrences} مرات</span></li>)}</ol> : <p>لا توجد فجوات بحث ظاهرة حاليًا.</p>}<footer><Tag size={14} /> استخدم هذه العبارات داخل «محسّن البحث» عند مناسبة الرياكشن.</footer></aside></div>
  </section>;
}
