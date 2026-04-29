'use client';

import { useState, useEffect } from 'react';
import { Globe, Bot, Check, Loader2, Save } from 'lucide-react';
import { useLocale, LOCALES, type Locale } from '@/lib/locale';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

// All languages the bot can reply in (superset of dashboard UI languages)
const BOT_LANGS = [
  { code: 'en', name: 'English',              nativeName: 'English',       flag: '🇬🇧' },
  { code: 'si', name: 'Sinhala',              nativeName: 'සිංහල',         flag: '🇱🇰' },
  { code: 'ta', name: 'Tamil',                nativeName: 'தமிழ்',         flag: '🇱🇰' },
  { code: 'ar', name: 'Arabic',               nativeName: 'عربي',           flag: '🇦🇪' },
  { code: 'th', name: 'Thai',                 nativeName: 'ภาษาไทย',        flag: '🇹🇭' },
  { code: 'ms', name: 'Malay',                nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'id', name: 'Bahasa Indonesia',     nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'hi', name: 'Hindi',                nativeName: 'हिन्दी',          flag: '🇮🇳' },
];

interface BusinessSettings {
  bot_reply_language?: string;
  bot_supported_langs?: string;
}

export default function LanguageTab({ settings }: { settings: BusinessSettings }) {
  const { locale, setLocale } = useLocale();

  // Dashboard language (per user, stored locally + backend)
  const [dashLang, setDashLang] = useState<Locale>(locale);

  // Bot language settings (per business)
  const [botFallback, setBotFallback]     = useState(settings.bot_reply_language ?? 'en');
  const [supportedSet, setSupportedSet]   = useState<Set<string>>(() => {
    const langs = settings.bot_supported_langs ?? 'en,si';
    return new Set(langs.split(',').map(l => l.trim()).filter(Boolean));
  });

  const [saving, setSaving] = useState(false);

  // Sync when parent settings load
  useEffect(() => {
    if (settings.bot_reply_language) setBotFallback(settings.bot_reply_language);
    if (settings.bot_supported_langs) {
      setSupportedSet(new Set(settings.bot_supported_langs.split(',').map(l => l.trim()).filter(Boolean)));
    }
  }, [settings.bot_reply_language, settings.bot_supported_langs]);

  function toggleSupported(code: string) {
    setSupportedSet(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        // Always keep at least one language + always keep the fallback
        if (next.size <= 1 || code === botFallback) return prev;
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Save dashboard language (switches UI immediately via useLocale)
      await setLocale(dashLang, true);

      // Save bot settings
      await apiFetch('/api/v1/settings/language', {
        method: 'PUT',
        body: JSON.stringify({
          dashboard_language:  dashLang,
          bot_reply_language:  botFallback,
          bot_supported_langs: Array.from(supportedSet).join(','),
        }),
      });
      toast.success('Language settings saved ✅');
    } catch {
      toast.error('Failed to save language settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const card = 'bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 mb-4';
  const sectionTitle = 'text-sm font-semibold text-zinc-100 mb-1';
  const sectionSub   = 'text-xs text-zinc-500 mb-4';

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <Globe size={20} className="text-emerald-400" />
          Language Settings
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          Dashboard language and bot reply language are independent — set each to match your needs.
        </p>
      </div>

      {/* ── Dashboard Language ─────────────────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-1">
          <Globe size={15} className="text-emerald-400" />
          <p className={sectionTitle} style={{ margin: 0 }}>Your Dashboard Language</p>
        </div>
        <p className={sectionSub}>Changes how <strong>you</strong> see the app. Doesn't affect your bot.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {LOCALES.map(lang => {
            const active = dashLang === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setDashLang(lang.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: `1.5px solid ${active ? 'rgba(16,185,129,0.6)' : 'rgba(255,255,255,0.08)'}`,
                  background: active ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textAlign: 'left',
                  position: 'relative',
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>{lang.flag}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: active ? '#10b981' : '#e4e4e7' }}>
                    {lang.name}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: '#71717a' }}>{lang.nativeName}</span>
                </span>
                {active && (
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={11} color="#fff" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Bot Reply Language (Fallback) ──────────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-1">
          <Bot size={15} className="text-blue-400" />
          <p className={sectionTitle} style={{ margin: 0 }}>Bot Default Reply Language</p>
        </div>
        <p className={sectionSub}>
          Used when the bot can't detect the customer's language. The bot auto-detects Tamil, Sinhala, Arabic, Thai, and Malay.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {BOT_LANGS.filter(l => supportedSet.has(l.code)).map(lang => {
            const active = botFallback === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setBotFallback(lang.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: `1.5px solid ${active ? 'rgba(96,165,250,0.6)' : 'rgba(255,255,255,0.08)'}`,
                  background: active ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>{lang.flag}</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: active ? '#60a5fa' : '#a1a1aa' }}>{lang.name}</span>
                {active && <Check size={12} color="#60a5fa" style={{ marginLeft: 'auto' }} />}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-zinc-600 mt-3">
          Only languages in the <strong>Supported Languages</strong> list below can be set as the default.
        </p>
      </div>

      {/* ── Supported Languages (multi-select) ────────────────────── */}
      <div className={card}>
        <div className="flex items-center gap-2 mb-1">
          <Globe size={15} className="text-purple-400" />
          <p className={sectionTitle} style={{ margin: 0 }}>Languages Your Bot Has Replies For</p>
        </div>
        <p className={sectionSub}>
          Enable only languages where you've written FAQ rule responses. The bot auto-detects customer language from this set.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {BOT_LANGS.map(lang => {
            const enabled = supportedSet.has(lang.code);
            const isDefault = lang.code === botFallback;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => toggleSupported(lang.code)}
                disabled={isDefault} // can't disable the current fallback
                title={isDefault ? 'This is the bot fallback language — change fallback first' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: `1.5px solid ${enabled ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.06)'}`,
                  background: enabled ? 'rgba(168,85,247,0.08)' : 'rgba(255,255,255,0.02)',
                  cursor: isDefault ? 'not-allowed' : 'pointer',
                  opacity: isDefault ? 0.6 : 1,
                  transition: 'all 0.15s',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>{lang.flag}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: enabled ? '#c084fc' : '#71717a' }}>
                    {lang.name}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: '#52525b' }}>{lang.nativeName}</span>
                </span>
                <span style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: `1.5px solid ${enabled ? '#a855f7' : 'rgba(255,255,255,0.15)'}`,
                  background: enabled ? '#a855f7' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {enabled && <Check size={10} color="#fff" />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
          <p className="text-xs text-zinc-400">
            <strong className="text-emerald-400">Auto-detection:</strong> When a customer writes in Sinhala, Tamil, Arabic, or Thai script,
            the bot always detects it regardless of this setting. This list controls which languages get dedicated FAQ responses.
          </p>
        </div>
      </div>

      {/* ── Save button ────────────────────────────────────────────── */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '11px 24px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, #10b981, #059669)',
          color: '#fff',
          fontWeight: 700,
          fontSize: '0.875rem',
          border: 'none',
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1,
          boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
          transition: 'all 0.2s',
        }}
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? 'Saving…' : 'Save Language Settings'}
      </button>
    </div>
  );
}
