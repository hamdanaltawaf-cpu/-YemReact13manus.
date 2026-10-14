import React from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

export type AnalyticsTimelinePoint = { date: string; searches: number; clicks: number; saves: number };

type Metric = {
  key: "searches" | "clicks" | "saves";
  label: string;
  color: string;
};

const metrics: Metric[] = [
  { key: "searches", label: "عمليات البحث", color: "var(--yr-paper)" },
  { key: "clicks", label: "النقرات", color: "var(--yr-amber-light)" },
  { key: "saves", label: "عمليات الحفظ", color: "var(--yr-coral)" },
];

function trendFor(values: number[]) {
  if (values.length < 2) return { label: "اتجاه ثابت", Icon: Minus };
  const pivot = Math.ceil(values.length / 2);
  const first = values.slice(0, pivot).reduce((total, value) => total + value, 0);
  const second = values.slice(pivot).reduce((total, value) => total + value, 0);
  if (second > first) return { label: "اتجاه صاعد", Icon: TrendingUp };
  if (second < first) return { label: "اتجاه هابط", Icon: TrendingDown };
  return { label: "اتجاه ثابت", Icon: Minus };
}

function readableDate(value: string, full: boolean) {
  return new Intl.DateTimeFormat("ar-YE", full ? { day: "numeric", month: "short" } : { day: "numeric" }).format(new Date(`${value}T12:00:00Z`));
}

function MiniLine({ values, color, label }: { values: number[]; color: string; label: string }) {
  const width = 280;
  const height = 94;
  const padding = 7;
  const max = Math.max(...values, 1);
  const points = values.length === 1
    ? `${width / 2},${height / 2}`
    : values.map((value, index) => {
      const x = padding + (index / (values.length - 1)) * (width - padding * 2);
      const y = height - padding - (value / max) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  return <svg className="analytics-sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`تطور ${label}`} preserveAspectRatio="none">
    <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="analytics-sparkline__base" />
    <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}

export function SearchAnalyticsTimeline({ timeline }: { timeline: AnalyticsTimelinePoint[] }) {
  return <section className="analytics-timeline" aria-labelledby="analytics-timeline-title">
    <div className="analytics-timeline__header"><div><span>قراءة زمنية</span><h2 id="analytics-timeline-title">اتجاه تفاعل البحث</h2></div><small>{timeline.length ? `${readableDate(timeline[0].date, true)} — ${readableDate(timeline[timeline.length - 1].date, true)}` : "لا توجد بيانات بعد"}</small></div>
    <div className="analytics-timeline__metrics">
      {metrics.map(metric => {
        const values = timeline.map(point => point[metric.key]);
        const total = values.reduce((sum, value) => sum + value, 0);
        const trend = trendFor(values);
        return <article className="analytics-metric" key={metric.key}>
          <div className="analytics-metric__top"><span>{metric.label}</span><b>{total.toLocaleString("ar-YE")}</b></div>
          <MiniLine values={values.length ? values : [0]} color={metric.color} label={metric.label} />
          <div className="analytics-metric__footer"><small><trend.Icon size={13} /> {trend.label}</small><span>{timeline.length ? readableDate(timeline[timeline.length - 1].date, true) : "—"}</span></div>
        </article>;
      })}
    </div>
  </section>;
}
