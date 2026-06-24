'use client';

import { useState, useEffect, Suspense } from 'react';
import { MessageSquare, Library } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UpgradeBanner from '@/components/UpgradeBanner';
import { toast } from 'sonner';
import { useLocale } from '@/lib/locale';
import { useRulesPage } from '@/hooks/useRulesPage';
import { API_URL } from '@/hooks/_shared';

import { Rule, parseResponses } from './types';
import { RuleModal, AIGenerateModal, RuleViewDialog } from './components/RuleModal';
import { RulesDataTable } from './components/RulesDataTable';
import { BulkTranslateModal } from './components/BulkTranslateModal';
import { SandboxSimulator } from './components/SandboxSimulator';

// Extracted Subcomponents
import { RulesPageHeader } from './components/RulesPageHeader';
import { RulesStatsRow } from './components/RulesStatsRow';
import { KnowledgeGapsInbox } from './components/KnowledgeGapsInbox';
import { CategoryFilter } from './components/CategoryFilter';
import { TemplateLibrary } from './components/TemplateLibrary';

// ─────────────────────────────────────────────────────────────────────────────
// Rules Content Component (wrapped in Suspense for useSearchParams)
// ─────────────────────────────────────────────────────────────────────────────

function RulesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const seed = searchParams.get('seed');
  const { t } = useLocale();

  // ── SWR-backed data ────────────────────────────────────────────────────────
  const {
    customRules,
    commonRules,
    stats,
    botLangs,
    botReplyLang,
    responseLang,
    isLoading: loading,
    toggleRuleStatus,
    deleteRule,
    markGapNotNeeded,
    revalidate,
  } = useRulesPage();

  // ── UI toggles ─────────────────────────────────────────────────────────────
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(customRules.map((r) => r.category || 'General')))];

  // Card preview language — driven by botReplyLang
  const [cardPreviewLang, setCardPreviewLang] = useState<string>('si');
  useEffect(() => {
    setCardPreviewLang(botReplyLang);
  }, [botReplyLang]);

  // ── Modal state ────────────────────────────────────────────────────────────
  const [modalMode, setModalMode] = useState<'create' | 'edit_custom' | 'clone_common' | 'generate_ai' | null>(null);
  const [editTargetId, setEditTargetId] = useState<number | null>(null);
  const [gapId, setGapId] = useState<number | null>(null);
  const [viewRule, setViewRule] = useState<Rule | null>(null);

  const [form, setForm] = useState({
    category: 'General',
    keywords: '',
    responses: {} as Record<string, string>,
    is_active: true,
  });

  const [seedOriginalLine, setSeedOriginalLine] = useState('');
  const [generalizedIntent, setGeneralizedIntent] = useState('');
  const [generateIntent, setGenerateIntent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Seed from URL — open create modal pre-filled
  useEffect(() => {
    if (seed) {
      setForm((prev) => ({ ...prev, keywords: seed || '', category: 'General' }));
      setModalMode('create');
    }
  }, [seed]);

  // ── Modal helpers ──────────────────────────────────────────────────────────
  function openCreateModal() {
    setEditTargetId(null);
    setGapId(null);
    setForm({ category: 'General', keywords: '', responses: {}, is_active: true });
    setSeedOriginalLine('');
    setGeneralizedIntent('');
    setModalMode('create');
  }

  function openEditModal(r: Rule, isCommon: boolean) {
    setEditTargetId(r.ID);
    setGapId(null);
    const responses = parseResponses(r.responses, r.response, r.sinhala_response);
    setForm({
      category: r.category || 'General',
      keywords: r.keywords,
      responses,
      is_active: r.is_active,
    });
    setSeedOriginalLine('');
    setGeneralizedIntent('');
    setModalMode(isCommon ? 'clone_common' : 'edit_custom');
  }

  function closeModal() {
    setModalMode(null);
    setSeedOriginalLine('');
    setGeneralizedIntent('');
    setGapId(null);
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleCreateFAQFromGap(message: string, currentGapId: number) {
    setForm({ category: 'General', keywords: '', responses: {}, is_active: true });
    setEditTargetId(null);
    setSeedOriginalLine(message);
    setGapId(currentGapId);
    setGeneralizedIntent('');
    setModalMode('create');
  }

  const handleBulkApprove = async (updatedRules: Rule[]) => {
    try {
      for (const rule of updatedRules) {
        const res = await fetch(`/api/v1/rules/${rule.ID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            responses: JSON.parse(rule.responses || '{}'),
          }),
        });
        if (!res.ok) throw new Error(`Failed to update rule ${rule.ID}`);
      }
      toast.success('Bulk translations saved!');
      setBulkModalOpen(false);
      revalidate();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isPost = modalMode === 'create' || modalMode === 'clone_common';
    const url = isPost ? `${API_URL}/api/v1/rules` : `${API_URL}/api/v1/rules/${editTargetId}`;
    const method = isPost ? 'POST' : 'PUT';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          category: form.category,
          keywords: form.keywords,
          responses: form.responses,
          response: form.responses['en'] || '',
          sinhala_response: form.responses['si'] || '',
          is_active: form.is_active,
          ...(seedOriginalLine ? { resolved_message: seedOriginalLine } : {}),
          ...(gapId ? { gap_id: gapId } : {}),
        }),
      });
      if (res.ok) {
        toast.success('Rule saved successfully');
        closeModal();
        revalidate();
      } else {
        toast.error('Failed to save rule');
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleGenerateRule(e: React.FormEvent) {
    e.preventDefault();
    if (!generateIntent) return;
    setGenerating(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/rules/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ intent: generateIntent }),
      });
      const data = await res.json();
      if (res.ok) {
        const generatedMap: Record<string, string> = data.responses || {};
        if (!generatedMap['en'] && data.response) generatedMap['en'] = data.response;
        if (!generatedMap['si'] && data.sinhala_response) generatedMap['si'] = data.sinhala_response;
        setForm({ category: 'General', keywords: data.keywords, responses: generatedMap, is_active: true });
        setGenerateIntent('');
        setModalMode('create');
        revalidate();
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
    const isInboxMode = !!seedOriginalLine;
    const messageToSend = isInboxMode ? seedOriginalLine : form.keywords;
    if (!messageToSend.trim()) {
      toast.error(isInboxMode ? 'No customer message to generalize.' : 'Please add Trigger Keywords first.');
      return;
    }
    setDrafting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/faqs/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: messageToSend, from_inbox: isInboxMode }),
      });
      if (res.ok) {
        const data = await res.json();
        const incoming: Record<string, string> = data.responses || {};
        if (!incoming['en'] && data.response) incoming['en'] = data.response;
        if (!incoming['si'] && data.sinhala_response) incoming['si'] = data.sinhala_response;
        if (isInboxMode && data.keywords) {
          setForm((prev) => ({
            ...prev,
            keywords: data.keywords || prev.keywords,
            responses: { ...prev.responses, ...incoming },
          }));
          if (data.generalized_intent) setGeneralizedIntent(data.generalized_intent);
          toast.success('✨ Intent generalized and rule drafted!');
        } else {
          setForm((prev) => ({ ...prev, responses: { ...prev.responses, ...incoming } }));
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

  async function handleToggleStatus(r: Rule) {
    await toggleRuleStatus(r as any);
  }

  async function handleDelete(id: number) {
    const ok = await deleteRule(id);
    if (!ok) {
      setUpgradeMessage('This action requires a higher plan');
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto w-full pb-12">
      {/* Upgrade Banner */}
      {upgradeMessage && (
        <div className="mb-6">
          <UpgradeBanner message={upgradeMessage} onDismiss={() => setUpgradeMessage(null)} />
        </div>
      )}

      {/* Rules Page Header */}
      <RulesPageHeader
        stats={stats}
        t={t}
        onAddRule={openCreateModal}
        onBulkTranslate={() => setBulkModalOpen(true)}
        onGenerateAI={() => {
          setGenerateIntent('');
          setModalMode('generate_ai');
        }}
      />

      {/* Rules Stats Row */}
      <RulesStatsRow stats={stats} customRules={customRules} />

      <div className="flex flex-col gap-10">
        {/* Knowledge Gaps Inbox */}
        <KnowledgeGapsInbox
          gaps={stats.top_unmatched}
          onCreateFAQFromGap={handleCreateFAQFromGap}
          onNavigate={(url) => router.push(url)}
          onMarkNotNeeded={markGapNotNeeded}
        />

        {/* Main Rules Engine Tabs */}
        <Tabs defaultValue="your-rules" className="w-full">
          <TabsList className="bg-muted border-border w-full justify-start p-1 mb-6 rounded-xl">
            <TabsTrigger value="your-rules" className="data-[state=active]:bg-secondary rounded-lg px-6 py-2">
              <MessageSquare size={16} className="mr-2" />
              Your Rules
              <span className="ml-2 bg-border text-xs px-2 py-0.5 rounded-full">{customRules.length}</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-secondary rounded-lg px-6 py-2">
              <Library size={16} className="mr-2" />
              FAQ Templates
              <span className="ml-2 bg-border text-xs px-2 py-0.5 rounded-full">{commonRules.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="your-rules" className="mt-0">
            <div className="space-y-4">
              {/* Category Filter */}
              <CategoryFilter
                categories={categories}
                selectedCategory={selectedCategory}
                customRules={customRules}
                onSelect={setSelectedCategory}
              />

              {loading ? (
                <div className="p-12 text-center border rounded-xl border-border text-muted-foreground bg-background">
                  Loading rules...
                </div>
              ) : (
                <RulesDataTable
                  data={customRules}
                  onView={(r) => setViewRule(r as any)}
                  onEdit={(r) => openEditModal(r as any, false)}
                  onDelete={handleDelete}
                  onToggleStatus={handleToggleStatus as any}
                  selectedCategory={selectedCategory}
                  botReplyLang={cardPreviewLang}
                  onOpenSimulator={() => setIsSimulatorOpen(true)}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-0">
            <TemplateLibrary
              commonRules={commonRules}
              customRules={customRules}
              responseLang={responseLang}
              loading={loading}
              onClone={(r) => openEditModal(r, true)}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals & Dialogs */}
      {viewRule && (
        <RuleViewDialog
          rule={viewRule}
          botLangs={botLangs}
          onClose={() => setViewRule(null)}
        />
      )}

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
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          isSimulatorOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSimulatorOpen(false)} />

        {/* Slide-over panel */}
        <div
          className={`absolute inset-y-0 right-0 w-full sm:w-[450px] transition-transform duration-300 ease-out flex flex-col ${
            isSimulatorOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <SandboxSimulator onClose={() => setIsSimulatorOpen(false)} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page Export
// ─────────────────────────────────────────────────────────────────────────────

export default function RulesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading Rules Engine...</div>}>
      <RulesContent />
    </Suspense>
  );
}
