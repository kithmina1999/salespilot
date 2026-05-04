'use client';
import { useState, useEffect } from 'react';
import {
  Plus, PackageOpen, Edit2, Trash, ShoppingBag,
  CheckCircle2, X, ChevronRight, ExternalLink, Copy, AlertCircle, Loader2, Link2, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { useLocale } from '@/lib/locale';
import { useProducts } from '@/hooks/useProducts';
import { ToolbarSearch } from '@/components/dashboard';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  active: boolean;
  description: string;
  image_url: string;
  retailer_id: string; // Meta Commerce Catalog Retailer ID
}

// ── Sync Setup Dialog — multi-step guide ──────────────────────────────────────
const STEPS = [
  {
    num: 1,
    title: 'Create a Catalog in Meta Commerce Manager',
    desc: 'Go to Commerce Manager and create a new catalog. Choose "Ecommerce" as the type.',
    link: { label: 'Open Commerce Manager →', url: 'https://business.facebook.com/commerce' },
    tip: 'Name it after your business (e.g., "Keda Cosmetics Catalog")',
  },
  {
    num: 2,
    title: 'Add your products to the catalog',
    desc: 'In Commerce Manager, manually add each product with its name, price, image and a short description. Give each product a simple Retailer ID (e.g., "soap-001", "serum-blue").',
    tip: 'The Retailer ID is like a SKU — you make it up, just keep it simple and unique.',
  },
  {
    num: 3,
    title: 'Link the catalog to your WhatsApp number',
    desc: 'In WhatsApp Manager → Settings → Catalog → select your catalog and link it to your WhatsApp Business phone number.',
    link: { label: 'Open WhatsApp Manager →', url: 'https://business.facebook.com/wa/manage/phone-numbers/' },
    tip: 'Only one catalog can be linked per phone number at a time.',
  },
  {
    num: 4,
    title: 'Paste your Catalog ID below',
    desc: 'Once the catalog is created, copy its ID from Commerce Manager → Settings → Catalog ID.',
    tip: 'It\'s a long number like "1234567890123456".',
  },
];

