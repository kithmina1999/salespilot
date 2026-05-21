'use client';
import { useState, useEffect, Suspense } from 'react';
import {
  Plus, Search, BookOpen, Cpu, BarChart3, AlertTriangle,
  Sparkles, ShieldAlert, Edit2, Lock as LockIcon, Library, MessageSquare,
  Wand2
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UpgradeBanner from '@/components/UpgradeBanner';
import { toast } from 'sonner';
import { useLocale } from '@/lib/locale';
import { useRulesPage } from '@/hooks/useRulesPage';
import { API_URL } from '@/hooks/_shared';

import { Rule, parseResponses } from './types';
import { RuleModal, AIGenerateModal } from './components/RuleModal';
import { RulesDataTable } from './components/RulesDataTable';
import { BulkTranslateModal } from './components/BulkTranslateModal';
import { SandboxSimulator } from './components/SandboxSimulator';

// ─────────────────────────────────────────────────────────────────────────────
// Main content (wrapped in Suspense for useSearchParams)
// ─────────────────────────────────────────────────────────────────────────────

function RulesContent() {
  const searchParams = useSearchParams();
  const seed = searchParams.get('seed');
  const { t } = useLocale();

  // ── SWR-backed data ───────────────────────────────────────────────────────
  const {
    customRules, commonRules, stats,
    botLangs, botReplyLang, responseLang,
    isLoading: loading, toggleRuleStatus, deleteRule, revalidate,
  } = useRulesPage();

  // ── UI toggles ────────────────────────────────────────────────────────────
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(customRules.map(r => r.category || 'General')))];

  // Card preview language — driven by botReplyLang
  const [cardPreviewLang, setCardPreviewLang] = useState<string>('si');
  useEffect(() => { setCardPreviewLang(botReplyLang); }, [botReplyLang]);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modalMode, setModalMode] = useState<'create' | 'edit_custom' | 'clone_common' | 'generate_ai' | null>(null);
  const [editTargetId, setEditTargetId] = useState<number | null>(null);

  const [form, setForm] = useState({
    category: 'General',
    keywords: '',
    responses: {} as Record<string, string>,
    is_active: true,
  });

  const [seedOriginalLine,  setSeedOriginalLine]  = useState('');
  const [generalizedIntent, setGeneralizedIntent] = useState('');
  const [generateIntent,    setGenerateIntent]    = useState('');
  const [generating, setGenerating] = useState(false);
  const [drafting,   setDrafting]   = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Seed from URL — open create modal pre-filled
  useEffect(() => {
    if (seed) {
      setForm(prev => ({ ...prev, keywords: seed || '', category: 'General' }));
      setModalMode('create');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  // ── Modal helpers ─────────────────────────────────────────────────────────
  function openCreateModal() {
    setEditTargetId(null);
    setForm({ category: 'General', keywords: '', responses: {}, is_active: true });
    setSeedOriginalLine('');
    setGeneralizedIntent('');
    setModalMode('create');
  }

  function openEditModal(r: Rule, isCommon: boolean) {
    setEditTargetId(r.ID);
    const responses = parseResponses(r.responses, r.response, r.sinhala_response);
    setForm({ category: r.category || 'General', keywords: r.keywords, responses, is_active: r.is_active });
    setSeedOriginalLine('');
    setGeneralizedIntent('');
    setModalMode(isCommon ? 'clone_common' : 'edit_custom');
  }

  function closeModal() {
    setModalMode(null);
    setSeedOriginalLine('');
    setGeneralizedIntent('');
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleBulkApprove = async (updatedRules: Rule[]) => {
    try {
      const token = localStorage.getItem('token');
      // We can update them sequentially or all at once. For simplicity, sequential updates:
      for (const rule of updatedRules) {
        const res = await fetch(`/api/v1/rules/${rule.ID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            responses: JSON.parse(rule.responses || '{}'),
          }),
        });
        if (!res.ok) throw new Error(`Failed to update rule ${rule.ID}`);
      }
      import('sonner').then(m => m.toast.success('Bulk translations saved!'));
      setBulkModalOpen(false);
      revalidate();
    } catch (err: any) {
      import('sonner').then(m => m.toast.error(err.message));
    }
  };
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const isPost = modalMode === 'create' || modalMode === 'clone_common';
    const url    = isPost ? `${API_URL}/api/v1/rules` : `${API_URL}/api/v1/rules/${editTargetId}`;
    const method = isPost ? 'POST' : 'PUT';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          category: form.category,
          keywords: form.keywords,
          responses: form.responses,
          response: form.responses['en'] || '',
          sinhala_response: form.responses['si'] || '',
          is_active: form.is_active,
          ...(seedOriginalLine ? { resolved_message: seedOriginalLine } : {}),
        }),
      });
      if (res.ok) {
        toast.success('Rule saved successfully');
        closeModal();
        revalidate(); // SWR revalidation replaces manual fetchRules()
      } else {
        toast.error('Failed to save rule');
      }
    } catch (err) { console.error(err); }
  }

  async function handleGenerateRule(e: React.FormEvent) {
    e.preventDefault();
    if (!generateIntent) return;
    setGenerating(true);
    const token = localStorage.getItem('token');
    try {
      const res  = await fetch(`${API_URL}/api/v1/rules/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ intent: generateIntent }),
      });
      const data = await res.json();
      if (res.ok) {
        const generatedMap: Record<string, string> = data.responses || {};
        if (!generatedMap['en'] && data.response)          generatedMap['en'] = data.response;
        if (!generatedMap['si'] && data.sinhala_response) generatedMap['si'] = data.sinhala_response;
        setForm({ category: 'General', keywords: data.keywords, responses: generatedMap, is_active: true });
        setGenerateIntent('');
        setModalMode('create');
        revalidate(); // refresh rule_generation_count from server
        toast.success('AI Draft Generated!');
      } else if (res.status === 403 && data.upgrade_required) {
        setUpgradeMessage(data.error || 'AI Rule Generation requires Starter or Pro plan');
        closeModal();
      } else if (res.status === 429) {
        toast.error(`${data.error} (retry in ${data.retry_after_seconds}s)`);
      } else {
        toast.error(data.error || 'Failed to generate rule');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error connecting to AI service');
    } finally {
      setGenerating(false);
    }
  }

  async function handleAutoDraft() {
    const isInboxMode  = !!seedOriginalLine;
    const messageToSend = isInboxMode ? seedOriginalLine : form.keywords;
    if (!messageToSend.trim()) {
      toast.error(isInboxMode ? 'No customer message to generalize.' : 'Please add Trigger Keywords first.');
      return;
    }
    setDrafting(true);
    const token = localStorage.getItem('token');
    try {
      const res  = await fetch(`${API_URL}/api/v1/faqs/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: messageToSend, from_inbox: isInboxMode }),
      });
      if (res.ok) {
        const data = await res.json();
        const incoming: Record<string, string> = data.responses || {};
        if (!incoming['en'] && data.response)          incoming['en'] = data.response;
        if (!incoming['si'] && data.sinhala_response) incoming['si'] = data.sinhala_response;
        if (isInboxMode && data.keywords) {
          setForm(prev => ({ ...prev, keywords: data.keywords || prev.keywords, responses: { ...prev.responses, ...incoming } }));
          if (data.generalized_intent) setGeneralizedIntent(data.generalized_intent);
          toast.success('✨ Intent generalized and rule drafted!');
        } else {
          setForm(prev => ({ ...prev, responses: { ...prev.responses, ...incoming } }));
          toast.success('Responses drafted!');
        }
      } else if (res.status === 403) {
        const data = await res.json();
        setUpgradeMessage(data.error || 'AI Draft requires Starter or Pro plan');
      } else {
        toast.error('Failed to draft answer with AI');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDrafting(false);
    }
  }

  // Toggle and delete delegated to SWR hook (optimistic + rollback built in)
  async function handleToggleStatus(r: Rule) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await toggleRuleStatus(r as any);
  }

  async function handleDelete(id: number) {
    const ok = await deleteRule(id);
    if (!ok) {
      // deleteRule returns false when upgrade_required
      setUpgradeMessage('This action requires a higher plan');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto w-full pb-12">

      {/* Upgrade banner */}
      {upgradeMessage && (
        <div className="mb-6">
          <UpgradeBanner message={upgradeMessage} onDismiss={() => setUpgradeMessage(null)} />
        </div>
      )}

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold">{t('rules.title')}</h1>
          <p className="text-sm mt-1 text-muted-foreground">{t('rules.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          {/* AI Generate button */}
          {stats.rule_generation_count >= stats.rule_generation_limit ? (
            <button
              disabled
              title={stats.plan === 'free' ? "Free limit reached. Upgrade to Starter or Pro for more." : "Monthly limit reached. Upgrade to Pro for unlimited generation."}
              className="flex items-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold bg-amber-500/10 text-amber-500/50 border border-amber-500/20 cursor-not-allowed flex-1 sm:flex-none justify-center"
              style={{ minHeight: '44px' }}
            >
              <LockIcon size={16} /> {stats.plan === 'free' ? "Free Limit Reached" : "Limit Reached"}
            </button>
          ) : (
            <button
              onClick={() => { setGenerateIntent(''); setModalMode('generate_ai'); }}
              className="flex items-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold bg-linear-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black shadow-lg shadow-amber-500/20 transition-transform hover:scale-105 flex-1 sm:flex-none justify-center"
              style={{ minHeight: '44px' }}
            >
              <Sparkles size={16} /> Generate with AI
            </button>
          )}
          <button
            onClick={() => setBulkModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold bg-muted border border-border hover:bg-secondary text-foreground shadow-sm transition-transform hover:scale-105 flex-1 sm:flex-none justify-center"
            style={{ minHeight: '44px' }}
          >
            <Wand2 size={16} className="text-amber-500" /> Bulk Translate
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg text-sm font-bold bg-white hover:bg-zinc-200 text-black shadow-lg transition-transform hover:scale-105 flex-1 sm:flex-none justify-center"
            style={{ minHeight: '44px' }}
          >
            <Plus size={16} /> {t('rules.add_rule')}
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-center">
          <span className="text-muted-foreground text-xs font-bold mb-1">Total FAQs</span>
          <span className="text-2xl font-black text-foreground">{customRules.length}</span>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-center">
          <span className="text-muted-foreground text-xs font-bold mb-1">Total Hits</span>
          <span className="text-2xl font-black text-foreground">
            {customRules.reduce((sum, r) => sum + (r.usage_count || 0), 0)}
          </span>
        </div>
        <div className="rounded-2xl border bg-green-500/10 border-green-500/20 p-5 flex flex-col justify-center relative overflow-hidden">
          <span className="text-green-400 text-xs font-bold mb-1">FAQ Contribution</span>
          <span className="text-2xl font-black text-foreground relative z-10">
            {stats.system_quota_used + stats.ai_quota_used === 0
              ? '0%'
              : Math.round((stats.system_quota_used / (stats.system_quota_used + stats.ai_quota_used)) * 100) + '%'}
          </span>
          <span className="text-[10px] text-green-500/60 mt-1 relative z-10">Queries handled without AI</span>
          <Cpu className="absolute -right-4 -bottom-4 w-20 h-20 text-green-500/5 rotate-12" />
        </div>
        <div className={`rounded-2xl border p-5 flex flex-col justify-center ${stats.no_sinhala_coverage > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-card border-border'}`}>
          <span className={`${stats.no_sinhala_coverage > 0 ? 'text-amber-400' : 'text-muted-foreground'} text-xs font-bold mb-1 flex items-center gap-1.5`}>
            {stats.no_sinhala_coverage > 0 ? <AlertTriangle size={12} /> : null}
            No Sinhala Coverage
          </span>
          <span className="text-2xl font-black text-foreground">{stats.no_sinhala_coverage}</span>
          <span className={`text-[10px] mt-1 ${stats.no_sinhala_coverage > 0 ? 'text-amber-500/60' : 'text-muted-foreground'}`}>
            {stats.no_sinhala_coverage > 0 ? 'Update these for better bot UX' : 'All good!'}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-10">

        {/* ── Missing Knowledge Inbox ── */}
        {stats.top_unmatched?.length > 0 && (
          <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 relative pt-2">
              <div className="flex items-center justify-between p-4 rounded-xl border border-amber-500/20 bg-amber-500/10">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert size={18} className="text-amber-500" />
                    <h2 className="text-lg font-bold text-amber-500">Missing Knowledge Inbox</h2>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-[10px] font-black text-amber-400 ml-2 tracking-wide uppercase">
                      {stats.top_unmatched.length} Fails
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your bot failed to answer these questions recently. Convert them to rules to guarantee 24/7 resolution.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto max-h-[280px] pr-2 custom-scrollbar">
                {stats.top_unmatched.map((um, idx) => (
                  <div key={idx} className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex flex-col justify-between shadow-lg relative group">
                    <div className="absolute top-0 right-0 bg-amber-500/20 text-amber-400 text-[10px] font-black px-3 py-1.5 rounded-bl-xl flex items-center gap-1 shadow-sm">
                      {um.count} fails
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-amber-500 mb-2 truncate pr-16">Unanswered Query</h4>
                      <p className="text-sm text-foreground leading-relaxed italic line-clamp-3">&quot;{um.message}&quot;</p>
                    </div>
                    <button
                      onClick={() => {
                        setForm({ category: 'General', keywords: '', responses: {}, is_active: true });
                        setEditTargetId(null);
                        setSeedOriginalLine(um.message);
                        setGeneralizedIntent('');
                        setModalMode('create');
                      }}
                      className="mt-6 w-full py-2 bg-amber-500 hover:bg-amber-400 text-black text-[13px] font-black rounded-xl transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                    >
                      <Plus size={14} /> Convert to FAQ
                    </button>
                  </div>
                ))}
              </div>
              </div>
        )}

        {/* ── Main Rules Engine UI (Tabs) ── */}
        <Tabs defaultValue="your-rules" className="w-full">
          <TabsList className="bg-muted border-border w-full justify-start p-1 mb-6 rounded-xl">
            <TabsTrigger value="your-rules" className="data-[state=active]:bg-secondary rounded-lg px-6 py-2">
              <MessageSquare size={16} className="mr-2" />
              Your Rules
              <span className="ml-2 bg-border text-xs px-2 py-0.5 rounded-full">{customRules.length}</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-secondary rounded-lg px-6 py-2">
              <Library size={16} className="mr-2" />
              Template Library
              <span className="ml-2 bg-border text-xs px-2 py-0.5 rounded-full">{commonRules.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="your-rules" className="mt-0">
            <div className="flex flex-col xl:flex-row gap-6 items-start">
              <div className="flex flex-col md:flex-row gap-6 flex-1 w-full">
                {/* Category Sidebar */}
                <div className="w-full md:w-56 shrink-0">
                  <div className="bg-background border border-border rounded-xl p-4 sticky top-6">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-4 px-2 uppercase tracking-wider">Categories</h3>
                    <div className="flex flex-col gap-1">
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedCategory === cat ? 'bg-secondary text-foreground font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                        >
                          {cat}
                          <span className="float-right text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">
                            {cat === 'All' ? customRules.length : customRules.filter(r => (r.category || 'General') === cat).length}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Data Table */}
                <div className="flex-1 min-w-0">
                  {loading ? (
                    <div className="p-12 text-center border rounded-xl border-border text-muted-foreground bg-background">Loading rules...</div>
                  ) : (
                    <RulesDataTable
                      data={customRules}
                      onEdit={(r) => openEditModal(r as any, false)}
                      onDelete={handleDelete}
                      onToggleStatus={handleToggleStatus as any}
                      selectedCategory={selectedCategory}
                      botReplyLang={cardPreviewLang}
                      onOpenSimulator={() => setIsSimulatorOpen(true)}
                    />
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading ? (
                <div className="p-8 text-center text-sm border rounded-xl opacity-50 col-span-full border-border">Loading...</div>
              ) : commonRules.length === 0 ? (
                <div className="p-10 border border-dashed rounded-xl flex items-center justify-center opacity-50 col-span-full border-border">
                  <p className="text-sm">No templates available yet.</p>
                </div>
              ) : commonRules.map(r => {
                const isOverridden = customRules.some(cr => cr.keywords === r.keywords);
                return (
                  <div key={r.ID} className={`p-5 border rounded-2xl flex flex-col transition-all border-border bg-card shadow-sm ${isOverridden ? 'opacity-30 grayscale' : 'opacity-80 hover:opacity-100 hover:border-border'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-wrap gap-1.5 max-w-[70%]">
                        {r.keywords.split(',').map((kw, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full text-[11px] border bg-transparent text-gray-400 border-border">
                            {kw.trim()}
                          </span>
                        ))}
                      </div>
                      {!isOverridden ? (
                        <button
                          onClick={() => openEditModal(r as any, true)}
                          className="flex items-center gap-1.5 text-[11px] text-foreground border px-2 py-1 rounded-lg bg-secondary hover:bg-border transition-colors border-border"
                        >
                          <Edit2 size={12} /> Clone
                        </button>
                      ) : (
                        <span className="text-[10px] uppercase font-bold text-gray-500">Cloned</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 leading-relaxed bg-black/20 p-3 rounded-lg border border-transparent mt-2 whitespace-pre-wrap">
                      {responseLang !== 'english_first' && r.sinhala_response ? r.sinhala_response : r.response}
                      {responseLang !== 'english_first' && r.sinhala_response && (
                        <span className="ml-2 text-[10px] text-green-400 font-bold align-middle">සිංහල</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Modals ── */}
      {bulkModalOpen && (
        <BulkTranslateModal
          rules={customRules as any}
          sourceLang="en"
          targetLang="si"
          onClose={() => setBulkModalOpen(false)}
          onApprove={handleBulkApprove as any}
        />
      )}
      {(modalMode === 'create' || modalMode === 'edit_custom' || modalMode === 'clone_common') && (
        <RuleModal
          mode={modalMode}
          form={form}
          setForm={setForm}
          botLangs={botLangs}
          seedOriginalLine={seedOriginalLine}
          generalizedIntent={generalizedIntent}
          drafting={drafting}
          onSubmit={handleSubmit}
          onClose={closeModal}
          onAutoDraft={handleAutoDraft}
          t={t}
        />
      )}

      {modalMode === 'generate_ai' && (
        <AIGenerateModal
          plan={stats.plan}
          ruleGenerationCount={stats.rule_generation_count}
          generating={generating}
          generateIntent={generateIntent}
          setGenerateIntent={setGenerateIntent}
          onSubmit={handleGenerateRule}
          onClose={closeModal}
        />
      )}
      {/* Sandbox Simulator Slide-over */}
      <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${isSimulatorOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSimulatorOpen(false)} />
        
        {/* Slide-over panel */}
        <div className={`absolute inset-y-0 right-0 w-full sm:w-[450px] transition-transform duration-300 ease-out flex flex-col ${isSimulatorOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <SandboxSimulator onClose={() => setIsSimulatorOpen(false)} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page export (Suspense boundary for useSearchParams)
// ─────────────────────────────────────────────────────────────────────────────
export default function RulesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading Rules Engine...</div>}>
      <RulesContent />
    </Suspense>
  );
}
