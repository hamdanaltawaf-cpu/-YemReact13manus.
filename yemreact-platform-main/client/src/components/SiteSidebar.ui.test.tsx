/* @vitest-environment jsdom */
import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SIDEBAR_COMPACT_STORAGE_KEY, SIDEBAR_DESKTOP_BREAKPOINT, SIDEBAR_DRAWER_ID, SiteSidebar } from "./SiteSidebar";

const authState = vi.hoisted(() => ({ logout: vi.fn() }));
const routerState = vi.hoisted(() => {
  const listeners = new Set<(location: string) => void>();
  return {
    location: "/",
    listeners,
    navigate(location: string) {
      this.location = location;
      listeners.forEach(listener => listener(location));
    },
  };
});

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, loading: false, logout: authState.logout }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: { account: { unreadNotifications: { useQuery: () => ({ data: [] }) } } },
}));

vi.mock("@/components/GoogleSignInButton", () => ({
  GoogleSignInButton: () => <button type="button">Google mock</button>,
}));

vi.mock("./SidebarGuestSignIn", () => ({
  default: () => <button type="button">Google mock</button>,
}));

vi.mock("wouter", async () => {
  const React = await import("react");
  return {
    Link: ({ href, children, onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => React.createElement("a", { href, ...props, onClick: event => { event.preventDefault(); onClick?.(event as React.MouseEvent<HTMLAnchorElement>); } }, children),
    useLocation: () => {
      const [, setLocation] = React.useState(routerState.location);
      React.useEffect(() => {
        const listener = (location: string) => setLocation(location);
        routerState.listeners.add(listener);
        return () => { routerState.listeners.delete(listener); };
      }, []);
      return [routerState.location, (location: string) => routerState.navigate(location)] as const;
    },
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

vi.mock("@/components/ui/sheet", async () => {
  const React = await import("react");
  type SheetChild = React.ReactElement<{ __testOpen?: boolean }>;
  return {
    Sheet: ({ open, children }: { open: boolean; children: SheetChild }) => React.cloneElement(children, { __testOpen: open }),
    SheetContent: ({ __testOpen, children, showCloseButton: _showCloseButton, onCloseAutoFocus: _onCloseAutoFocus, ...props }: React.HTMLAttributes<HTMLElement> & { __testOpen?: boolean; showCloseButton?: boolean; onCloseAutoFocus?: () => void }) => __testOpen ? React.createElement("section", { ...props, role: "dialog" }, children) : null,
    SheetTitle: ({ children }: { children: React.ReactNode }) => React.createElement("h2", null, children),
    SheetDescription: ({ children }: { children: React.ReactNode }) => React.createElement("p", null, children),
  };
});

let mediaListener: ((event: MediaQueryListEvent) => void) | undefined;
let mediaMatches = false;

function setViewport(width: number) {
  mediaMatches = width >= SIDEBAR_DESKTOP_BREAKPOINT;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  window.matchMedia = vi.fn().mockImplementation(query => ({
    get matches() { return mediaMatches; },
    media: query,
    addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => { mediaListener = listener; },
    removeEventListener: () => { mediaListener = undefined; },
  }));
}

describe("تفاعل درج الهاتف", () => {
  beforeEach(() => {
    setViewport(390);
    authState.logout.mockReset();
    routerState.location = "/";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    mediaListener = undefined;
  });

  it("يفتح الدرج من الزر ويغلقه من زر الإغلاق أو عند تغير المسار الفعلي", () => {
    render(<SiteSidebar />);

    const trigger = screen.getByRole("button", { name: "فتح قائمة التنقل" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    fireEvent.click(trigger);
    expect(document.getElementById(SIDEBAR_DRAWER_ID)).not.toBeNull();
    expect(document.getElementById(SIDEBAR_DRAWER_ID)?.getAttribute("data-navigation-side")).toBe("left");

    fireEvent.click(screen.getAllByRole("button", { name: "إغلاق قائمة التنقل" })[0]);
    expect(document.getElementById(SIDEBAR_DRAWER_ID)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "فتح قائمة التنقل" }));
    act(() => routerState.navigate("/groups"));
    expect(document.getElementById(SIDEBAR_DRAWER_ID)).toBeNull();
  });

  it("يغلق الدرج بمفتاح Escape ويحافظ على الرابط المرساة من مصدر التنقل نفسه", () => {
    const animationFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => {
      callback(0);
      return 0;
    });
    render(<SiteSidebar />);

    const trigger = screen.getByRole("button", { name: "فتح قائمة التنقل" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("link", { name: /كل المكتبة/ }).getAttribute("href")).toBe("/#library");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.getElementById(SIDEBAR_DRAWER_ID)).toBeNull();
    expect(trigger).toBe(document.activeElement);
    animationFrame.mockRestore();
  });

  it("يغلق الدرج ويستبدل سطح الهاتف بالشريط المكتبي عند تغيير نقطة التحول", () => {
    render(<SiteSidebar />);
    fireEvent.click(screen.getByRole("button", { name: "فتح قائمة التنقل" }));
    expect(document.getElementById(SIDEBAR_DRAWER_ID)).not.toBeNull();

    act(() => {
      setViewport(1440);
      mediaListener?.({ matches: true } as MediaQueryListEvent);
    });
    expect(document.getElementById(SIDEBAR_DRAWER_ID)).toBeNull();
    expect(document.getElementById("yemreact-site-sidebar")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "إغلاق قائمة التنقل" })).toBeNull();
  });

  it("يعرض الشريط الموسع والحالة النشطة داخل SiteSidebar على سطح المكتب", () => {
    setViewport(1280);
    render(<SiteSidebar />);

    const sidebar = document.getElementById("yemreact-site-sidebar");
    expect(sidebar?.getAttribute("data-side")).toBe("left");
    expect(sidebar?.getAttribute("data-visual-state")).toBe("expanded");
    expect(screen.getByRole("button", { name: "تصغير قائمة التنقل" }).getAttribute("aria-expanded")).toBe("true");
    const activeHomeLink = screen.getAllByRole("link").find(link => link.getAttribute("href") === "/" && link.className.includes("site-sidebar__item"));
    expect(activeHomeLink?.getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("button", { name: "فتح قائمة التنقل" })).toBeNull();
  });

  it("يحول الشريط المكتبي إلى أيقونات فقط ثم يعيده موسعاً مع بقاء الرابط النشط", () => {
    setViewport(1280);
    render(<SiteSidebar />);

    fireEvent.click(screen.getByRole("button", { name: "تصغير قائمة التنقل" }));
    const sidebar = document.getElementById("yemreact-site-sidebar");
    expect(sidebar?.getAttribute("data-compact")).toBe("true");
    expect(sidebar?.getAttribute("data-visual-state")).toBe("compact");
    expect(document.documentElement.dataset.yrSidebar).toBe("compact");
    expect(screen.getByRole("button", { name: "توسيع قائمة التنقل" }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.getAllByRole("link").find(link => link.getAttribute("href") === "/" && link.className.includes("site-sidebar__item"))?.getAttribute("aria-current")).toBe("page");

    fireEvent.click(screen.getByRole("button", { name: "توسيع قائمة التنقل" }));
    expect(sidebar?.getAttribute("data-visual-state")).toBe("expanded");
  });

  it("يربط حالة الشريط الفعلية بحاوية المحتوى من دون إضافة أي حاوية متداخلة", () => {
    setViewport(1280);
    render(<><SiteSidebar /><main className="site-main-frame" data-testid="navigation-main-frame">محتوى التطبيق</main></>);

    const mainFrame = screen.getByTestId("navigation-main-frame");
    const sidebar = document.getElementById("yemreact-site-sidebar");
    expect(mainFrame.className).toBe("site-main-frame");
    expect(mainFrame.previousElementSibling).toBe(sidebar);
    expect(sidebar?.getAttribute("data-visual-state")).toBe("expanded");
    expect(document.documentElement.dataset.yrSidebar).toBe("expanded");
    expect(mainFrame.scrollWidth).toBeLessThanOrEqual(mainFrame.clientWidth);

    fireEvent.click(screen.getByRole("button", { name: "تصغير قائمة التنقل" }));
    expect(sidebar?.getAttribute("data-visual-state")).toBe("compact");
    expect(document.documentElement.dataset.yrSidebar).toBe("compact");
    expect(mainFrame.className).toBe("site-main-frame");
    expect(mainFrame.previousElementSibling).toBe(sidebar);
    expect(mainFrame.scrollWidth).toBeLessThanOrEqual(mainFrame.clientWidth);
  });

  it("يطابق كل نقطة تحول مع حالة التنقل المتوقعة", () => {
    for (const width of [360, 390, 430, 768]) {
      setViewport(width);
      const view = render(<SiteSidebar />);
      expect(screen.getByRole("button", { name: "فتح قائمة التنقل" }).getAttribute("aria-expanded")).toBe("false");
      expect(document.getElementById(SIDEBAR_DRAWER_ID)).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "فتح قائمة التنقل" }));
      expect(document.getElementById(SIDEBAR_DRAWER_ID)).not.toBeNull();
      view.unmount();
      document.body.innerHTML = "";
    }

    for (const width of [1024, 1280, 1440, 1920]) {
      window.localStorage.removeItem(SIDEBAR_COMPACT_STORAGE_KEY);
      setViewport(width);
      const view = render(<SiteSidebar />);
      const sidebar = document.getElementById("yemreact-site-sidebar");
      expect(sidebar?.getAttribute("data-visual-state")).toBe("expanded");
      expect(screen.queryByRole("button", { name: "فتح قائمة التنقل" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "تصغير قائمة التنقل" }));
      expect(sidebar?.getAttribute("data-visual-state")).toBe("compact");
      view.unmount();
      document.body.innerHTML = "";
      window.localStorage.removeItem(SIDEBAR_COMPACT_STORAGE_KEY);
    }
  });
});
