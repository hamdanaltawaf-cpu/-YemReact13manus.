import React from "react";
import { Link } from "wouter";
import { PeelMark } from "./BrandMark";

export type CatalogReaction = {
  id: number;
  publicId: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  quote: string;
  situation: string;
  durationSeconds: number;
  thumbnailUrl?: string | null;
  corner: "tr" | "tl";
  isTestData: boolean;
};

export function ReactionCard({ reaction, compact = false, onOpen }: { reaction: CatalogReaction; compact?: boolean; onOpen?: () => void }) {
  return (
    <Link href={`/r/${reaction.publicId}`} onClick={onOpen} className={`reaction-card ${compact ? "reaction-card--compact" : ""}`}>
      <article aria-label={`تفاصيل الرياكشن ${reaction.quote}`}>
        <div className={`reaction-stage reaction-stage--${reaction.categoryId}`}>
          {reaction.thumbnailUrl && <img className="stage-media" src={reaction.thumbnailUrl} alt="" aria-hidden="true" loading="lazy" />}
          <PeelMark corner={reaction.corner} />
          <span className="duration-tag" dir="ltr">{reaction.durationSeconds}ث</span>
          <span className="category-dot" style={{ background: reaction.categoryColor }} aria-label={reaction.categoryName} />
          <span className="stage-grid" aria-hidden="true" />
          <p className="stage-quote">{reaction.quote}</p>
        </div>
      </article>
    </Link>
  );
}
