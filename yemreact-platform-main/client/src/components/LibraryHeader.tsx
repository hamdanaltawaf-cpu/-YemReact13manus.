import { ChevronDown, SlidersHorizontal } from "lucide-react";

export type LibrarySort = "relevance" | "latest" | "popular";

export function LibraryHeader({ hasQuery, sort, onSortChange }: { hasQuery: boolean; sort: LibrarySort; onSortChange: (value: LibrarySort) => void }) {
  return <header className="library-header" aria-label={hasQuery ? "أدوات نتائج البحث" : "أدوات تصفح المكتبة"}><div className="library-header__controls"><span className="library-header__title font-heading">مكتبة لا تُحْصَى</span><label className="library-header__sort"><SlidersHorizontal size={14} /><select value={sort} onChange={event => onSortChange(event.target.value as LibrarySort)} aria-label="ترتيب الرياكشنات">{hasQuery && <option value="relevance">الأكثر صلة</option>}<option value="latest">الأحدث</option><option value="popular">الأكثر رواجًا</option></select><ChevronDown size={13} /></label></div></header>;
}
