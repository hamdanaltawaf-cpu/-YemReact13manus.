import { FolderSearch2, GalleryHorizontalEnd, LayoutGrid, PlaySquare, UsersRound } from "lucide-react";
import React from "react";
import { Link } from "wouter";
import type { DeferredSection } from "./ComingSoonOverlay";

export type ContentTab = "all" | "video" | "images";
export const GROUPS_ROUTE = "/groups";

export function CategoryTabs({ value, onChange, onLockedSection }: { value: ContentTab; onChange: (value: ContentTab) => void; onLockedSection: (section: DeferredSection) => void }) {
  const ready = [{ id: "all" as const, label: "الكل", icon: LayoutGrid }, { id: "video" as const, label: "فيديو", icon: PlaySquare }];
  return <nav className="category-tabs" aria-label="أقسام المكتبة"><div className="category-tabs__rail" role="tablist">{ready.map(tab => { const Icon = tab.icon; return <button type="button" key={tab.id} role="tab" aria-selected={value === tab.id} className={value === tab.id ? "is-active" : ""} onClick={() => onChange(tab.id)}><Icon size={14} />{tab.label}</button>; })}<button type="button" aria-haspopup="dialog" onClick={() => onLockedSection("images")}><GalleryHorizontalEnd size={14} />صور</button><Link href={GROUPS_ROUTE}><FolderSearch2 size={14} />المجموعات</Link><button type="button" aria-haspopup="dialog" onClick={() => onLockedSection("people")}><UsersRound size={14} />الشخصيات</button></div></nav>;
}