function SyncSetupDialog({ onClose, onSave }: { onClose: () => void; onSave: (id: string) => void }) {
  const [step, setStep]       = useState(0);
  const [catalogID, setCatalogID] = useState('');
  const [saving, setSaving]   = useState(false);

  async function handleSave() {
    if (!catalogID.trim()) { toast.error('Please enter your Catalog ID'); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/settings/business`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ meta_catalog_id: catalogID.trim() }),
      });
      if (res.ok) {
        onSave(catalogID.trim());
        toast.success('Catalog ID saved! Now add Retailer IDs to each product below.');
        onClose();
      } else {
        toast.error('Failed to save Catalog ID');
      }
    } finally { setSaving(false); }
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-zinc-800 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center shrink-0">
              <ShoppingBag size={17} className="text-green-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Sync with WhatsApp Catalog</h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">Step {step + 1} of {STEPS.length}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"><X size={15} /></button>
        </div>

        {/* Step progress bar */}
        <div className="flex gap-1 px-6 py-3">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= step ? 'bg-green-500' : 'bg-zinc-800'}`} />
          ))}
        </div>

        {/* Step content */}
        <div className="px-6 pb-3 min-h-[200px]">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center text-[11px] font-black text-green-400 shrink-0">
              {current.num}
            </span>
            <h3 className="text-sm font-bold text-white">{current.title}</h3>
          </div>

          <p className="text-sm text-zinc-400 leading-relaxed mb-3">{current.desc}</p>

          {current.link && (
            <a
              href={current.link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-400 hover:text-green-300 bg-green-500/8 border border-green-500/20 px-3 py-1.5 rounded-lg transition-colors mb-3"
            >
              {current.link.label} <ExternalLink size={11} />
            </a>
          )}

          {current.tip && (
            <div className="flex items-start gap-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2.5 mb-3">
              <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-zinc-400 leading-relaxed">{current.tip}</p>
            </div>
          )}

          {/* Catalog ID input on last step */}
          {isLast && (
            <div className="mt-2">
              <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Your Catalog ID</label>
              <input
                autoFocus
                placeholder="e.g. 1234567890123456"
                value={catalogID}
                onChange={e => setCatalogID(e.target.value)}
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-sm font-mono outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/10 text-white placeholder-zinc-600 transition-colors"
              />
              <p className="text-[10px] text-zinc-600 mt-1.5 leading-relaxed">
                Found in Commerce Manager → your catalog → Settings → Catalog ID
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-between gap-3">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors"
          >
            ← Back
          </button>
          {isLast ? (
            <button
              onClick={handleSave}
              disabled={saving || !catalogID.trim()}
              className="flex items-center gap-2 font-bold text-sm px-5 py-2 rounded-xl bg-green-500 text-black hover:bg-green-400 disabled:opacity-40 transition-all"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Save & Finish
            </button>
          ) : (
            <button
              onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
              className="flex items-center gap-2 font-bold text-sm px-5 py-2 rounded-xl bg-zinc-100 text-black hover:bg-white transition-all"
            >
              Next <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProductsPage() {
  // SWR-backed data — optimistic toggle & delete built in
  const { products, isLoading: loading, toggleProductActive, deleteProduct, revalidate } = useProducts();

  const [search,   setSearch]       = useState('');
  const [catalogID, setCatalogID]   = useState('');
  const [showSync, setShowSync]     = useState(false);
  const plan = useAppStore(s => s.business?.plan ?? 'free');
  const { t } = useLocale();

  function openSync() {
    if (plan === 'free') {
      toast.error('WhatsApp Catalog Sync is a Starter feature. Upgrade to unlock native shopping!', { duration: 4000 });
      return;
    }
    setShowSync(true);
  }

  // Modal / form
  const [modalMode,    setModalMode]    = useState<'create' | 'edit' | null>(null);
  const [editTargetId, setEditTargetId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '', category: '', price: '', stock: '',
    description: '', active: true, retailer_id: '',
  });

  useEffect(() => {
    fetchCatalogID();
  }, []);

  async function fetchCatalogID() {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/api/v1/settings/business`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setCatalogID(d.meta_catalog_id || ''); }
    } catch { /* silent */ }
  }

  function openCreate() {
    setEditTargetId(null);
    setForm({ name: '', category: '', price: '', stock: '', description: '', active: true, retailer_id: '' });
    setModalMode('create');
  }

  function openEdit(p: Product) {
    setEditTargetId(p.id);
    setForm({
      name: p.name, category: p.category,
      price: p.price.toString(), stock: p.stock.toString(),
      description: p.description || '', active: p.active,
      retailer_id: p.retailer_id || '',
    });
    setModalMode('edit');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price = Number.parseFloat(form.price);
    const stock = Number.parseInt(form.stock, 10);
    if (!Number.isFinite(price) || price < 0) {
      toast.error('Enter a valid product price');
      return;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      toast.error('Enter a valid stock quantity');
      return;
    }

    const token = localStorage.getItem('token');
    const url = modalMode === 'create'
      ? `${API_URL}/api/v1/products`
      : `${API_URL}/api/v1/products/${editTargetId}`;
    try {
      const res = await fetch(url, {
        method: modalMode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name, category: form.category,
          price, stock,
          description: form.description, active: form.active,
          retailer_id: form.retailer_id,
        }),
      });
      if (res.ok) {
        toast.success(modalMode === 'create' ? 'Product created' : 'Product updated');
        setModalMode(null);
        await revalidate(); // SWR revalidation replaces manual fetchProducts()
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || 'Failed to save product');
      }
    } catch { toast.error('Network error'); }
  }

  // Toggle and delete are now handled by the SWR hook directly
  const handleToggle = toggleProductActive;
  const handleDelete = deleteProduct;

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  const linkedCount = products.filter(p => p.retailer_id).length;
  const catalogConnected = !!catalogID;

  return (
    <div className="max-w-7xl mx-auto w-full pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('products.title')}</h1>
          <p className="text-sm mt-1 text-zinc-400">{t('products.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* WhatsApp Sync status/button */}
          <button
            onClick={openSync}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
              catalogConnected
                ? 'bg-green-500/8 border-green-500/25 text-green-400 hover:bg-green-500/15'
                : plan === 'free'
                ? 'bg-zinc-900 border-zinc-700 text-zinc-500 cursor-not-allowed'
                : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {plan === 'free' ? <Lock size={13} /> : <ShoppingBag size={14} />}
            {catalogConnected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                WhatsApp Synced
              </>
            ) : plan === 'free' ? 'Sync with WhatsApp 🔒' : 'Sync with WhatsApp'}
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-green-500 hover:bg-green-400 text-black shadow-lg transition-all"
          >
            <Plus size={15} /> {t('products.add_product')}
          </button>
        </div>
      </div>

      {/* ── Catalog status bar (if linked) ── */}
      {catalogConnected && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/5 border border-green-500/15">
          <CheckCircle2 size={14} className="text-green-400 shrink-0" />
          <p className="text-xs text-zinc-400">
            <span className="text-green-400 font-semibold">WhatsApp Catalog connected.</span>
            {' '}
            <span className="font-mono text-zinc-500 text-[10px]">{catalogID}</span>
            {' · '}
            {linkedCount}/{products.length} products have Retailer IDs linked.
            {linkedCount < products.length && (
              <span className="text-amber-400"> Edit each product to add missing Retailer IDs.</span>
            )}
          </p>
          <button onClick={() => setShowSync(true)} className="ml-auto text-[10px] text-zinc-500 hover:text-zinc-300 shrink-0 flex items-center gap-1 transition-colors">
            <Edit2 size={10} /> Change
          </button>
        </div>
      )}

      {/* ── Search bar ── */}
      <ToolbarSearch
        label="Search products"
        placeholder={t('common.search') + ' ' + t('products.title').toLowerCase() + '…'}
        value={search}
        onChange={setSearch}
        className="max-w-sm mb-5"
      />

      {/* ── Table ── */}
      <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900/50 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/60">
              <th className="font-semibold px-5 py-3.5 text-zinc-500 text-xs uppercase tracking-wider">{t('products.product_name')}</th>
              <th className="font-semibold px-5 py-3.5 text-zinc-500 text-xs uppercase tracking-wider">{t('products.category')}</th>
              <th className="font-semibold px-5 py-3.5 text-zinc-500 text-xs uppercase tracking-wider">{t('products.price')}</th>
              <th className="font-semibold px-5 py-3.5 text-zinc-500 text-xs uppercase tracking-wider">{t('products.stock')}</th>
              <th className="font-semibold px-5 py-3.5 text-zinc-500 text-xs uppercase tracking-wider">WA Catalog</th>
              <th className="font-semibold px-5 py-3.5 text-zinc-500 text-xs uppercase tracking-wider">{t('common.active')}</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-14 text-zinc-600"><Loader2 size={22} className="animate-spin mx-auto" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7}>
                <div className="dash-empty m-5 py-16">
                  <PackageOpen size={40} className="text-emerald-400" />
                  <div>
                    <p className="dash-empty-title">{t('products.no_products')}</p>
                    <p className="dash-empty-copy mt-1">{t('products.no_products_hint')}</p>
                  </div>
                  <button type="button" onClick={openCreate} className="dash-primary-action">
                    <Plus size={15} /> {t('products.add_product')}
                  </button>
                </div>
              </td></tr>
            ) : (
              filtered.map(p => (
                <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-900/40 transition-colors group">
                  {/* Product */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {p.image_url
                        ? <img src={p.image_url} alt={p.name} className="w-9 h-9 rounded-lg object-cover border border-zinc-800 shrink-0" />
                        : <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0"><PackageOpen size={14} className="text-zinc-600" /></div>
                      }
                      <span className="font-semibold text-zinc-200 truncate max-w-[160px]">{p.name}</span>
                    </div>
                  </td>
                  {/* Category */}
                  <td className="px-5 py-3.5">
                    <span className="text-xs px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700/50 text-zinc-400">
                      {p.category || 'Uncategorized'}
                    </span>
                  </td>
                  {/* Price */}
                  <td className="px-5 py-3.5 font-mono text-sm text-zinc-300">Rs. {p.price.toFixed(2)}</td>
                  {/* Stock */}
                  <td className="px-5 py-3.5">
                    <span className={`font-mono text-sm font-bold ${p.stock <= 0 ? 'text-red-400' : p.stock < 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {p.stock}
                    </span>
                  </td>
                  {/* WA Catalog status */}
                  <td className="px-5 py-3.5">
                    {p.retailer_id
                      ? (
                        <div className="flex items-center gap-1.5">
                          <Link2 size={11} className="text-green-400" />
                          <span className="text-[10px] font-mono text-green-400/80 truncate max-w-[80px]">{p.retailer_id}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-medium text-zinc-600 flex items-center gap-1">
                          <AlertCircle size={10} className="text-amber-500/60" /> No ID
                        </span>
                      )
                    }
                  </td>
                  {/* Active toggle */}
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => handleToggle(p)}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${
                        p.active
                          ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20 hover:bg-emerald-400/20'
                          : 'text-zinc-500 bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800'
                      }`}
                    >
                      {p.active ? '● ' + t('common.active') : '○ ' + t('products.draft')}
                    </button>
                  </td>
                  {/* Actions */}
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors mr-1">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Create / Edit Modal ── */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="px-6 pt-5 pb-4 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
              <h2 className="text-base font-bold text-white">
                {modalMode === 'create' ? t('products.add_product') : t('common.edit') + ' ' + t('products.title')}
              </h2>
              <button onClick={() => setModalMode(null)} className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"><X size={15} /></button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Product Name *</label>
                <input required autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm outline-none focus:border-zinc-600 text-white transition-colors" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Price (Rs.) *</label>
                  <input required type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                    className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-mono outline-none focus:border-zinc-600 text-white transition-colors" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Stock Quantity *</label>
                  <input required type="number" min="0" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })}
                    className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-mono outline-none focus:border-zinc-600 text-white transition-colors" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Category</label>
                <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. Skincare, Clothing…"
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm outline-none focus:border-zinc-600 text-white transition-colors" />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Description</label>
                <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Short product description…"
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm outline-none focus:border-zinc-600 text-white transition-colors resize-none leading-relaxed" />
              </div>

              {/* WhatsApp Retailer ID — highlighted section */}
              <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBag size={13} className="text-green-400" />
                  <label className="text-xs font-bold text-zinc-300">WhatsApp Catalog Retailer ID</label>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400 uppercase tracking-wider">Optional</span>
                </div>
                <input
                  value={form.retailer_id}
                  onChange={e => setForm({ ...form, retailer_id: e.target.value })}
                  placeholder="e.g. soap-001, shirt-red-xl"
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-sm font-mono outline-none focus:border-green-500/40 text-white transition-colors placeholder-zinc-600"
                />
                <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">
                  The Retailer ID you assigned to this product inside Meta Commerce Manager. When filled, the AI bot can send customers a native WhatsApp product card with image and price.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="active-cb" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 accent-emerald-500 cursor-pointer" />
                <label htmlFor="active-cb" className="text-sm text-zinc-400 cursor-pointer select-none">
                  Active (visible to AI &amp; WhatsApp catalog)
                </label>
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-zinc-800">
                <button type="button" onClick={() => setModalMode(null)}
                  className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  className="px-5 py-2 text-sm font-bold bg-white text-black hover:bg-zinc-100 rounded-xl shadow-md transition-colors">
                  {modalMode === 'create' ? t('products.create_product') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Sync Setup Dialog ── */}
      {showSync && (
        <SyncSetupDialog
          onClose={() => setShowSync(false)}
          onSave={(id) => { setCatalogID(id); revalidate(); }}
        />
      )}
    </div>
  );
}
