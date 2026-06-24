'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  QrCode,
  ShoppingBag,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import NotificationBell from '@/components/NotificationBell';
import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { useNotificationQuery } from '@/hooks/useNotificationQuery';
import { useLocale } from '@/lib/locale';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useSidebar } from './SidebarContext';

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

type NavItem = {
  href: string;
  labelKey: string;
  fallback: string;
};

type NavSection = {
  title: string;
  href: string;
  icon: LucideIcon;
  items: NavItem[];
};

const NAV_MAIN: NavSection[] = [
  {
    title: 'Main',
    href: '/dashboard',
    icon: LayoutDashboard,
    items: [{ href: '/dashboard', labelKey: 'nav.dashboard', fallback: 'Dashboard' }],
  },
  {
    title: 'Store',
    href: '/dashboard/chats',
    icon: ShoppingBag,
    items: [
      { href: '/dashboard/chats', labelKey: 'nav.inbox', fallback: 'Inbox' },
      { href: '/dashboard/orders', labelKey: 'nav.orders', fallback: 'Orders' },
      { href: '/dashboard/finance', labelKey: 'nav.finance', fallback: 'Finance' },
      { href: '/dashboard/products', labelKey: 'nav.products', fallback: 'Products' },
      { href: '/dashboard/rules', labelKey: 'nav.faq_rules', fallback: 'Knowledge Base' },
    ],
  },
  {
    title: 'Billing',
    href: '/dashboard/usage',
    icon: CreditCard,
    items: [
      { href: '/dashboard/usage', labelKey: 'nav.usage', fallback: 'Usage' },
      { href: '/dashboard/plans', labelKey: 'nav.plans', fallback: 'Plans' },
      { href: '/dashboard/billing/history', labelKey: 'nav.payment_history', fallback: 'Payment History' },
      { href: '/dashboard/activate-code', labelKey: 'nav.activate_code', fallback: 'Activate Code' },
    ],
  },
  {
    title: 'Setup',
    href: '/dashboard/connect',
    icon: QrCode,
    items: [
      { href: '/dashboard/connect', labelKey: 'nav.connect', fallback: 'WhatsApp' },
      { href: '/dashboard/settings', labelKey: 'nav.settings', fallback: 'Settings' },
    ],
  },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/dashboard') {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function translatedLabel(t: (key: string) => string, item: NavItem) {
  const label = t(item.labelKey);
  return label === item.labelKey ? item.fallback : label;
}

type SidebarBodyProps = {
  collapsed: boolean;
  mobile?: boolean;
  onLogoutRequest: () => void;
  onMobileClose: () => void;
  onToggleCollapsed: () => void;
  pathname: string;
  showUpgradeAd: boolean;
  t: (key: string) => string;
  unreadCount: number;
};

