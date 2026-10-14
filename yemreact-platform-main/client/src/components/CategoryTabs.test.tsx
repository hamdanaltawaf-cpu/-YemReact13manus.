import { describe, expect, it } from "vitest";
import { GROUPS_ROUTE } from "./CategoryTabs";

describe("تبويبات أقسام المكتبة", () => {
  it("يحدد مسار المجموعات المستقل", () => {
    expect(GROUPS_ROUTE).toBe("/groups");
  });
});
