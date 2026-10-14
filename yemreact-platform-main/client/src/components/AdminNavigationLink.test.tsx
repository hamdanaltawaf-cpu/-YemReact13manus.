import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import { AdminNavigationLink } from "./AdminNavigationLink";

describe("رابط إدارة الواجهة", () => {
  it("يعرض رابط الإدارة للمسؤول فقط بعد وصول role من جلسة Google", () => {
    const adminMarkup = renderToStaticMarkup(<AdminNavigationLink role="admin" className="admin-link" />);
    const userMarkup = renderToStaticMarkup(<AdminNavigationLink role="user" className="admin-link" />);
    expect(adminMarkup).toContain('href="/admin"');
    expect(adminMarkup).toContain("الإدارة");
    expect(userMarkup).toBe("");
  });
});
