import { AlertTriangle, ChevronRight, Hash } from 'lucide-react';
import { Order } from './types';
import { COL_STYLE, fmt, fmtMoney, parseItems, paymentBadgeConfig } from './constants';

interface CardProps {
  order: Order;
  onDragStart: (e: React.DragEvent, order: Order) => void;
  onClick: (order: Order) => void;
}

export function OrderCard({ order, onDragStart, onClick }: CardProps) {
  const items = parseItems(order.items);
  const style = COL_STYLE[order.status] || COL_STYLE['new'];

  // Overdue logic (shipped for >= 5 days)
  const daysLate = Math.floor((Date.now() - new Date(order.updated_at).getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = order.status === 'shipped' && daysLate >= 5;

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, order)}
      onClick={() => onClick(order)}
      className={`group rounded-2xl border cursor-grab active:cursor-grabbing transition-all hover:shadow-lg select-none ${
        isOverdue ? 'border-red-500/50 bg-red-950/20 hover:bg-red-950/40' : 'border-border bg-muted/60 hover:bg-muted'
      } ${style.card}`}
    >
      {/* Card header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Hash size={10} className="text-zinc-600" />
            <span className="text-[10px] font-black text-muted-foreground tracking-wider">
              {order.order_num ? `#${order.order_num}` : `ID:${order.id}`}
            </span>
          </div>
          <p className="font-bold text-sm text-foreground leading-tight">
            {order.customer_name || 'Anonymous'}
          </p>
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{order.customer_phone}</p>
        </div>
        {isOverdue ? (
          <AlertTriangle size={14} className="text-red-500 mt-1 shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-zinc-700 group-hover:text-muted-foreground transition-colors mt-1 shrink-0" />
        )}
      </div>

      {/* Items summary */}
      <div className="px-4 pb-3 space-y-1">
        {items.slice(0, 2).map((item, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{item.qty}× {item.name}{item.size ? ` (${item.size})` : ''}</span>
            <span className="text-muted-foreground font-mono">{fmtMoney(item.price)}</span>
          </div>
        ))}
        {items.length > 2 && (
          <p className="text-[10px] text-zinc-600">+{items.length - 2} more items</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border/60">
        <span className="text-sm font-black text-emerald-400">{fmtMoney(order.total_price)}</span>
        <div className="flex items-center gap-2">
          {/* Payment badge — only for bank transfers */}
          {(() => {
            const badge = paymentBadgeConfig(order.payment_method, order.payment_status);
            if (!badge) return <span className="text-[10px] text-zinc-600">{fmt(order.created_at)}</span>;
            const BadgeIcon = badge.icon;
            return (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.cls}`}>
                <BadgeIcon size={9} />{badge.label}
              </span>
            );
          })()}
          <span className="text-[10px] text-zinc-600">{fmt(order.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
