import React from 'react';
import { UserCircle, ShoppingBag, Bot, Pencil, X, Check, Tag, ArrowLeft } from 'lucide-react';
import { useChatContext } from '../_context/ChatContext';
import { formatPhone, fmtDate, parseItems, STATUS_ORDER, STATUS_STYLE } from '../utils';

export function CRMPanel() {
  const {
    activePhone,
    customer,
    orders,
    editingCRM,
    setEditingCRM,
    crmForm,
    setCrmForm,
    setMobileView,
    saveCRM,
    togglingBot,
    toggleBot,
    timeLeft,
    updateOrderStatus,
  } = useChatContext();

  if (!activePhone) return null;

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-l border-zinc-800/60">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between shrink-0 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <button onClick={() => setMobileView('chat')} className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
            <ArrowLeft size={17} />
          </button>
          <span className="text-sm font-bold text-zinc-200">Customer Profile</span>
        </div>
        {!editingCRM ? (
          <button onClick={() => setEditingCRM(true)} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
            <Pencil size={11} /> Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditingCRM(false)} className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 transition-colors">
              <X size={13} />
            </button>
            <button onClick={saveCRM} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-bold bg-emerald-500 text-black hover:bg-emerald-400 transition-colors">
              <Check size={13} /> Save
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Bot Toggle */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Bot size={14} className={customer?.bot_paused ? 'text-zinc-500' : 'text-emerald-400'} />
                <span className="text-xs font-bold text-zinc-200">AI Auto-Reply</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed tabular-nums pl-0.5">
                {customer?.bot_paused
                  ? timeLeft
                    ? (timeLeft.m > 0 || timeLeft.s > 0 ? `Paused · resumes in ${timeLeft.m}m ${timeLeft.s}s` : 'Resuming…')
                    : 'Paused · manual control'
                  : 'Active · responding automatically'}
              </p>
            </div>
            <button
              onClick={toggleBot}
              disabled={togglingBot || !activePhone}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 outline-none ${
                (customer?.bot_paused ?? false) ? 'bg-zinc-700' : 'bg-emerald-500'
              } disabled:opacity-50`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                (customer?.bot_paused ?? false) ? 'translate-x-0' : 'translate-x-5'
              }`} />
            </button>
          </div>
        </section>

        {/* Identity */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/60">
            <UserCircle size={13} className="text-emerald-400" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Identity</span>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 font-semibold ml-0.5">Phone</label>
            <p className="text-xs font-mono mt-1 px-3 py-2 bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-300 select-all">
              {formatPhone(customer?.phone || activePhone || undefined)}
            </p>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 font-semibold ml-0.5">Name</label>
            {editingCRM
              ? <input value={crmForm.name} onChange={e => setCrmForm({...crmForm, name: e.target.value})} className="mt-1 w-full text-sm px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white outline-none focus:border-zinc-500 transition-colors" placeholder="Full name…" />
              : <p className={`text-sm mt-1 px-3 py-2 rounded-lg border border-transparent ${customer?.name ? 'text-zinc-200 bg-zinc-900/50' : 'text-zinc-600 italic'}`}>{customer?.name || 'Not set'}</p>
            }
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 font-semibold ml-0.5">Address</label>
            {editingCRM
              ? <input value={crmForm.address} onChange={e => setCrmForm({...crmForm, address: e.target.value})} className="mt-1 w-full text-sm px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white outline-none focus:border-zinc-500 transition-colors" placeholder="Delivery address…" />
              : <p className={`text-sm mt-1 px-3 py-2 rounded-lg border border-transparent ${customer?.address ? 'text-zinc-200 bg-zinc-900/50' : 'text-zinc-600 italic'}`}>{customer?.address || 'Not set'}</p>
            }
          </div>
        </section>

        {/* Tags */}
        <section>
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/60 mb-3">
            <Tag size={13} className="text-blue-400" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Tags</span>
          </div>
          {editingCRM
            ? <input value={crmForm.tags} onChange={e => setCrmForm({...crmForm, tags: e.target.value})} className="w-full text-sm px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white outline-none focus:border-zinc-500 transition-colors" placeholder="vip, bulk, returning…" />
            : (
              <div className="flex flex-wrap gap-1.5">
                {customer?.tags
                  ? customer.tags.split(',').map((t, i) => (
                      <span key={i} className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {t.trim()}
                      </span>
                    ))
                  : <span className="text-xs text-zinc-600 italic">No tags</span>
                }
              </div>
            )
          }
        </section>

        {/* Notes */}
        <section>
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/60 mb-3">
            <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Private Notes</span>
          </div>
          {editingCRM
            ? <textarea value={crmForm.notes} onChange={e => setCrmForm({...crmForm, notes: e.target.value})} rows={3} className="w-full text-sm px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white outline-none resize-none focus:border-zinc-500 transition-colors" placeholder="Internal notes…" />
            : <p className={`text-sm p-3 rounded-xl border leading-relaxed ${customer?.notes ? 'text-zinc-300 bg-zinc-900/50 border-zinc-800/50' : 'text-zinc-600 italic border-zinc-800/30'}`}>{customer?.notes || 'No notes.'}</p>
          }
        </section>

        {/* Orders */}
        <section>
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/60 mb-3">
            <ShoppingBag size={13} className="text-purple-400" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Orders</span>
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-500 border border-zinc-800">
              {orders.length}
            </span>
          </div>
          {orders.length === 0
            ? <p className="text-xs text-center py-4 rounded-xl text-zinc-600 bg-zinc-900/50 border border-zinc-800 border-dashed">No orders yet</p>
            : (
              <div className="space-y-2.5">
                {orders.map(o => {
                  const items = parseItems(o.items);
                  return (
                    <div key={o.ID} className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-zinc-500">ORDER #{o.ID}</span>
                        <span className="text-[10px] text-zinc-600">{fmtDate(o.CreatedAt)}</span>
                      </div>
                      <div className="space-y-1 border-t border-zinc-800/50 pt-1.5">
                        {items.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-xs">
                            <span className="truncate pr-2 text-zinc-300"><span className="text-zinc-600 mr-1">{item.qty}×</span>{item.name}</span>
                            <span className="shrink-0 text-zinc-400 font-mono">Rs.{Number(item.price).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center border-t border-zinc-800 pt-2">
                        <span className="text-sm font-black text-white">Rs.{o.total_price.toLocaleString()}</span>
                        <select
                          value={o.status}
                          onChange={e => updateOrderStatus(o.ID, e.target.value)}
                          className={`text-[10px] font-bold uppercase rounded-md px-2 py-1 outline-none cursor-pointer border ${STATUS_STYLE[o.status] ?? ''}`}
                          style={{ background: 'transparent' }}
                        >
                          {STATUS_ORDER.map(s => (
                             <option key={s} value={s} className="bg-zinc-900 text-white">{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </section>
      </div>
    </div>
  );
}
