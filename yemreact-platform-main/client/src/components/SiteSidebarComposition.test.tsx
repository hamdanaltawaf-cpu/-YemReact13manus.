/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { navigationGroups, navigationItems, SidebarFooter, SidebarHeader, SidebarItem, SidebarSection } from "./SiteSidebar";

afterEach(() => cleanup());

vi.mock("wouter", async () => {
  const React = await import("react");
  return {
    Link: ({ href, children, onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => React.createElement("a", { href, ...props, onClick: event => { event.preventDefault(); onClick?.(event as React.MouseEvent<HTMLAnchorElement>); } }, children),
    useLocation: () => ["/", vi.fn()],
  };
});

vi.mock("@/components/ui/tooltip", async () => {
  const React = await import("react");
  return {
    Tooltip: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    TooltipTrigger: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    TooltipContent: ({ children }: { children: React.ReactNode }) => React.createElement("span", null, children),
  };
});

describe("تركيب وحدات الشريط", () => {
  it("يبقي الرأس رابط العودة ومحتوى العلامة وزر الإغلاق", () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    render(<SidebarHeader compact={false} onNavigate={onNavigate} onClose={onClose} />);

    expect(screen.getByRole("link", { name: "العودة إلى الرئيسية" }).getAttribute("href")).toBe("/");
    expect(screen.getByText("يمن رياكت")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "إغلاق قائمة التنقل" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("يعرض القسم العناصر الحالية ويحافظ على المسار النشط", () => {
    const onNavigate = vi.fn();
    render(<SidebarSection group={navigationGroups[0]} location="/" hash="" compact={false} onNavigate={onNavigate} />);

    expect(screen.getByText("استكشف")).toBeTruthy();
    const home = screen.getByRole("link", { name: /الرئيسية/ });
    expect(home.getAttribute("href")).toBe("/");
    expect(home.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /المجموعات/ }).getAttribute("href")).toBe("/groups");
  });

  it("يعرض العنصر والتذييل القابلين لإعادة الاستخدام من دون تغيير محتواهما", () => {
    const onNavigate = vi.fn();
    render(<><SidebarItem item={navigationItems[1]} active={false} compact={false} onNavigate={onNavigate} /><SidebarFooter><span>محتوى الحساب</span></SidebarFooter></>);

    expect(screen.getByRole("link", { name: /كل المكتبة/ }).getAttribute("href")).toBe("/#library");
    expect(screen.getByText("محتوى الحساب").parentElement?.className).toContain("site-sidebar__account");
  });
});
