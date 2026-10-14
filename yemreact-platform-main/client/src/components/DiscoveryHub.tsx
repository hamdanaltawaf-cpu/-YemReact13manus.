import { AlertCircle, Check, CircleOff, Flame, Laugh, Search, SlidersHorizontal, Sparkles, X, Zap } from "lucide-react";
import { useState } from "react";

export const trendingKeywords = ["مصطفى المومري", "#تعز", "القيرعي", "لما صاحبك يقول بكرة", "شكلك بعدما شفت خبر ما توقعتَه"];

export function visibleTrendingKeywords(values = trendingKeywords) {
  const fallback = trendingKeywords.filter(value => !values.includes(value));
  const source = values.length >= 2 ? values : [...values, ...fallback];
  return source.slice(0, Math.min(5, Math.max(2, source.length)));
}

type Category = { id: string; name: string; color: string };
const categoryIcons: Record<string, typeof Sparkles> = { laugh: Laugh, shock: AlertCircle, anger: Flame, surprise: Sparkles, embarrass: CircleOff, approve: Check, reject: X, sarcasm: Zap, hype: Zap };

export function categoryIconFor(id: string) { return categoryIcons[id] ?? Sparkles; }

export function DiscoveryHub({ query, activeCategory, categories, resultCount, onQueryChange, onClearQuery, onSuggestion, onCategory }: { query: string; activeCategory?: string; categories: Category[]; resultCount: number; onQueryChange: (value: string) => void; onClearQuery: () => void; onSuggestion: (value: string) => void; onCategory: (id?: string) => void }) {
  const [focused, setFocused] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const suggestions = visibleTrendingKeywords();
  const chooseSuggestion = (suggestion: string) => { onSuggestion(suggestion); setFocused(false); };
  return <section className="discovery-hub" aria-labelledby="home-discovery-title">
    <div className="discovery-hub__intro"><span><Sparkles size={14} /> اكتشف بالموقف، لا بالكلمة وحدها</span><h1>دوّر على الرياكشن<br /><em>اللي يقول كلامك.</em></h1><p id="home-discovery-title">احكِ لنا الموقف كما صار، وخذ ردًا يمنيًا جاهزًا قبل ما يطول السوالف.</p></div>
    <div className="discovery-hub__search-stack">
      <div className={`discovery-hub__search ${focused ? "is-focused" : ""}`} role="search"><Search size={21} aria-hidden="true" /><input value={query} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={event => onQueryChange(event.target.value)} placeholder="ابحث عن رياكشن… لما حد يقول لك شي ما توقعته" aria-label="ابحث عن موقف أو رياكشن" />{query && <button type="button" className="discovery-hub__clear" onMouseDown={event => event.preventDefault()} onClick={onClearQuery} aria-label="مسح نص البحث"><X size={17} /></button>}<span className="discovery-hub__search-hint">{query ? `${resultCount.toLocaleString("ar-YE")} نتيجة` : "بحث ذكي بالموقف"}</span></div>
      {focused && <div className="discovery-hub__dropdown" role="listbox" aria-label="استعلامات رائجة"><div className="discovery-hub__dropdown-title"><span><Flame size={14} /> الأكثر رواجًا الآن</span><small>اختَر ليبدأ البحث فورًا</small></div>{suggestions.map((suggestion, index) => <button type="button" role="option" aria-selected={false} className="discovery-hub__dropdown-option" key={suggestion} onMouseDown={event => event.preventDefault()} onClick={() => chooseSuggestion(suggestion)}><span><Flame size={14} /><b>{suggestion}</b></span><i>{String(index + 1).padStart(2, "0")}</i></button>)}</div>}
    </div>
    <div className={`discovery-hub__moods ${advancedFiltersOpen ? "is-open" : ""}`}><div className="discovery-hub__moods-head"><div><span>تخصيص الاستكشاف</span><h2>وش جوّك اليوم؟</h2></div><button type="button" aria-expanded={advancedFiltersOpen} onClick={() => setAdvancedFiltersOpen(current => !current)}><SlidersHorizontal size={14} /> {advancedFiltersOpen ? "إخفاء التصنيفات" : activeCategory ? "فلتر مفعّل" : "فلترة حسب الشعور"}</button></div>{advancedFiltersOpen && <div className="discovery-hub__rail discovery-hub__categories" id="categories" aria-label="فلاتر التصنيفات"><button type="button" aria-pressed={!activeCategory} className={`discovery-hub__category ${!activeCategory ? "is-active" : ""}`} onClick={() => onCategory(undefined)}><Sparkles size={14} /><span>كل المواقف</span></button>{categories.map(category => { const Icon = categoryIconFor(category.id); return <button type="button" aria-pressed={activeCategory === category.id} key={category.id} onClick={() => onCategory(activeCategory === category.id ? undefined : category.id)} className={`discovery-hub__category ${activeCategory === category.id ? "is-active" : ""}`} style={{ "--category-color": category.color } as React.CSSProperties}><Icon size={14} /><span>{category.name}</span></button>; })}</div>}</div>
  </section>;
}
