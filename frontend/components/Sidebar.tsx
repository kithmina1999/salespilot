'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard, Package, BookOpen, MessageSquare,
  QrCode, LogOut, ShoppingBag, Settings, CreditCard,
  X, ChevronLeft, ChevronRight, TrendingUp,
} from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import { useSidebar } from './SidebarContext';
import { useLocale } from '@/lib/locale';
import { useNotificationQuery } from '@/hooks/useNotificationQuery';
import { useAppStore } from '@/lib/store';
import { Zap } from 'lucide-react';

interface SidebarProps {
  /** Mobile open state — controlled by layout */
  mobileOpen: boolean;
  onMobileClose: () => void;
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
  const isFreePlan = business?.plan === 'free';
  const isTrialActive = usage?.active_trial === true;
  const showUpgradeAd = isFreePlan && !isTrialActive;

  // Nav items built inside component so labels re-render on locale change
  const nav = [
    { href: '/dashboard',          icon: LayoutDashboard, labelKey: 'nav.dashboard' },
    { href: '/dashboard/orders',   icon: ShoppingBag,     labelKey: 'nav.orders'    },
    { href: '/dashboard/finance',  icon: TrendingUp,      labelKey: 'nav.finance'   },
    { href: '/dashboard/products', icon: Package,         labelKey: 'nav.products'  },
    { href: '/dashboard/rules',    icon: BookOpen,        labelKey: 'nav.faq_rules' },
    { href: '/dashboard/chats',    icon: MessageSquare,   labelKey: 'nav.inbox'     },
    { href: '/dashboard/connect',  icon: QrCode,          labelKey: 'nav.connect' }, // WhatsApp connect
    { href: '/dashboard/usage',    icon: CreditCard,      labelKey: 'nav.billing'   },
    { href: '/dashboard/settings', icon: Settings,        labelKey: 'nav.settings'  },
  ];

  // Human-readable fallbacks for collapsed tooltip (always English for icon hints)
  const NAV_FALLBACK: Record<string, string> = {
    '/dashboard':          'Overview',
    '/dashboard/orders':   'Orders',
    '/dashboard/finance':  'Finance',
    '/dashboard/products': 'Products',
    '/dashboard/rules':    'FAQ Rules',
    '/dashboard/chats':    'Chat Logs',
    '/dashboard/connect':  'WhatsApp',
    '/dashboard/usage':    'Usage & Plan',
    '/dashboard/settings': 'Settings',
  };

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.cookie = 'token=; path=/; max-age=0';
    router.push('/login');
  }

  // ── Shared sidebar body (used for both desktop + mobile) ───────────────────
  const SidebarBody = ({ mobile = false }: { mobile?: boolean }) => (
    <aside
      className={`flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out ${
        mobile ? 'w-64' : collapsed ? 'w-[60px]' : 'w-56'
      }`}
    >
      {/* ── Logo row ───────────────────────────────────────────────────────── */}
      <div className={`flex items-center border-b border-sidebar-border shrink-0 h-14 ${collapsed && !mobile ? 'justify-center px-0' : 'px-4 justify-between'}`}>
        {(!collapsed || mobile) && (
          <Image
            src="/assets/logo-text.jpeg"
            alt="SalesPilot"
            width={120}
            height={32}
            className="rounded-md object-contain"
            style={{ maxHeight: '30px', width: 'auto' }}
          />
        )}
        {/* Desktop collapse toggle */}
        {!mobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`flex items-center justify-center w-7 h-7 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors ${collapsed ? '' : ''}`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        )}
        {/* Mobile close */}
        {mobile && (
          <button
            onClick={onMobileClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto py-3 px-2 overflow-x-hidden">
        {nav.map(({ href, icon: Icon, labelKey }) => {
          const label = t(labelKey);
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          const isChats = href === '/dashboard/chats';
          return (
            <Link
              key={href}
              href={href}
              onClick={mobile ? onMobileClose : undefined}
              title={collapsed && !mobile ? (NAV_FALLBACK[href] ?? label) : undefined}
              className={`group relative flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`}
            >
              {/* Active indicator */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-emerald-500" />
              )}

              <div className="relative shrink-0">
                <Icon size={16} />
                {isChats && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-red-500 text-foreground text-[8px] font-black min-w-[14px] h-[14px] rounded-full flex items-center justify-center px-0.5 leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>

              {/* Label — hidden when collapsed on desktop */}
              {(!collapsed || mobile) && (
                <span className="truncate">{label}</span>
              )}

              {/* Tooltip for collapsed desktop state */}
              {collapsed && !mobile && (
                <span className="pointer-events-none absolute left-full ml-3 px-2 py-1 rounded-md bg-popover border border-border text-xs text-popover-foreground font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-xl z-50">
                  {NAV_FALLBACK[href] ?? label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Notification Bell + Logout ─────────────────────────────────────── */}
      <div className="px-2 pb-3 border-t border-sidebar-border pt-2 space-y-0.5">
        {/* Sidebar Upgrade Ad */}
        {showUpgradeAd && (!collapsed || mobile) && (
          <div className="mb-2 p-3 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Zap size={14} className="text-amber-500 fill-amber-500" />
              <span className="text-xs font-bold text-amber-500 tracking-wide uppercase">Reactivate AI</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug mb-2.5">
              Upgrade to unlock up to 5,000 AI replies & unlimited inbound messages.
            </p>
            <Link
              href="/dashboard/usage"
              className="block w-full py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-500 text-[11px] font-bold text-center rounded-lg transition-colors"
            >
              Upgrade Now
            </Link>
          </div>
        )}

        <NotificationBell collapsed={collapsed} mobile={mobile} />

        <button
          onClick={() => setShowLogout(true)}
          title={collapsed && !mobile ? t('nav.logout') : undefined}
          className="group relative w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-all"
        >
          <LogOut size={16} className="shrink-0" />
          {(!collapsed || mobile) && <span>{t('nav.logout')}</span>}
          {collapsed && !mobile && (
            <span className="pointer-events-none absolute left-full ml-3 px-2 py-1 rounded-md bg-popover border border-border text-xs text-popover-foreground font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-xl z-50">
              {t('nav.logout')}
            </span>
          )}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* ── Desktop sidebar — always mounted, collapses inline ────────────── */}
      <div className="hidden md:flex h-screen sticky top-0 shrink-0">
        <SidebarBody mobile={false} />
      </div>

      {/* ── Mobile: backdrop ──────────────────────────────────────────────── */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onMobileClose}
        aria-hidden
      />

      {/* ── Mobile: slide-over drawer ─────────────────────────────────────── */}
      <div
        className={`md:hidden fixed top-0 left-0 z-50 h-full transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarBody mobile />
      </div>

      {/* ── Logout confirm modal ──────────────────────────────────────────── */}
      {showLogout && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-60 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-background border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <LogOut size={19} className="text-red-400" />
              </div>
              <h3 className="text-base font-bold text-foreground">{t('auth.logout')}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              {t('common.confirm')}? {t('auth.logout').toLowerCase()} SalesPilot?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLogout(false)}
                className="px-5 py-2 rounded-xl text-sm font-bold text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={logout}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-red-500 text-foreground hover:bg-red-600 shadow-md transition-colors"
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
