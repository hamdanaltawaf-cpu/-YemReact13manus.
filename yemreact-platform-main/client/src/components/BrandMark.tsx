import React from "react";

type BrandMarkProps = {
  size?: number;
  tone?: "amber" | "paper" | "ink";
};

export function BrandMark({ size = 28, tone = "amber" }: BrandMarkProps) {
  const color = tone === "amber" ? "var(--yr-amber)" : tone === "paper" ? "var(--yr-paper)" : "var(--yr-ink)";
  return (
    <svg aria-hidden="true" className="brand-mark" width={size} height={size} viewBox="0 0 120 120">
      <path
        fill={color}
        fillRule="evenodd"
        d="M10,0 L86,0 L92,6 L98,1 L104,7 L110,3 L120,14 L120,106 L106,120 L14,120 L0,106 L0,10 Z M46,38 L46,82 L82,60 Z"
      />
    </svg>
  );
}

export function PeelMark({ corner = "tr" }: { corner?: "tr" | "tl" }) {
  return (
    <span className={`peel-mark peel-mark--${corner}`} aria-hidden="true">
      <BrandMark size={24} tone="ink" />
    </span>
  );
}
