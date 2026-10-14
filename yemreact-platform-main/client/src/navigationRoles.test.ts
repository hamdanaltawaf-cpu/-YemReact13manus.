import { describe, expect, it } from "vitest";
import { canAccessAdmin } from "@shared/googleRoles";

describe("ظهور رابط الإدارة", () => {
  it("يعرض رابط الإدارة للمسؤول فقط ويخفيه للمستخدم العادي والزائر", () => {
    expect(canAccessAdmin("admin")).toBe(true);
    expect(canAccessAdmin("user")).toBe(false);
    expect(canAccessAdmin(null)).toBe(false);
  });
});
