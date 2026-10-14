# YemReact Navigation — Phase 1 Audit

## نقطة التحكم الرئيسية

| الطبقة | الملف الفعلي | المسؤولية |
|---|---|---|
| Main layout | `client/src/App.tsx` | يغلّف المسارات بـ `ThemeProvider` و`TooltipProvider` ويعرض `SiteSidebar` قبل `site-main-frame`. |
| Public navigation container | `client/src/components/SiteSidebar.tsx` | يحتفظ بحالة التصغير، وحالة درج الهاتف، ونقطة التحول، والموقع، وحالة الحساب. |
| Desktop sidebar | `SiteSidebar` ثم `SidebarContent` | يظهر فقط عند نقطة سطح المكتب ويعرض الرأس والأقسام والتذييل. |
| Mobile navigation | `SiteSidebar` ثم `Sheet`/`SheetContent` | يعرض زر القائمة ودرجاً متحكماً به من اليسار تحت نقطة التحول. |
| User/profile and admin entries | `SidebarUserActions` و`AdminNavigationLink.tsx` | يعتمدان الدور الحقيقي وحالة المصادقة ولا يجري تغييرهما. |
| Admin-only layout | `client/src/components/DashboardLayout.tsx` | نظام إداري منفصل باستخدام مكوّنات sidebar الجاهزة، ولا يدخل ضمن إعادة تصميم التنقل العام. |

## الرموز القائمة التي ستُستخدم في المراحل التالية

| المجال | التطبيق القائم |
|---|---|
| الألوان | `--yr-ink` و`--yr-ink-2` للخلفيات، `--yr-amber-light` للتأكيد، `--yr-paper` للنص، و`--yr-coral` للتركيز. |
| الخطوط | `Cairo` للنص و`Lalezar` للعناوين عبر `--font-body` و`--font-display`. |
| الحركة | `--yr-ease: cubic-bezier(0.23, 1, 0.32, 1)` وانتقالات قصيرة للمحتوى التفاعلي. |
| الأيقونات | `lucide-react`. |
| RTL | `dir="rtl"` داخل المحتوى، بينما موضع السطح يحدد صراحةً: الشريط والدرج يساراً. |
| الاستجابة | `SIDEBAR_DESKTOP_BREAKPOINT = 1024`؛ ما دونه زر ودرج هاتف، وما فوقه الشريط الثابت. |
| نظام الإدارة | يستخدم Tailwind ومكوّن `Sidebar` الجاهز باستقلال عن الشريط العام. |

## حدود المرحلة الأولى

استُخرجت وحدات `SidebarHeader` و`SidebarSection` و`SidebarItem` و`SidebarFooter` من المكوّن القائم، مع بقاء الروابط والمسارات والمصادقة والتصميم وسلوك سطح المكتب والهاتف من دون تغيير. تمهّد هذه الواجهات لتطوير الحالات الموسعة والمصغرة والحركة في المرحلة الثانية من دون دمجها أو تنفيذها الآن.
