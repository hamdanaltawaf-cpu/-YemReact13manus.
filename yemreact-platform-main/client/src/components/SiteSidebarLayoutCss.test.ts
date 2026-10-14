import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(resolve(here, "../index.css"), "utf8");
const desktopCorrection = (styles.split("/* Desktop correction:")[1] ?? "").split("/* End desktop correction */")[0];
const mobileStacking = (styles.split("/* Mobile navigation stacking:")[1] ?? "").split(".site-menu-trigger[data-state")[0];
const desktopExpanded = (styles.split("/* Phase 2 desktop expanded visual hierarchy */")[1] ?? "").split("/* End Phase 2 desktop expanded visual hierarchy */")[0];
const phase3Responsive = (styles.split("/* Phase 3 responsive navigation:")[1] ?? "").split("/* End Phase 3 responsive navigation */")[0];

describe("تصحيح تخطيط الشريط المكتبي", () => {
  it("يثبت الشريط على اليسار ويترك مساحة المحتوى على اليسار لا اليمين", () => {
    expect(desktopCorrection).toMatch(/\.site-sidebar-desktop\[data-side="left"\][^{]*\{[^}]*left:\s*0;/);
    expect(desktopCorrection).toMatch(/\.site-main-frame\s*\{[^}]*margin-right:\s*0;[^}]*margin-left:\s*286px;/);
    expect(desktopCorrection).toMatch(/html\[data-yr-sidebar="compact"\] \.site-main-frame\s*\{[^}]*margin-left:\s*86px;/);
  });

  it("لا يحرّك عرض الشريط أو هامش المحتوى لتجنب إعادة التخطيط البطيئة", () => {
    expect(desktopCorrection).toMatch(/\.site-sidebar-desktop\[data-side="left"\][^{]*\{[^}]*transition:\s*none;/);
    expect(desktopCorrection).toMatch(/\.site-main-frame\s*\{[^}]*transition:\s*none;/);
    expect(desktopCorrection).not.toMatch(/transition:\s*(width|margin-left)/);
  });

  it("يرتب طبقات الهاتف فوق المحتوى ويجعل الدرج أسرع من طبقة الخلفية دون blur", () => {
    expect(mobileStacking).toMatch(/\.site-menu-trigger\s*\{[^}]*z-index:\s*40;/);
    expect(mobileStacking).toMatch(/\[data-slot="sheet-overlay"\]\s*\{[^}]*z-index:\s*50;[^}]*backdrop-filter:\s*none;/);
    expect(mobileStacking).toMatch(/\.site-mobile-drawer\s*\{[^}]*z-index:\s*60;[^}]*animation-duration:\s*220ms;[^}]*will-change:\s*transform;/);
  });

  it("يبني للشريط الموسع هرماً بصرياً واضحاً وحالة نشطة برتقالية هادئة", () => {
    expect(desktopExpanded).toMatch(/data-visual-state="expanded"\]\s*\.site-sidebar__header\s*\{[^}]*border-radius:\s*18px;/);
    expect(desktopExpanded).toMatch(/\.site-sidebar__item\.is-active\s*\{[^}]*border-color:\s*rgb\(224 130 75 \/ 42%\);[^}]*inset 3px 0 0 var\(--yr-amber-light\)/);
    expect(desktopExpanded).toMatch(/\.site-sidebar__item-icon\s*\{[^}]*color:\s*var\(--yr-grey-light\);/);
    expect(desktopExpanded).toMatch(/\.site-sidebar__account\s*\{[^}]*border-radius:\s*16px;/);
  });

  it("يبقي سكة الشريط المصغر وهوية زر الهاتف ودرجه ضمن انتقالات خفيفة", () => {
    expect(phase3Responsive).toMatch(/data-visual-state="compact"\][^{]*\{[^}]*padding:\s*10px 8px 8px;/);
    expect(phase3Responsive).toMatch(/data-visual-state="compact"\]\s*\.site-sidebar__group-heading span[^}]*display:\s*none;/);
    expect(phase3Responsive).toMatch(/\.site-menu-trigger\s*\{[^}]*width:\s*50px;[^}]*border-radius:\s*17px;/);
    expect(phase3Responsive).toMatch(/\.site-mobile-drawer\s*\{[^}]*width:\s*min\(calc\(100vw - 20px\), 372px\);[^}]*max-height:\s*100dvh;/);
  });

  it("يحرك مساحة المحتوى مع السكة المصغرة من دون تحريك أفقي منفصل", () => {
    expect(phase3Responsive).toMatch(/\.site-sidebar-desktop\[data-side="left"\], \.site-main-frame\s*\{[^}]*transition:\s*width 160ms var\(--yr-ease\), margin-left 160ms var\(--yr-ease\);/);
    expect(desktopCorrection).toMatch(/\.site-main-frame\s*\{[^}]*margin-right:\s*0;[^}]*margin-left:\s*286px;/);
    expect(desktopCorrection).toMatch(/html\[data-yr-sidebar="compact"\] \.site-main-frame\s*\{[^}]*margin-left:\s*86px;/);
    expect(desktopCorrection).not.toMatch(/margin-right:\s*86px/);
  });

  it("يربط site-main-frame الفعلي بقواعد الإزاحة نفسها دون إخفائه أو وضعه داخل الشريط", () => {
    const appSource = readFileSync(resolve(here, "../App.tsx"), "utf8");
    expect(appSource).toContain("<SiteSidebar /><main className=\"site-main-frame\">");
    expect(styles).not.toMatch(/\.site-main-frame\s*\{[^}]*display:\s*none;/);
    expect(styles).not.toMatch(/\.site-main-frame\s*\{[^}]*overflow-x:\s*scroll;/);
  });
});
