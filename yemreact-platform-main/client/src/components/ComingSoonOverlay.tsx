import { LockKeyhole } from "lucide-react";
import React, { useEffect } from "react";

export type DeferredSection = "images" | "people";

export const comingSoonCopy: Record<DeferredSection, { title: string; description: string }> = {
  images: { title: "قسم الصور", description: "نعمل على تجهيز قسم الصور لتوفير تجربة رياكشنات أجمل قريبًا." },
  people: { title: "قسم الشخصيات", description: "نعمل على تجهيز قسم الشخصيات لتوفير تجربة رياكشنات أجمل قريبًا." },
};

export function ComingSoonOverlay({ section, onClose }: { section: DeferredSection; onClose: () => void }) {
  const copy = comingSoonCopy[section];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return <div className="coming-soon-overlay" role="dialog" aria-modal="true" aria-labelledby="coming-soon-title" aria-describedby="coming-soon-description" dir="rtl">
    <section className="coming-soon-overlay__card">
      <div className="coming-soon-overlay__lock" aria-hidden="true"><LockKeyhole size={29} strokeWidth={1.8} /></div>
      <span>قريباً</span>
      <h2 id="coming-soon-title">{copy.title} مقفل حالياً</h2>
      <p id="coming-soon-description">{copy.description}</p>
      <button type="button" onClick={onClose}>العودة إلى المكتبة</button>
    </section>
  </div>;
}
