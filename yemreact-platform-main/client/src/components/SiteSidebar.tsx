import { BookOpen, ChevronLeft, FolderKanban, Home, LogIn, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Send, ShieldCheck, UserRound, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { canAccessAdmin } from "@shared/googleRoles";
import { BrandMark } from "@/components/BrandMark";
import { trpc } from "@/lib/trpc";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";

const LazySidebarGuestSignIn = lazy(() => import("./SidebarGuestSignIn"));

export const navigationGroups = [
  {
    label: "استكشف",
    description: "مكتبة يمن رياكت",
    items: [
      { label: "الرئيسية", href: "/", icon: Home, hint: "أحدث الرياكشنات" },
      { label: "كل المكتبة", href: "/#library", icon: BookOpen, hint: "تصفّح واكتشف" },
      { label: "المجموعات", href: "/groups", icon: FolderKanban, hint: "مرتبة حسب الموقف" },
    ],
  },
] as const;

export const navigationItems = navigationGroups.flatMap(group => group.items);
export const SIDEBAR_DIALOG_TITLE = "قائمة التنقل الرئيسية";
export const SIDEBAR_DIALOG_DESCRIPTION = "تنقل بين صفحات مكتبة YemReact وخيارات حسابك.";
export const SIDEBAR_DRAWER_ID = "yemreact-site-drawer";
export const SIDEBAR_DESKTOP_ID = "yemreact-site-sidebar";
export const SIDEBAR_DESKTOP_SIDE = "left";
export const MOBILE_DRAWER_SIDE = "left";
export const SIDEBAR_COMPACT_STORAGE_KEY = "yemreact:sidebar-compact";
export const SIDEBAR_DESKTOP_BREAKPOINT = 1024;
export const COMPACT_GUEST_ACTION_LABEL = "توسيع القائمة لتسجيل الدخول";

export function nextSidebarOpenState(currentOpen: boolean) {
  return !currentOpen;
}

export function nextSidebarCompactState(currentCompact: boolean) {
  return !currentCompact;
}

export function parseSidebarCompactPreference(value: string | null) {
  return value === "collapsed";
}

export function sidebarLayoutForWidth(width: number) {
  return width >= SIDEBAR_DESKTOP_BREAKPOINT ? "desktop" : "mobile";
}

export function shouldRenderDesktopSidebar(width: number) {
  return sidebarLayoutForWidth(width) === "desktop";
}

export function sidebarTriggerLabel(open: boolean) {
  return open ? "إغلاق قائمة التنقل" : "فتح قائمة التنقل";
}

export function desktopSidebarTriggerLabel(compact: boolean) {
  return compact ? "توسيع قائمة التنقل" : "تصغير قائمة التنقل";
}

type SidebarUser = { name: string | null; email: string | null; role: "admin" | "user" };

function SidebarAction({ href, label, icon: Icon, onClose, compact, children }: { href?: string; label: string; icon: typeof Send; onClose: () => void; compact: boolean; children?: React.ReactNode }) {
  const content = <><Icon size={16} aria-hidden="true" /><span className="drawer-account-actions__label">{label}</span>{children}</>;
  if (href) return <a href={href} aria-label={label} title={compact ? label : undefined} onClick={onClose}>{content}</a>;
  return <button type="button" aria-label={label} title={compact ? label : undefined} onClick={onClose}>{content}</button>;
}

export function SidebarUserActions({ user, onClose, onLogout, unreadCount = 0, compact = false }: { user: SidebarUser; onClose: () => void; onLogout: () => void; unreadCount?: number; compact?: boolean }) {
  const isAdmin = canAccessAdmin(user.role);
  return <>
    <div className="drawer-user">
      <div className="drawer-user__avatar" aria-hidden="true">{user.name?.slice(0, 1) || user.email?.slice(0, 1) || "ي"}</div>
      <div><b>{user.name || "حساب Google"}</b><span>{user.email}</span><em>{isAdmin ? "مسؤول" : "مستخدم"}</em></div>
    </div>
    <div className="drawer-account-actions">
      {!isAdmin && <SidebarAction href="/submit" label="أرسل رياكشن" icon={Send} onClose={onClose} compact={compact} />}
      <SidebarAction href="/account" label="حسابي" icon={UserRound} onClose={onClose} compact={compact}>
        {unreadCount > 0 && <small className="notification-count">{unreadCount}</small>}
      </SidebarAction>
      {isAdmin && <SidebarAction href="/admin" label="الإدارة" icon={ShieldCheck} onClose={onClose} compact={compact} />}
      <SidebarAction label="تسجيل الخروج" icon={LogOut} onClose={onLogout} compact={compact} />
    </div>
  </>;
}

type NavigationItem = (typeof navigationItems)[number];

function isActiveNavigationItem(item: NavigationItem, location: string, hash: string) {
  if (item.href === "/#library") return location === "/" && hash === "#library";
  if (item.href === "/") return location === "/" && hash !== "#library";
  return location === item.href;
}

export type SidebarItemProps = { item: NavigationItem; active: boolean; compact: boolean; onNavigate: (href: string) => void };

export function SidebarItem({ item, active, compact, onNavigate }: SidebarItemProps) {
  const link = <Link href={item.href} className={`site-sidebar__item ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined} aria-label={compact ? item.label : undefined} onClick={() => onNavigate(item.href)}>
    <span className="site-sidebar__item-icon" aria-hidden="true"><item.icon size={19} strokeWidth={1.9} /></span>
    <span className="site-sidebar__item-copy"><b>{item.label}</b><small>{item.hint}</small></span>
    <ChevronLeft size={16} className="site-sidebar__chevron" aria-hidden="true" />
  </Link>;

  if (!compact) return link;
  return <Tooltip delayDuration={150}><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="left" sideOffset={14} className="site-sidebar-tooltip">{item.label}</TooltipContent></Tooltip>;
}

export type SidebarHeaderProps = {
  compact: boolean;
  onNavigate: (href: string) => void;
  onClose?: () => void;
};

export function SidebarHeader({ compact, onNavigate, onClose }: SidebarHeaderProps) {
  return <header className="site-sidebar__header">
    <div className="site-sidebar__header-top">
      <Link href="/" className="site-sidebar__brand-card" aria-label="العودة إلى الرئيسية" onClick={() => { onNavigate("/"); onClose?.(); }}>
        <span className="site-sidebar__brand-mark"><BrandMark size={32} /></span>
        <span className="site-sidebar__wordmark"><small>YemReact</small><b>يمن رياكت</b></span>
      </Link>
      {onClose && <button type="button" className="site-sidebar__close" aria-label="إغلاق قائمة التنقل" onClick={onClose}><X size={20} /></button>}
    </div>
    <div className="site-sidebar__header-copy"><b>ردّك جاهز.</b><p>ابحث بالموقف، وخذ الرياكشن الذي يقول كلامك.</p></div>
    {!compact && <div className="site-sidebar__pulse"><span><BookOpen size={14} aria-hidden="true" /> مكتبة رياكشن يمنية</span><i aria-hidden="true" /></div>}
  </header>;
}

export type SidebarSectionProps = {
  group: (typeof navigationGroups)[number];
  location: string;
  hash: string;
  compact: boolean;
  onNavigate: (href: string) => void;
};

export function SidebarSection({ group, location, hash, compact, onNavigate }: SidebarSectionProps) {
  return <section className="site-sidebar__group">
    <div className="site-sidebar__group-heading"><span>{group.label}</span><small>{group.description}</small></div>
    {group.items.map(item => <SidebarItem key={item.label} item={item} active={isActiveNavigationItem(item, location, hash)} compact={compact} onNavigate={onNavigate} />)}
  </section>;
}

export function SidebarFooter({ children }: { children: React.ReactNode }) {
  return <footer className="site-sidebar__account">{children}</footer>;
}

export type SidebarContentProps = {
  compact: boolean;
  location: string;
  hash: string;
  onNavigate: (href: string) => void;
  onClose?: () => void;
  user: SidebarUser | null | undefined;
  loading: boolean;
  unreadCount: number;
  onLogout: () => void;
  onRequestExpand?: () => void;
};

export function SidebarContent({ compact, location, hash, onNavigate, onClose, user, loading, unreadCount, onLogout, onRequestExpand }: SidebarContentProps) {
  return <div className="site-sidebar__panel">
    <SidebarHeader compact={compact} onNavigate={onNavigate} onClose={onClose} />

    <nav className="site-sidebar__nav" aria-label="قائمة الموقع">
      {navigationGroups.map(group => <SidebarSection key={group.label} group={group} location={location} hash={hash} compact={compact} onNavigate={onNavigate} />)}
    </nav>

    <SidebarFooter>
      {loading ? <p className="drawer-loading">جارٍ تجهيز الحساب…</p> : !user ? compact ? <button type="button" className="site-sidebar__guest-compact" aria-label={COMPACT_GUEST_ACTION_LABEL} title={COMPACT_GUEST_ACTION_LABEL} onClick={onRequestExpand} disabled={!onRequestExpand}><LogIn size={18} aria-hidden="true" /><span>تسجيل الدخول</span></button> : <>
        <div className="drawer-account-copy"><LogIn size={17} aria-hidden="true" /><div><b>حساب YemReact</b><span>سجّل الدخول لحفظ الرياكشنات وإرسال مساهمتك.</span></div></div>
        <Suspense fallback={<span className="drawer-google-signin google-signin-loading" role="status">جارٍ تجهيز تسجيل الدخول…</span>}>
          <LazySidebarGuestSignIn onSignedIn={onClose} />
        </Suspense>
      </> : <SidebarUserActions user={user} unreadCount={unreadCount} compact={compact} onClose={() => onClose?.()} onLogout={onLogout} />}
    </SidebarFooter>
  </div>;
}

export function SiteSidebar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compact, setCompact] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return parseSidebarCompactPreference(window.localStorage.getItem(SIDEBAR_COMPACT_STORAGE_KEY)); } catch { return false; }
  });
  const [desktopViewport, setDesktopViewport] = useState(() => typeof window !== "undefined" && sidebarLayoutForWidth(window.innerWidth) === "desktop");
  const [hash, setHash] = useState(() => typeof window !== "undefined" ? window.location.hash : "");
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const [location, setLocation] = useLocation();
  const { user, loading, logout } = useAuth();
  const notifications = trpc.account.unreadNotifications.useQuery(undefined, { enabled: Boolean(user) });

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${SIDEBAR_DESKTOP_BREAKPOINT}px)`);
    const update = () => setDesktopViewport(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.yrSidebar = compact ? "compact" : "expanded";
  }, [compact]);

  useEffect(() => {
    if (desktopViewport) setDrawerOpen(false);
  }, [desktopViewport]);

  useEffect(() => {
    if (!desktopViewport) setDrawerOpen(false);
  }, [location, desktopViewport]);

  useEffect(() => {
    if (!drawerOpen || desktopViewport) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [drawerOpen, desktopViewport]);

  const restoreMobileTriggerFocus = useCallback(() => {
    window.requestAnimationFrame(() => mobileTriggerRef.current?.focus());
  }, []);

  const setMobileDrawerOpen = useCallback((nextOpen: boolean) => {
    setDrawerOpen(nextOpen);
    if (!nextOpen) restoreMobileTriggerFocus();
  }, [restoreMobileTriggerFocus]);

  useEffect(() => {
    if (!drawerOpen || desktopViewport) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileDrawerOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [drawerOpen, desktopViewport, setMobileDrawerOpen]);

  const toggleMobileDrawer = useCallback(() => {
    setDrawerOpen(currentOpen => {
      const nextOpen = nextSidebarOpenState(currentOpen);
      if (!nextOpen) restoreMobileTriggerFocus();
      return nextOpen;
    });
  }, [restoreMobileTriggerFocus]);

  const toggleCompact = useCallback(() => {
    setCompact(currentCompact => {
      const nextCompact = nextSidebarCompactState(currentCompact);
      try { window.localStorage.setItem(SIDEBAR_COMPACT_STORAGE_KEY, nextCompact ? "collapsed" : "expanded"); } catch {}
      return nextCompact;
    });
  }, []);

  const navigateTo = useCallback((href: string, closeMobileDrawer = false) => {
    if (href === "/#library") {
      if (location !== "/") setLocation("/");
      setHash("#library");
      window.setTimeout(() => {
        window.history.replaceState(null, "", "/#library");
        document.getElementById("library")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } else {
      setHash("");
    }
    if (closeMobileDrawer) setMobileDrawerOpen(false);
  }, [location, setLocation, setMobileDrawerOpen]);

  const unreadCount = notifications.data?.length ?? 0;
  const desktopContent = <SidebarContent compact={compact} location={location} hash={hash} onNavigate={href => navigateTo(href)} user={user} loading={loading} unreadCount={unreadCount} onLogout={logout} onRequestExpand={compact ? toggleCompact : undefined} />;
  const mobileContent = <SidebarContent compact={false} location={location} hash={hash} onNavigate={href => navigateTo(href, true)} onClose={() => setMobileDrawerOpen(false)} user={user} loading={loading} unreadCount={unreadCount} onLogout={() => { setMobileDrawerOpen(false); logout(); }} />;

  return <>
    {desktopViewport ? <aside id={SIDEBAR_DESKTOP_ID} className="site-sidebar-desktop" data-side={SIDEBAR_DESKTOP_SIDE} data-compact={compact} data-visual-state={compact ? "compact" : "expanded"} dir="rtl">
      <button type="button" className="site-sidebar__collapse" aria-controls={SIDEBAR_DESKTOP_ID} aria-label={desktopSidebarTriggerLabel(compact)} aria-expanded={!compact} aria-pressed={compact} onClick={toggleCompact}>
        {compact ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
      </button>
      {desktopContent}
    </aside> : <>
      <button ref={mobileTriggerRef} type="button" className="site-menu-trigger" data-state={drawerOpen ? "open" : "closed"} aria-label={sidebarTriggerLabel(drawerOpen)} aria-expanded={drawerOpen} aria-haspopup="dialog" aria-controls={SIDEBAR_DRAWER_ID} onClick={toggleMobileDrawer}>
        <span className="site-menu-trigger__icon" aria-hidden="true">{drawerOpen ? <X size={23} strokeWidth={2.4} /> : <Menu size={24} strokeWidth={2.4} />}</span>
      </button>

      <Sheet open={drawerOpen} onOpenChange={setMobileDrawerOpen}>
        <SheetContent id={SIDEBAR_DRAWER_ID} side={MOBILE_DRAWER_SIDE} data-navigation-side={MOBILE_DRAWER_SIDE} className="site-mobile-drawer" dir="rtl" showCloseButton={false} onCloseAutoFocus={event => { event.preventDefault(); restoreMobileTriggerFocus(); }}>
          <SheetTitle className="sr-only">{SIDEBAR_DIALOG_TITLE}</SheetTitle>
          <SheetDescription className="sr-only">{SIDEBAR_DIALOG_DESCRIPTION}</SheetDescription>
          {mobileContent}
        </SheetContent>
      </Sheet>
    </>}
  </>;
}
