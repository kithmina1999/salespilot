import { Package, BookOpen, Users, ShoppingCart, DollarSign, MonitorSmartphone } from "lucide-react";
import type { BusinessCounts } from "../types";

export function CountsOverview({ counts }: { counts: BusinessCounts | null }) {
  if (!counts) return null;

  const cards = [
    { label: "Products", value: counts.products_total, sub: `${counts.products_active} active`, icon: <Package className="w-4 h-4 text-emerald-500" />, bg: "bg-emerald-500/10" },
    { label: "FAQ Rules", value: counts.rules_total, sub: `${counts.rules_active} active`, icon: <BookOpen className="w-4 h-4 text-blue-500" />, bg: "bg-blue-500/10" },
    { label: "Customers", value: counts.customers, sub: "total", icon: <Users className="w-4 h-4 text-indigo-500" />, bg: "bg-indigo-500/10" },
    { label: "Orders", value: counts.orders, sub: "total", icon: <ShoppingCart className="w-4 h-4 text-amber-500" />, bg: "bg-amber-500/10" },
    { label: "Revenue", value: `Rs. ${counts.total_revenue?.toLocaleString() || 0}`, sub: "all time", icon: <DollarSign className="w-4 h-4 text-emerald-500" />, bg: "bg-emerald-500/10" },
    { label: "Dashboard Users", value: counts.dashboard_users, sub: "staff & admins", icon: <MonitorSmartphone className="w-4 h-4 text-primary" />, bg: "bg-primary/10" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {cards.map((c, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2 transition-colors hover:bg-secondary/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">{c.label}</span>
            <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>
              {c.icon}
            </div>
          </div>
          <div>
            <div className="text-xl font-black text-foreground tracking-tight">{c.value}</div>
            <div className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{c.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
