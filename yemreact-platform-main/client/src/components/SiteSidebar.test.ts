import { describe, expect, it } from "vitest";
import { COMPACT_GUEST_ACTION_LABEL, desktopSidebarTriggerLabel, MOBILE_DRAWER_SIDE, navigationGroups, navigationItems, nextSidebarCompactState, nextSidebarOpenState, parseSidebarCompactPreference, SidebarContent, SidebarFooter, SidebarHeader, SidebarItem, SidebarSection, sidebarLayoutForWidth, sidebarTriggerLabel, shouldRenderDesktopSidebar, SIDEBAR_DESKTOP_BREAKPOINT, SIDEBAR_DESKTOP_SIDE, SIDEBAR_DIALOG_DESCRIPTION, SIDEBAR_DIALOG_TITLE } from "./SiteSidebar";

describe("عناصر القائمة الجانبية", () => {
  it("تحتوي على مسارات الاستكشاف المطلوبة", () => {
    expect(navigationItems.map(item => item.label)).toEqual(["الرئيسية", "كل المكتبة", "المجموعات"]);
    expect(navigationItems.find(item => item.label === "المجموعات")?.href).toBe("/groups");
    expect(navigationItems.find(item => item.label === "كل المكتبة")?.href).toBe("/#library");
    expect(navigationGroups).toHaveLength(1);
  });

  it("تعرّف الدرج بعنوان عربي متاح لقارئات الشاشة", () => {
    expect(SIDEBAR_DIALOG_TITLE).toBe("قائمة التنقل الرئيسية");
    expect(SIDEBAR_DIALOG_DESCRIPTION).toContain("تنقل بين صفحات");
  });

  it("يبدل زر التحكم بين الفتح والإغلاق بتسمية وصول واضحة", () => {
    expect(nextSidebarOpenState(false)).toBe(true);
    expect(nextSidebarOpenState(true)).toBe(false);
    expect(sidebarTriggerLabel(false)).toBe("فتح قائمة التنقل");
    expect(sidebarTriggerLabel(true)).toBe("إغلاق قائمة التنقل");
  });

  it("يدعم الانتقال بين العرض الموسع والمصغر دون تغيير روابط القائمة", () => {
    expect(nextSidebarCompactState(false)).toBe(true);
    expect(nextSidebarCompactState(true)).toBe(false);
    expect(navigationItems.every(item => item.label && item.icon)).toBe(true);
  });

  it("يفسر تفضيل العرض المصغر المخزن بأمان", () => {
    expect(parseSidebarCompactPreference("collapsed")).toBe(true);
    expect(parseSidebarCompactPreference("expanded")).toBe(false);
    expect(parseSidebarCompactPreference(null)).toBe(false);
  });

  it("يفصل بين درج الهاتف والشريط المكتبي المتجاوب", () => {
    expect(sidebarLayoutForWidth(360)).toBe("mobile");
    expect(sidebarLayoutForWidth(768)).toBe("mobile");
    expect(sidebarLayoutForWidth(SIDEBAR_DESKTOP_BREAKPOINT)).toBe("desktop");
    expect(sidebarLayoutForWidth(1440)).toBe("desktop");
    expect(desktopSidebarTriggerLabel(false)).toBe("تصغير قائمة التنقل");
    expect(desktopSidebarTriggerLabel(true)).toBe("توسيع قائمة التنقل");
    expect(COMPACT_GUEST_ACTION_LABEL).toBe("توسيع القائمة لتسجيل الدخول");
    expect(SIDEBAR_DESKTOP_SIDE).toBe("left");
    expect(MOBILE_DRAWER_SIDE).toBe("left");
    expect(shouldRenderDesktopSidebar(430)).toBe(false);
    expect(shouldRenderDesktopSidebar(SIDEBAR_DESKTOP_BREAKPOINT)).toBe(true);
  });

  it("يثبت نمط التنقل عند جميع عروض التحقق المطلوبة", () => {
    const expectedLayouts = new Map([
      [360, "mobile"], [390, "mobile"], [430, "mobile"], [768, "mobile"],
      [1024, "desktop"], [1280, "desktop"], [1440, "desktop"], [1920, "desktop"],
    ] as const);
    expectedLayouts.forEach((layout, width) => expect(sidebarLayoutForWidth(width)).toBe(layout));
  });

  it("يصدر واجهات التركيب القابلة لإعادة الاستخدام دون تغيير بيانات التنقل", () => {
    expect(typeof SidebarHeader).toBe("function");
    expect(typeof SidebarSection).toBe("function");
    expect(typeof SidebarItem).toBe("function");
    expect(typeof SidebarFooter).toBe("function");
    expect(typeof SidebarContent).toBe("function");
    expect(navigationGroups.flatMap(group => group.items)).toEqual(navigationItems);
  });
});
