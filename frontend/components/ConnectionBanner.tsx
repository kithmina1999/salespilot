'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle, WifiOff, X, Wifi } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useLocale } from '@/lib/locale';

// Pages where the banner should NOT appear (connect page handles its own state)
const HIDDEN_PATHS = ['/dashboard/connect', '/dashboard/usage', '/dashboard/billing'];

export default function ConnectionBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const { business, businessLoaded } = useAppStore();
  const [dismissed, setDismissed] = useState(false);
  const { t } = useLocale();

  // Don't show on pages that handle WA state themselves
  if (HIDDEN_PATHS.some(p => pathname.startsWith(p))) return null;

  // Still loading — don't flash the banner
  if (!businessLoaded || !business) return null;

  const status = business.wa_status ?? 'not_connected';

  // ── Connected: subtle green pulse ───────────────────────────────────────────
  if (status === 'connected') {
    if (dismissed) return null;
    return (
      <div className="relative shrink-0 bg-emerald-500/5 border-b border-emerald-500/10 px-4 py-2 flex items-center justify-center gap-3">
        <div className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </div>
        <Wifi size={13} className="text-emerald-500/70" />
        <span className="text-xs font-semibold tracking-widest text-emerald-500/90 uppercase">
          {t('connection.online')}
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-emerald-500/40 hover:text-emerald-500 transition-colors"
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  // ── Disconnected: token expired warning (was connected before, now broken) ──
  if (status === 'disconnected') {
    return (
      <div className="shrink-0 bg-red-500/8 border-b border-red-500/20 px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-red-400 min-w-0">
          <WifiOff size={15} className="shrink-0" />
          <span className="text-xs font-semibold leading-tight">
            ⚠️ {t('connection.disconnected')}
          </span>
        </div>
        <button
          onClick={() => router.push('/dashboard/connect')}
          className="shrink-0 flex items-center gap-2 bg-red-500 hover:bg-red-400 text-foreground px-4 py-1.5 rounded-lg text-xs font-black shadow-lg shadow-red-500/20 active:scale-95 transition-all w-full sm:w-auto justify-center"
        >
          {t('connection.fix')} →
        </button>
      </div>
    );
  }

  // ── Not connected: standard warning ─────────────────────────────────────────
  return (
    <div className="shrink-0 bg-yellow-500/8 border-b border-yellow-500/20 px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 text-yellow-500 min-w-0">
        <AlertTriangle size={15} className="shrink-0" />
        <span className="text-xs font-semibold leading-tight">
          {pathname === '/dashboard/chats'
            ? t('connection.chat_hint')
            : t('connection.offline')}
        </span>
      </div>
        <button
        onClick={() => router.push('/dashboard/connect')}
        className="shrink-0 flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-1.5 rounded-lg text-xs font-black shadow-lg shadow-yellow-500/20 active:scale-95 transition-all w-full sm:w-auto justify-center"
      >
        {t('dashboard.connect_whatsapp')} →
      </button>
    </div>
  );
}
