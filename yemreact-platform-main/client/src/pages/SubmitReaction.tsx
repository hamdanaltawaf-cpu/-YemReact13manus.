import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, FileVideo, Loader2, Send, UploadCloud } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { BrandMark } from "@/components/BrandMark";
import { trpc } from "@/lib/trpc";

const MAX_VIDEO_BYTES = 10 * 1024 * 1024;

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذر قراءة ملف الفيديو."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export default function SubmitReaction() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ trackingCode: string | null; createdAt: Date } | null>(null);
  const submit = trpc.account.submitContribution.useMutation({
    onSuccess: async contribution => {
      setReceipt({ trackingCode: contribution.trackingCode, createdAt: contribution.createdAt });
      setFile(null);
      setNote("");
      await utils.account.contributions.invalidate();
    },
    onError: failure => setError(failure.message),
  });

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const fileSize = useMemo(() => file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "", [file]);
  const chooseFile = (next: File | null) => {
    setError("");
    if (!next) return;
    if (!next.type.startsWith("video/")) return setError("اختر ملف فيديو صالحاً بصيغة MP4 أو WebM أو MOV.");
    if (next.size > MAX_VIDEO_BYTES) return setError("يجب ألا يتجاوز حجم الفيديو 10 ميجابايت.");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
  };

  const submitContribution = async () => {
    if (!file) return setError("اختر فيديو قبل الإرسال.");
    setError("");
    try {
      const dataBase64 = await fileToDataUrl(file);
      submit.mutate({ fileName: file.name, contentType: file.type, dataBase64, note: note.trim() || null });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "تعذر تجهيز الفيديو للإرسال.");
    }
  };

  if (loading) return <main className="account-gate">جارٍ تجهيز حسابك…</main>;
  if (!user) return <main className="account-gate"><BrandMark size={42} /><h1>أرسل رياكشنك بعد تسجيل الدخول</h1><p>افتح القائمة من أعلى اليسار وسجّل الدخول بحساب Google لإرسال مساهمة ومتابعتها.</p><Link href="/" className="yr-primary-button">العودة إلى المكتبة</Link></main>;
  if (receipt) return <main className="site-shell submit-page"><section className="submit-receipt"><CheckCircle2 size={42} /><span>تم استلام المساهمة</span><h1>مساهمتك قيد المراجعة</h1><p>احتفظ برقم التتبع التالي. ستظهر النتيجة في «مساهماتي» بعد مراجعة المسؤول.</p><b>{receipt.trackingCode || "YRC"}</b><small>{new Date(receipt.createdAt).toLocaleString("ar-YE")}</small><div><Link href="/account" className="yr-primary-button">عرض مساهماتي</Link><button type="button" className="outline-button" onClick={() => setReceipt(null)}>إرسال رياكشن آخر</button></div></section></main>;

  return <main className="site-shell submit-page" dir="rtl"><nav className="public-nav"><Link href="/" className="brand-lockup"><BrandMark size={31} /><span>يمن رياكت</span></Link><Link href="/account" className="outline-button">حسابي</Link></nav><section className="submit-layout"><div className="submit-intro"><span><Send size={15} /> ساهم في المكتبة</span><h1>أرسل رياكشن <em>يمني.</em></h1><p>ارفع مقطعاً قصيراً وواضحاً. ستراجعه إدارة YemReact قبل نشره، وتتابع حالته من حسابك.</p><ul><li>MP4 أو WebM أو MOV فقط.</li><li>الحد الأقصى للملف 10MB.</li><li>ستظهر النتيجة في «مساهماتي» بعد المراجعة.</li></ul></div><section className="submit-card"><div className="submit-card__heading"><FileVideo size={20} /><div><h2>ملف الرياكشن</h2><p>اختر الفيديو ثم راجع المعاينة قبل الإرسال.</p></div></div><label className={`video-dropzone ${file ? "video-dropzone--ready" : ""}`}><input type="file" accept="video/mp4,video/webm,video/quicktime" disabled={submit.isPending} onChange={event => chooseFile(event.target.files?.[0] ?? null)} /><UploadCloud size={28} /><b>{file ? file.name : "اختر فيديو للرفع"}</b><span>{file ? fileSize : "حتى 10MB — MP4 / WebM / MOV"}</span></label>{previewUrl && <video className="submit-preview" src={previewUrl} controls playsInline preload="metadata" />}{error && <p className="form-error">{error}</p>}<label className="field-label">ملاحظة للمراجع <small>اختياري</small><textarea value={note} maxLength={1000} disabled={submit.isPending} onChange={event => setNote(event.target.value)} placeholder="أضف وصفاً قصيراً للموقف أو مصدر الفيديو…" /></label><button type="button" className="yr-primary-button submit-button" disabled={submit.isPending || !file} onClick={submitContribution}>{submit.isPending ? <><Loader2 size={17} className="animate-spin" /> جارٍ رفع الفيديو…</> : <><Send size={17} /> أرسل للمراجعة</>}</button><p className="submit-note">لن يُنشر الفيديو تلقائياً. عند القبول أو الرفض سيصلك تنبيه داخل حسابك.</p></section></section></main>;
}
