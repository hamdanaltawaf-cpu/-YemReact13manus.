import { describe, expect, it } from "vitest";
import { ADMIN_TABS } from "./Admin";

describe("تبويبات لوحة الإدارة", () => {
  it("تضم عمليات المعالجة داخل لوحة الإدارة", () => {
    expect(ADMIN_TABS.map(tab => tab.id)).toContain("operations");
    expect(ADMIN_TABS.find(tab => tab.id === "operations")?.label).toBe("عمليات المعالجة");
  });

  it("تحافظ على جميع أقسام الإدارة الأساسية دون تكرار", () => {
    const ids = ADMIN_TABS.map(tab => tab.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(["upload", "import", "library", "contributions", "activity", "operations", "homepage"]);
  });
});
