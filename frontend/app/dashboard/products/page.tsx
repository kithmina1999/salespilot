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

import { API_URL } from '@/hooks/_shared';

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


// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProductsPage() {
  // SWR-backed data — optimistic toggle & delete built in
  const { products, isLoading: loading, toggleProductActive, deleteProduct, revalidate } = useProducts();

  const [search,   setSearch]       = useState('');
  const plan = useAppStore(s => s.business?.plan ?? 'free');
  const { t } = useLocale();

  // Modal / form
  const [modalMode,    setModalMode]    = useState<'create' | 'edit' | null>(null);
  const [editTargetId, setEditTargetId] = useState<number | null>(null);
  const [imageFile, setImageFile]       = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading]   = useState(false);
  const usageLoaded = useAppStore(s => s.usageLoaded);
  const usage = useAppStore(s => s.usage);
  const canUpload = usageLoaded && usage?.features?.cloudinary;

  const [form, setForm] = useState({
    name: '', category: '', price: '', stock: '',
    description: '', active: true, retailer_id: '',
  });



  function openCreate() {
    setEditTargetId(null);
    setForm({ name: '', category: '', price: '', stock: '', description: '', active: true, retailer_id: '' });
    setImageFile(null);
    setImagePreview(null);
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
    setImageFile(null);
    setImagePreview(p.image_url || null);
    setModalMode('edit');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price = Number.parseFloat(form.price);
    const stock = Number.parseInt(form.stock, 10);
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Enter a valid product price');
      return;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      toast.error('Enter a valid stock quantity');
      return;
    }

    const token = localStorage.getItem('token');
    // Store product ID to chain upload if needed
    let createdProductId: number | null = null;
    const isEdit = modalMode === 'edit';
    const url = !isEdit
      ? `${API_URL}/api/v1/products`
      : `${API_URL}/api/v1/products/${editTargetId}`;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(url, {
        method: !isEdit ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...form, price, stock })
      });
      if (res.ok) {
        const data = await res.json();
        createdProductId = data.product?.id || editTargetId;

        if (imageFile && createdProductId) {
          await uploadImage(createdProductId, imageFile);
        } else {
          toast.success(isEdit ? 'Product updated' : 'Product created');
          setModalMode(null);
          await revalidate();
        }
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || 'Failed to save product');
      }
    } catch { toast.error('Network error'); }
  }

  // Toggle and delete are now handled by the SWR hook directly
  async function uploadImage(productId: number, file: File) {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/products/${productId}/image`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        toast.success('Product saved with image!');
        setModalMode(null);
        await revalidate();
      } else {
        const d = await res.json().catch(() => null);
        toast.error(d?.error || 'Failed to upload image');
        setModalMode(null);
        await revalidate();
      }
    } catch {
      toast.error('Network error during upload');
    } finally {
      setIsUploading(false);
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      
      // If editing, auto-upload
      if (modalMode === 'edit' && editTargetId) {
        uploadImage(editTargetId, file);
      }
    }
  }

  const handleToggle = toggleProductActive;
  const handleDelete = deleteProduct;

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto w-full pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('products.title')}</h1>
          <p className="text-sm mt-1 text-zinc-400">{t('products.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-green-500 hover:bg-green-400 text-black shadow-lg transition-all"
          >
            <Plus size={15} /> {t('products.add_product')}
          </button>
        </div>
      </div>

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
              <th className="font-semibold px-5 py-3.5 text-zinc-500 text-xs uppercase tracking-wider">{t('common.active')}</th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-14 text-zinc-600"><Loader2 size={22} className="animate-spin mx-auto" /></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6}>
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
              {/* Image Drop Zone */}
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-2">Product Image</label>
                <div className="relative">
                  {!canUpload ? (
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/50 text-center">
                      <Lock size={24} className="text-zinc-600 mb-2" />
                      <p className="text-sm font-medium text-zinc-300">Image upload is locked</p>
                      <p className="text-xs text-zinc-500 mt-1">Upgrade to a paid plan to upload product images.</p>
                    </div>
                  ) : imagePreview ? (
                    <div className="relative rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900 group">
                      <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <label className="cursor-pointer px-4 py-2 bg-white text-black text-xs font-bold rounded-lg shadow-lg hover:bg-zinc-200 transition-colors">
                          Change Image
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} disabled={isUploading} />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-800 hover:border-green-500/50 hover:bg-green-500/5 rounded-xl cursor-pointer transition-all group">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 group-hover:bg-green-500/10 flex items-center justify-center mb-3 transition-colors">
                        <ShoppingBag size={18} className="text-zinc-500 group-hover:text-green-500 transition-colors" />
                      </div>
                      <p className="text-sm font-medium text-zinc-300 group-hover:text-green-500 transition-colors">Click to upload image</p>
                      <p className="text-xs text-zinc-500 mt-1">JPG, PNG or WebP accepted</p>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} disabled={isUploading} />
                    </label>
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center rounded-xl z-10 border border-zinc-800">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 size={24} className="animate-spin text-green-500" />
                        <span className="text-xs font-bold animate-pulse text-zinc-200">Uploading...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Product Name *</label>
                <input required autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm outline-none focus:border-zinc-600 text-white transition-colors" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 block mb-1.5">Price (Rs.) *</label>
                  <input required type="number" min="0.01" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
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
                <button type="submit" disabled={!form.name || !form.price || isUploading}
                  className="px-5 py-2 text-sm font-bold bg-white text-black hover:bg-zinc-100 rounded-xl shadow-md transition-colors disabled:opacity-50">
                  {modalMode === 'create' ? t('products.create_product') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
}
