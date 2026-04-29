'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageCircle, CheckCircle2, AlertCircle, Loader2,
  ChevronRight, ChevronLeft, Shirt, Cpu, UtensilsCrossed,
  Sparkles, ShoppingBag, Building2, Wrench, Car,
  GraduationCap, Plane, Check, Zap, ArrowRight, Eye, EyeOff,
  Wifi, WifiOff, SkipForward, Globe, Bot,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { useLocale, LOCALES, type Locale } from '@/lib/locale';

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 0 | 1 | 2 | 3 | 4;

interface TemplateRule {
  id: string;
  title: string;
  keywords: string;
  response: string;
  sinhala_response: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'clothing',    label: 'Fashion & Clothing',      icon: Shirt,           color: 'emerald' },
  { key: 'electronics', label: 'Electronics',              icon: Cpu,             color: 'blue' },
  { key: 'food',        label: 'Food & Bakery',            icon: UtensilsCrossed, color: 'orange' },
  { key: 'beauty',      label: 'Beauty & Cosmetics',       icon: Sparkles,        color: 'pink' },
  { key: 'general',     label: 'Grocery & Supermarket',    icon: ShoppingBag,     color: 'green' },
  { key: 'other',       label: 'Pharmacy',                 icon: Building2,       color: 'teal' },
  { key: 'other',       label: 'Hardware & Tools',         icon: Wrench,          color: 'yellow' },
  { key: 'other',       label: 'Automotive',               icon: Car,             color: 'slate' },
  { key: 'other',       label: 'Education & Tuition',      icon: GraduationCap,   color: 'purple' },
  { key: 'other',       label: 'Travel & Tourism',         icon: Plane,           color: 'sky' },
];

const CATEGORY_ICON_COLORS: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  blue:    'bg-blue-50 text-blue-600 border-blue-200',
  orange:  'bg-orange-50 text-orange-600 border-orange-200',
  pink:    'bg-pink-50 text-pink-600 border-pink-200',
  green:   'bg-green-50 text-green-600 border-green-200',
  teal:    'bg-teal-50 text-teal-600 border-teal-200',
  yellow:  'bg-yellow-50 text-yellow-600 border-yellow-200',
  slate:   'bg-slate-50 text-slate-600 border-slate-200',
  purple:  'bg-purple-50 text-purple-600 border-purple-200',
  sky:     'bg-sky-50 text-sky-600 border-sky-200',
};

const STEPS = [
  { num: 1, label: 'Connect WhatsApp' },
  { num: 2, label: 'Verify' },
  { num: 3, label: 'Business Type' },
  { num: 4, label: 'Import Rules' },
];

