import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { navigationItems, SidebarUserActions } from "./SiteSidebar";

describe("حالة حساب القائمة الجانبية", () => {
  const common = { onClose: vi.fn(), onLogout: vi.fn() };
  it("تظهر الإرسال للمستخدم العادي فقط وتخفي عمليات المعالجة من القائمة", () => {
    const user = renderToStaticMarkup(<SidebarUserActions {...common} user={{ name: "قارئ", email: "reader@example.test", role: "user" }} />);
    const admin = renderToStaticMarkup(<SidebarUserActions {...common} user={{ name: "Hamdan", email: "hamdanaltawaf@gmail.com", role: "admin" }} />);
    expect(user).toContain("مستخدم");
    expect(user).not.toContain('href="/admin"');
    expect(user).toContain('href="/submit"');
    expect(user).not.toContain("عمليات المعالجة");
    expect(admin).toContain("مسؤول");
    expect(admin).toContain('href="/admin"');
    expect(admin).not.toContain('href="/submit"');
    expect(admin).not.toContain("عمليات المعالجة");
  });

  it("يبقي قائمة الاستكشاف العامة خالية من الإرسال للزائر", () => {
    expect(navigationItems.map(item => item.label)).toEqual(["الرئيسية", "كل المكتبة", "المجموعات"]);
    expect(navigationItems.map(item => item.href)).not.toContain("/submit");
  });
});
