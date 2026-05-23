'use client';
import { useState, useEffect } from 'react';
import { UserCog, Shield, ShieldCheck, Bell, History, AlertTriangle, Settings, Globe, Banknote, Monitor } from 'lucide-react';
import GeneralTab from './_components/GeneralTab';
import AppearanceTab from './_components/AppearanceTab';
import SecurityTab from './_components/SecurityTab';
import BlockedNumbersTab from './_components/BlockedNumbersTab';
import AuditLogTab from './_components/AuditLogTab';
import ReportsTab from './_components/ReportsTab';
import DangerZoneTab from './_components/DangerZoneTab';
import LanguageTab from './_components/LanguageTab';
import PaymentsTab from './_components/PaymentsTab';
import { useLocale } from '@/lib/locale';


import { API_URL } from '@/hooks/_shared';

export type BusinessSettings = {
  name: string;
  bot_name: string;
  bot_personality: string;
  operating_hours: string;
  delivery_policy: string;
  response_language: string;
  // New multi-language fields
  bot_reply_language: string;
  bot_supported_langs: string;
};

export type BillingStatus = {
  plan: string;
  days_remaining: number | null;
  trial_days_remaining: number | null;
  plan_expires_at: string | null;
};

const TABS = [
  { id: 'general',     label: 'General',         icon: UserCog,     color: 'text-emerald-400' },
  { id: 'language',    label: 'Language',         icon: Globe,       color: 'text-blue-400'    },
  { id: 'security',    label: 'Security',         icon: Shield,      color: 'text-blue-400'    },
  { id: 'blacklist',   label: 'Blocked Numbers',  icon: ShieldCheck, color: 'text-red-400'     },
  { id: 'audit',       label: 'Audit Log',        icon: History,     color: 'text-purple-400'  },
  { id: 'reports',     label: 'Reports',          icon: Bell,        color: 'text-amber-400'   },
  { id: 'danger',      label: 'Danger Zone',      icon: AlertTriangle, color: 'text-red-500'   },
];
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const { t } = useLocale();

  const TABS = [
    { id: 'general',   label: t('settings.general'),  icon: UserCog,       color: 'text-emerald-400' },
    { id: 'appearance',label: 'Appearance',             icon: Monitor,       color: 'text-pink-400'    },
    { id: 'language',  label: t('settings.language'),  icon: Globe,         color: 'text-blue-400'    },
    { id: 'payments',  label: 'Payments',               icon: Banknote,      color: 'text-emerald-400' },
    { id: 'security',  label: t('settings.security'),  icon: Shield,        color: 'text-blue-400'    },
    { id: 'blacklist', label: t('settings.blocked_numbers'),        icon: ShieldCheck,   color: 'text-red-400'     },
    { id: 'audit',     label: t('settings.audit_logs'),         icon: History,       color: 'text-purple-400'  },
    { id: 'reports',   label: t('nav.reports'),         icon: Bell,          color: 'text-amber-400'   },
    { id: 'danger',    label: 'Danger Zone',            icon: AlertTriangle, color: 'text-red-500'     },
  ];

  const [settings, setSettings] = useState<BusinessSettings>({
    name: '', bot_name: '', bot_personality: '',
    operating_hours: '', delivery_policy: '',
    response_language: 'sinhala_first',
    bot_reply_language: 'en',
    bot_supported_langs: 'en,si',
  });
  const [billing, setBilling] = useState<BillingStatus | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${API_URL}/api/v1/settings/business`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSettings(d); })
      .catch(() => {});

    fetch(`${API_URL}/api/v1/billing/status`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setBilling(d); })
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-7xl mx-auto w-full pb-12">
      <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1 text-foreground flex items-center gap-3">
          <Settings size={28} className="text-muted-foreground" />
          {t('settings.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('settings.general')} — {t('settings.security').toLowerCase()}, {t('settings.language').toLowerCase()}.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* ── Vertical Tab Nav ── */}
        <nav className="md:w-52 shrink-0">
          {/* Mobile: horizontal scroll */}
          <div className="flex md:hidden gap-1 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                <tab.icon size={14} className={activeTab === tab.id ? tab.color : ''} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Desktop: vertical list */}
          <div className="hidden md:flex flex-col gap-0.5">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all ${
                  activeTab === tab.id
                    ? 'bg-accent text-accent-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                } ${tab.id === 'danger' ? 'mt-4 border-t border-border pt-4' : ''}`}
              >
                <tab.icon
                  size={15}
                  className={`shrink-0 transition-colors ${activeTab === tab.id ? tab.color : 'text-muted-foreground group-hover:text-foreground'}`}
                />
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* ── Tab Content ── */}
        <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-bottom-1 duration-200" key={activeTab}>
          {activeTab === 'general'   && <GeneralTab settings={settings} setSettings={setSettings} billing={billing} />}
          {activeTab === 'appearance'&& <AppearanceTab />}
          {activeTab === 'language'  && <LanguageTab settings={settings} />}
          {activeTab === 'payments'  && <PaymentsTab />}
          {activeTab === 'security'  && <SecurityTab />}
          {activeTab === 'blacklist' && <BlockedNumbersTab />}
          {activeTab === 'audit'     && <AuditLogTab />}
          {activeTab === 'reports'   && <ReportsTab />}
          {activeTab === 'danger'    && <DangerZoneTab />}
        </div>
      </div>
      </div>
    </div>
  );
}