const BOT_LANGS = [
  { code: 'en', name: 'English',          nativeName: 'English',        flag: '🇬🇧' },
  { code: 'si', name: 'Sinhala',          nativeName: 'සිංහල',          flag: '🇱🇰' },
  { code: 'ta', name: 'Tamil',            nativeName: 'தமிழ்',          flag: '🇱🇰' },
  { code: 'ar', name: 'Arabic',           nativeName: 'عربي',            flag: '🇦🇪' },
  { code: 'th', name: 'Thai',             nativeName: 'ภาษาไทย',         flag: '🇹🇭' },
  { code: 'ms', name: 'Malay',            nativeName: 'Bahasa Melayu',  flag: '🇲🇾' },
  { code: 'id', name: 'Bahasa Indonesia', nativeName: 'Bahasa Indonesia',flag: '🇮🇩' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function StepBar({ current }: { current: Step }) {
  // Step 0 is the language pre-step — don't show it in the progress bar
  const visibleSteps = STEPS; // steps 1-4
  const effectiveCurrent = current === 0 ? 0 : current; // step 0 shows no bar (handled below)
  if (current === 0) return null;
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {visibleSteps.map((s, idx) => (
        <div key={s.num} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${
                s.num < effectiveCurrent
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : s.num === effectiveCurrent
                  ? 'bg-white border-emerald-500 text-emerald-600'
                  : 'bg-white border-gray-200 text-gray-400'
              }`}
            >
              {s.num < effectiveCurrent ? <Check size={15} /> : s.num}
            </div>
            <span className={`text-[0.7rem] font-medium whitespace-nowrap hidden sm:block ${
              s.num === effectiveCurrent ? 'text-emerald-600' : s.num < effectiveCurrent ? 'text-emerald-500' : 'text-gray-400'
            }`}>
              {s.label}
            </span>
          </div>
          {idx < visibleSteps.length - 1 && (
            <div className={`w-16 sm:w-24 h-[2px] mb-5 sm:mb-0 mx-1 transition-colors duration-300 ${
              s.num < effectiveCurrent ? 'bg-emerald-400' : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 0: Language Setup ────────────────────────────────────────────────────

function Step0Language({
  dashLang, setDashLang, botLang, setBotLang, onNext,
}: {
  dashLang: Locale;
  setDashLang: (l: Locale) => void;
  botLang: string;
  setBotLang: (l: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="animate-fadein">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
          <Globe size={22} className="text-blue-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Language Setup</h2>
          <p className="text-sm text-gray-500">Choose your preferred language — you can change this anytime</p>
        </div>
      </div>

      {/* Dashboard Language */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <Globe size={14} className="text-blue-500" />
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Your Dashboard Language</p>
        </div>
        <p className="text-xs text-gray-500 mb-3">How <strong>you</strong> see this app</p>
        <div className="grid grid-cols-3 gap-2">
          {LOCALES.map(lang => {
            const active = dashLang === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setDashLang(lang.code)}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  active
                    ? 'border-blue-400 bg-blue-50 shadow-[0_0_0_3px_rgba(96,165,250,0.15)]'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="text-xl">{lang.flag}</span>
                <span className="flex-1 text-left">
                  <span className={`block text-xs font-bold ${ active ? 'text-blue-700' : 'text-gray-800'}`}>{lang.name}</span>
                  <span className="block text-[0.65rem] text-gray-400">{lang.nativeName}</span>
                </span>
                {active && (
                  <span className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                    <Check size={9} className="text-white" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bot Language */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Bot size={14} className="text-emerald-600" />
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Bot Default Reply Language</p>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          How your bot talks to customers <span className="font-semibold">by default</span>.
          The bot also auto-detects Sinhala, Tamil, Arabic & Thai.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {BOT_LANGS.map(lang => {
            const active = botLang === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setBotLang(lang.code)}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                  active
                    ? 'border-emerald-400 bg-emerald-50 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="text-lg">{lang.flag}</span>
                <span className="flex-1">
                  <span className={`block text-xs font-bold ${active ? 'text-emerald-700' : 'text-gray-800'}`}>{lang.name}</span>
                  <span className="block text-[0.65rem] text-gray-400">{lang.nativeName}</span>
                </span>
                {active && (
                  <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                    <Check size={9} className="text-white" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Auto-detect notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
        <p className="text-xs text-amber-700">
          <strong>Auto-detection is always on</strong> — when a customer writes in a different language,
          your bot will reply in that language automatically (if you have rules for it).
        </p>
      </div>

      <button
        onClick={onNext}
        className="w-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(16,185,129,0.3)] hover:-translate-y-[1px] transition-all"
      >
        Continue <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ── Step 1: Connect WhatsApp ──────────────────────────────────────────────────

function Step1Connect({
  onNext, onSkip,
}: {
  onNext: (status: 'connected' | 'skipped') => void;
  onSkip: () => void;
}) {
  const [phoneId, setPhoneId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConnect() {
    if (!phoneId.trim() || !wabaId.trim() || !token.trim()) {
      setError('All three fields are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await apiFetch('/api/v1/whatsapp/connect', {
        method: 'POST',
        body: JSON.stringify({
          phone_number_id: phoneId.trim(),
          waba_id: wabaId.trim(),
          access_token: token.trim(),
        }),
      });
      toast.success('WhatsApp connected! ✅');
      onNext('connected');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fadein">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
          <MessageCircle size={22} className="text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Connect WhatsApp</h2>
          <p className="text-sm text-gray-500">Link your Meta Cloud API account to your bot</p>
        </div>
      </div>

      {/* How-to guide */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-3">How to get your credentials</p>
        <ol className="space-y-2.5">
          {[
            { n: '1', text: 'Go to', link: 'https://developers.facebook.com', label: 'Meta for Developers' },
            { n: '2', text: 'Create a WhatsApp Business App → Add Phone Number', link: null, label: null },
            { n: '3', text: 'Copy the', link: null, label: 'Phone Number ID, WABA ID, and a permanent Access Token' },
          ].map(({ n, text, link, label }) => (
            <li key={n} className="flex gap-2.5 text-sm text-gray-600">
              <span className="w-5 h-5 bg-emerald-100 text-emerald-700 rounded-full text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">{n}</span>
              <span>
                {text}{' '}
                {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline font-medium">{label}</a> : <strong className="text-gray-800">{label}</strong>}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Form */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-start gap-2 mb-4">
          <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Phone Number ID</label>
          <input
            type="text"
            placeholder="e.g. 123456789012345"
            value={phoneId}
            onChange={e => setPhoneId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">WhatsApp Business Account (WABA) ID</label>
          <input
            type="text"
            placeholder="e.g. 987654321098765"
            value={wabaId}
            onChange={e => setWabaId(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Permanent Access Token</label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              placeholder="EAAxxxxxxxx…"
              value={token}
              onChange={e => setToken(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all bg-white"
            />
            <button
              type="button"
              onClick={() => setShowToken(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={handleConnect}
        disabled={loading}
        className="mt-5 w-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(16,185,129,0.3)] hover:-translate-y-[1px] hover:shadow-[0_10px_28px_rgba(16,185,129,0.4)] active:translate-y-0 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
      >
        {loading ? <><Loader2 size={16} className="animate-spin" /> Connecting…</> : <><Wifi size={16} /> Connect & Verify</>}
      </button>

      <div className="mt-4 text-center">
        <button
          onClick={() => { onSkip(); onNext('skipped'); }}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1.5 mx-auto"
        >
          <SkipForward size={14} /> Skip for now — I'll connect later
        </button>
        <p className="text-xs text-gray-400 mt-1.5">You can always connect from your dashboard settings</p>
      </div>
    </div>
  );
}

// ── Step 2: Verification Status ───────────────────────────────────────────────

function Step2Verify({
  status, onNext, onBack,
}: {
  status: 'connected' | 'skipped';
  onNext: () => void;
  onBack: () => void;
}) {
  const connected = status === 'connected';
  return (
    <div className="animate-fadein text-center">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 ${
        connected ? 'bg-emerald-50 border-2 border-emerald-300' : 'bg-amber-50 border-2 border-amber-300'
      }`}>
        {connected
          ? <CheckCircle2 size={40} className="text-emerald-500" />
          : <WifiOff size={40} className="text-amber-500" />
        }
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        {connected ? 'WhatsApp Connected!' : 'Connection Skipped'}
      </h2>
      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
        {connected
          ? 'Your Meta Cloud API credentials have been verified. Your bot is ready to send and receive messages.'
          : "No worries — you can connect WhatsApp anytime from your dashboard settings. Your bot will still be set up with your rules."}
      </p>
      {!connected && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-6 text-left">
          <p className="text-xs text-amber-700 flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>Without WhatsApp connected, your bot can't receive or respond to messages yet. A reminder banner will appear in your dashboard.</span>
          </p>
        </div>
      )}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 hover:bg-gray-50 transition-all"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <button
          onClick={onNext}
          className="flex-[2] bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(16,185,129,0.3)] hover:-translate-y-[1px] transition-all"
        >
          Continue <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Business Category ─────────────────────────────────────────────────

function Step3Category({
  selected, onSelect, onNext, onBack,
}: {
  selected: number | null;
  onSelect: (idx: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="animate-fadein">
      <h2 className="text-xl font-bold text-gray-900 mb-1.5">What's your business type?</h2>
      <p className="text-sm text-gray-500 mb-5">We'll load the perfect starter rules for your industry</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6">
        {CATEGORIES.map((cat, idx) => {
          const Icon = cat.icon;
          const isSelected = selected === idx;
          const iconCls = CATEGORY_ICON_COLORS[cat.color];
          return (
            <button
              key={`${cat.key}-${idx}`}
              onClick={() => onSelect(idx)}
              className={`relative flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 text-center transition-all duration-150 cursor-pointer ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-50 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check size={9} className="text-white" />
                </div>
              )}
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${iconCls}`}>
                <Icon size={20} />
              </div>
              <span className={`text-[0.77rem] font-semibold leading-tight ${isSelected ? 'text-emerald-700' : 'text-gray-700'}`}>
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 hover:bg-gray-50 transition-all"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <button
          onClick={onNext}
          disabled={selected === null}
          className="flex-[2] bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(16,185,129,0.3)] hover:-translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          Continue <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Import Rules ──────────────────────────────────────────────────────

function Step4Rules({
  industry, onBack, onFinish,
}: {
  industry: string;
  onBack: () => void;
  onFinish: (selectedIds: string[]) => void;
}) {
  const [templates, setTemplates] = useState<TemplateRule[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<TemplateRule[]>(`/api/v1/onboarding/templates?industry=${industry}`)
      .then(data => {
        setTemplates(data);
        // Pre-select all by default
        setSelected(new Set(data.map(t => t.id)));
      })
      .catch(() => toast.error('Failed to load templates'))
      .finally(() => setLoadingTemplates(false));
  }, [industry]);

  function toggleAll() {
    if (selected.size === templates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(templates.map(t => t.id)));
    }
  }

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleFinish() {
    if (selected.size === 0) {
      toast.error('Please select at least one rule to import.');
      return;
    }
    setSubmitting(true);
    onFinish(Array.from(selected));
  }

  if (loadingTemplates) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 size={28} className="animate-spin text-emerald-500" />
        <p className="text-sm text-gray-500">Loading your starter rules…</p>
      </div>
    );
  }

  return (
    <div className="animate-fadein">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Import Starter Rules</h2>
      <p className="text-sm text-gray-500 mb-1">Curated FAQ rules for your industry. Select what you'd like to activate:</p>

      <div className="flex items-center justify-between mb-3 mt-3">
        <span className="text-xs text-gray-500">{selected.size} of {templates.length} selected</span>
        <button
          onClick={toggleAll}
          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          {selected.size === templates.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      <div className="space-y-2 mb-6 max-h-[340px] overflow-y-auto pr-1">
        {templates.map(t => {
          const isOn = selected.has(t.id);
          return (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className={`w-full text-left p-3.5 rounded-xl border-2 transition-all duration-150 ${
                isOn
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  isOn ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 bg-white'
                }`}>
                  {isOn && <Check size={11} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-snug ${isOn ? 'text-emerald-800' : 'text-gray-800'}`}>{t.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{t.response}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {t.keywords.split(',').slice(0, 4).map(k => (
                      <span key={k} className="text-[0.65rem] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-md font-mono">{k.trim()}</span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={submitting}
          className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-1.5 hover:bg-gray-50 transition-all disabled:opacity-50"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <button
          onClick={handleFinish}
          disabled={submitting || selected.size === 0}
          className="flex-[2] bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(16,185,129,0.3)] hover:-translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          {submitting
            ? <><Loader2 size={16} className="animate-spin" /> Setting up your bot…</>
            : <><Zap size={16} /> Launch My Bot</>
          }
        </button>
      </div>
    </div>
  );
}

// ── Done Screen ───────────────────────────────────────────────────────────────

function DoneScreen({ onGo }: { onGo: () => void }) {
  return (
    <div className="animate-fadein text-center py-4">
      <div className="w-24 h-24 rounded-full bg-emerald-50 border-2 border-emerald-300 flex items-center justify-center mx-auto mb-5">
        <Zap size={44} className="text-emerald-500" />
      </div>
      <h2 className="text-2xl font-extrabold text-gray-900 mb-2">You're all set! 🎉</h2>
      <p className="text-gray-500 text-sm max-w-xs mx-auto mb-2">
        Your AI WhatsApp bot is configured and rules are loaded.
      </p>
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 mb-6 text-center">
        <p className="text-xs font-semibold text-emerald-700">✨ Your 14-day Starter trial has begun!</p>
        <p className="text-xs text-emerald-600 mt-0.5">Explore all features — no credit card needed.</p>
      </div>
      <button
        onClick={onGo}
        className="w-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(16,185,129,0.3)] hover:-translate-y-[1px] transition-all"
      >
        Go to Dashboard <ArrowRight size={16} />
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const markOnboardingComplete = useAppStore((s) => s.markOnboardingComplete);
  const { setLocale } = useLocale();

  const [step, setStep] = useState<Step>(0);
  const [waStatus, setWaStatus] = useState<'connected' | 'skipped'>('skipped');
  const [categoryIdx, setCategoryIdx] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  // Language prefs from Step 0
  const [dashLang, setDashLang] = useState<Locale>('en');
  const [botLang, setBotLang] = useState('en');

  const selectedCategory = categoryIdx !== null ? CATEGORIES[categoryIdx] : null;

  async function finishOnboarding(selectedRuleIds: string[]) {
    try {
      // Save seed rules + onboarding complete
      await apiFetch('/api/v1/onboarding/seed-templates', {
        method: 'POST',
        body: JSON.stringify({
          industry: selectedCategory?.key ?? 'other',
          selected_rule_ids: selectedRuleIds,
          bot_name: 'AI Assistant',
          greeting: '',
          operating_hours: '',
          delivery_policy: '',
        }),
      });

      // Save language preferences (fire-and-forget — non-fatal)
      try {
        await setLocale(dashLang, true); // switches UI + persists to backend
        await apiFetch('/api/v1/settings/language', {
          method: 'PUT',
          body: JSON.stringify({
            dashboard_language:  dashLang,
            bot_reply_language:  botLang,
            bot_supported_langs: botLang === 'en' ? 'en' : `en,${botLang}`,
          }),
        });
      } catch { /* non-fatal */ }

      markOnboardingComplete();
      setDone(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Setup failed. Please try again.');
    }
  }


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="w-full bg-white border-b border-gray-100 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
            <Zap size={15} className="text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm">SalesPilot</span>
        </div>
        <span className="text-xs text-gray-400 font-medium">Account Setup</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-xl">
          {/* Greeting — hide on step 0 and done screen */}
          {!done && step > 0 && (
            <div className="text-center mb-8">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                Let's get your bot ready 🚀
              </h1>
              <p className="text-gray-500 text-sm mt-2">
                Complete a quick 4-step setup to activate your AI WhatsApp assistant
              </p>
            </div>
          )}

          {/* Step 0 special header */}
          {!done && step === 0 && (
            <div className="text-center mb-8">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                Welcome to SalesPilot 👋
              </h1>
              <p className="text-gray-500 text-sm mt-2">
                Let's set up your language preferences first
              </p>
            </div>
          )}

          {/* Step bar (hidden on step 0 and done screen) */}
          {!done && <StepBar current={step} />}

          {/* Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
            {done ? (
              <DoneScreen onGo={() => router.push('/dashboard')} />
            ) : step === 0 ? (
              <Step0Language
                dashLang={dashLang}
                setDashLang={setDashLang}
                botLang={botLang}
                setBotLang={setBotLang}
                onNext={() => setStep(1)}
              />
            ) : step === 1 ? (
              <Step1Connect
                onNext={(status) => { setWaStatus(status); setStep(2); }}
                onSkip={() => setWaStatus('skipped')}
              />
            ) : step === 2 ? (
              <Step2Verify
                status={waStatus}
                onNext={() => setStep(3)}
                onBack={() => setStep(1)}
              />
            ) : step === 3 ? (
              <Step3Category
                selected={categoryIdx}
                onSelect={(idx) => setCategoryIdx(idx)}
                onNext={() => setStep(4)}
                onBack={() => setStep(2)}
              />
            ) : (
              <Step4Rules
                industry={selectedCategory?.key ?? 'other'}
                onBack={() => setStep(3)}
                onFinish={finishOnboarding}
              />
            )}
          </div>

          {/* Footer */}
          {!done && (
            <p className="text-center text-xs text-gray-400 mt-5">
              {step === 0 ? 'Language Setup · ' : `Step ${step} of 4 · `}SalesPilot — WhatsApp AI for Sri Lankan businesses
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadein { animation: fadein 0.25s ease both; }
      `}</style>
    </div>
  );
}
