import { Flame, Search, X } from "lucide-react";
import { useState } from "react";

export const searchSuggestions = ["مصطفى المومري", "#تعز", "القيرعي", "لما صاحبك يقول بكرة", "شكلك بعدما شفت خبر ما توقعتَه"];
export function applySearchSuggestion(value: string, onQueryChange: (value: string) => void, onClose: () => void) { onQueryChange(value); onClose(); }

export function SearchBar({ query, resultCount, onQueryChange, onClear }: { query: string; resultCount: number; onQueryChange: (value: string) => void; onClear: () => void }) {
  const [focused, setFocused] = useState(false);
  const selectSuggestion = (value: string) => applySearchSuggestion(value, onQueryChange, () => setFocused(false));
  return <div className="search-bar" role="search"><div className={`search-bar__frame ${focused ? "is-focused" : ""}`}><Search size={20} aria-hidden="true" /><input value={query} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={event => onQueryChange(event.target.value)} placeholder="بحث عن رياكت" aria-label="بحث عن رياكت" />{query && <button type="button" className="search-bar__clear" onMouseDown={event => event.preventDefault()} onClick={onClear} aria-label="مسح نص البحث"><X size={16} /></button>}<span className="search-bar__hint">{query ? `${resultCount.toLocaleString("ar-YE")} نتيجة` : "بحث ذكي بالموقف"}</span></div>{focused && <div className="search-bar__suggestions" role="listbox" aria-label="استعلامات رائجة"><div className="search-bar__suggestions-row"><span className="search-bar__suggestions-label"><Flame size={12} /> رائج الآن</span>{searchSuggestions.slice(0, 5).map(suggestion => <button type="button" role="option" key={suggestion} onMouseDown={event => event.preventDefault()} onClick={() => selectSuggestion(suggestion)}>{suggestion}</button>)}</div></div>}</div>;
}