function SidebarBody({
  collapsed,
  mobile = false,
  onLogoutRequest,
  onMobileClose,
  onToggleCollapsed,
  pathname,
  showUpgradeAd,
  t,
  unreadCount,
}: SidebarBodyProps) {
  const expanded = !collapsed || mobile;

  return (
    <SidebarPrimitive
      className={cn(
        'h-full border-r border-sidebar-border shadow-sm transition-[width] duration-300 ease-in-out',
        mobile ? 'w-64' : collapsed ? 'w-[60px]' : 'w-56'
      )}
    >
      <SidebarHeader className={cn(expanded ? 'justify-between px-4' : 'justify-center px-0')}>
        {expanded && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="lg" className="h-10 justify-start px-0 hover:bg-transparent">
                <Link href="/dashboard" onClick={mobile ? onMobileClose : undefined}>
                  <Image
                    src="/assets/logo-text.jpeg"
                    alt="SalesPilot"
                    width={120}
                    height={32}
                    className="max-h-[30px] w-auto rounded-md object-contain"
                    priority
                  />
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}

        {!mobile && (
          <button
            onClick={onToggleCollapsed}
            className="flex size-7 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        )}

        {mobile && (
          <button
            onClick={onMobileClose}
            className="flex size-7 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Close sidebar"
          >
            <X size={15} />
          </button>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV_MAIN.map((section, index) => {
              const Icon = section.icon;
              const sectionActive = section.items.some((item) => isActivePath(pathname, item.href));
              const sectionSelected = sectionActive && !expanded;

              return (
                <Fragment key={section.title}>
                  {index > 0 && (
                    <SidebarMenuItem aria-hidden className="py-1">
                      <div
                        className={cn(
                          'h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent',
                          expanded ? 'mx-2' : 'mx-auto w-5'
                        )}
                      />
                    </SidebarMenuItem>
                  )}

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={sectionSelected}
                      title={!expanded ? section.title : undefined}
                      className={cn(
                        'justify-start',
                        expanded && sectionActive && 'bg-sidebar-accent/30 text-sidebar-foreground',
                        !expanded && 'justify-center px-0'
                      )}
                    >
                      <Link href={section.href} onClick={mobile ? onMobileClose : undefined}>
                        {sectionSelected && (
                          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-emerald-500" />
                        )}
                        <Icon />
                        {expanded && <span className="truncate">{section.title}</span>}
                        {!expanded && (
                          <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-xl transition-opacity group-hover/menu-button:opacity-100">
                            {section.title}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>

                    {expanded && (
                      <SidebarMenuSub className={cn(sectionActive && 'border-l-emerald-500/60')}>
                        {section.items.map((item) => {
                          const active = isActivePath(pathname, item.href);
                          const isChats = item.href === '/dashboard/chats';
                          const label = translatedLabel(t, item);

                          return (
                            <SidebarMenuSubItem key={item.href}>
                              <SidebarMenuSubButton asChild isActive={active}>
                                <Link href={item.href} onClick={mobile ? onMobileClose : undefined}>
                                  {active && (
                                    <span className="absolute -left-[9px] top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-emerald-500" />
                                  )}
                                  <span className="truncate">{label}</span>
                                  {isChats && unreadCount > 0 && (
                                    <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-none text-white">
                                      {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                  )}
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                </Fragment>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <div className="space-y-1 border-t border-sidebar-border px-2 pb-3 pt-2">
        {showUpgradeAd && expanded && (
          <div className="mb-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Zap size={14} className="fill-amber-500 text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-wide text-amber-500">Reactivate AI</span>
            </div>
            <p className="mb-2.5 text-[10px] leading-snug text-muted-foreground">
              Upgrade to unlock up to 5,000 AI replies and unlimited inbound messages.
            </p>
            <Link
              href="/dashboard/plans"
              onClick={mobile ? onMobileClose : undefined}
              className="block w-full rounded-lg border border-amber-500/30 bg-amber-500/20 py-1.5 text-center text-[11px] font-bold text-amber-500 transition-colors hover:bg-amber-500/30"
            >
              Upgrade Now
            </Link>
          </div>
        )}

        <NotificationBell collapsed={collapsed} mobile={mobile} />

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onLogoutRequest}
              title={!expanded ? t('nav.logout') : undefined}
              className={cn('hover:bg-destructive/10 hover:text-destructive', !expanded && 'justify-center px-0')}
            >
              <LogOut />
              {expanded && <span>{t('nav.logout')}</span>}
              {!expanded && (
                <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-xl transition-opacity group-hover/menu-button:opacity-100">
                  {t('nav.logout')}
                </span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>

      <SidebarRail />
    </SidebarPrimitive>
  );
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showLogout, setShowLogout] = useState(false);
  const { data } = useNotificationQuery();
  const unreadCount = data?.total_unread || 0;
  const { collapsed, setCollapsed } = useSidebar();
  const { t } = useLocale();

  const business = useAppStore((s) => s.business);
  const usage = useAppStore((s) => s.usage);
  const clearSession = useAppStore((s) => s.clearSession);
  const isFreePlan = business?.plan === 'free';
  const isTrialActive = usage?.active_trial === true;
  const showUpgradeAd = isFreePlan && !isTrialActive;

  async function logout() {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    clearSession();
    router.push('/login');
  }

  return (
    <>
      <div className="hidden h-screen shrink-0 md:flex md:sticky md:top-0">
        <SidebarBody
          collapsed={collapsed}
          onLogoutRequest={() => setShowLogout(true)}
          onMobileClose={onMobileClose}
          onToggleCollapsed={() => setCollapsed(!collapsed)}
          pathname={pathname}
          showUpgradeAd={showUpgradeAd}
          t={t}
          unreadCount={unreadCount}
        />
      </div>

      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden',
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onMobileClose}
        aria-hidden
      />

      <div
        className={cn(
          'fixed left-0 top-0 z-50 h-full transition-transform duration-300 ease-in-out md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarBody
          collapsed={collapsed}
          mobile
          onLogoutRequest={() => setShowLogout(true)}
          onMobileClose={onMobileClose}
          onToggleCollapsed={() => setCollapsed(!collapsed)}
          pathname={pathname}
          showUpgradeAd={showUpgradeAd}
          t={t}
          unreadCount={unreadCount}
        />
      </div>

      {showLogout && (
        <div className="fixed inset-0 z-60 flex animate-in fade-in items-center justify-center bg-black/70 p-4 backdrop-blur-sm duration-200">
          <div className="w-full max-w-sm animate-in rounded-2xl border border-border bg-background p-6 shadow-2xl duration-200 zoom-in-95">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <LogOut size={19} className="text-red-400" />
              </div>
              <h3 className="text-base font-bold text-foreground">{t('auth.logout')}</h3>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
              {t('common.confirm')}? {t('auth.logout').toLowerCase()} SalesPilot?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLogout(false)}
                className="rounded-xl px-5 py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={logout}
                className="rounded-xl bg-red-500 px-5 py-2 text-sm font-bold text-white shadow-md transition-colors hover:bg-red-600"
              >
                {t('auth.logout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
