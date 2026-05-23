import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Order } from './types';
import { COL_STYLE, fmtMoney } from './constants';
import { OrderCard } from './OrderCard';

interface ColumnProps {
  colKey: string;
  label: string;
  emoji: string;
  orders: Order[];
  onDragStart: (e: React.DragEvent, order: Order) => void;
  onDrop: (colKey: string) => void;
  onCardClick: (order: Order) => void;
}

export function KanbanColumn({ colKey, label, emoji, orders, onDragStart, onDrop, onCardClick }: ColumnProps) {
  const [isOver, setIsOver] = useState(false);
  const style = COL_STYLE[colKey] || COL_STYLE['new'];

  const revenue = orders.filter(o => colKey === 'delivered').reduce((s, o) => s + o.total_price, 0);
  const overdueCount = orders.filter(o => {
    const days = Math.floor((Date.now() - new Date(o.updated_at).getTime()) / (1000 * 60 * 60 * 24));
    return colKey === 'shipped' && days >= 5;
  }).length;

  return (
    <div
      className={`flex flex-col min-w-[280px] w-[280px] rounded-2xl border transition-all duration-150 ${
        isOver ? style.drop + ' scale-[1.01]' : 'border-border bg-muted'
      }`}
      onDragOver={e => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={() => { setIsOver(false); onDrop(colKey); }}
    >
      {/* Column header */}
      <div className={`flex items-center justify-between p-4 rounded-t-2xl border-b ${style.header}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">{emoji}</span>
          <span className="font-black text-sm text-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {colKey === 'shipped' && overdueCount > 0 && (
            <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20 flex items-center gap-1">
              <AlertTriangle size={10} /> {overdueCount} Overdue
            </span>
          )}
          {colKey === 'delivered' && revenue > 0 && (
            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              {fmtMoney(revenue)}
            </span>
          )}
          <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${style.badge}`}>
            {orders.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3 p-3 overflow-y-auto max-h-[calc(100vh-280px)] flex-1">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-2xl mb-2 opacity-30">{emoji}</div>
            <p className="text-xs text-muted-foreground font-medium">No {label.toLowerCase()} orders</p>
            {isOver && <p className="text-xs text-muted-foreground mt-1">Drop to move here</p>}
          </div>
        ) : (
          orders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onDragStart={onDragStart}
              onClick={onCardClick}
            />
          ))
        )}
      </div>
    </div>
  );
}
