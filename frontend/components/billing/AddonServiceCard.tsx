import { Check } from 'lucide-react';
import { BillingAddon } from '@/hooks/useBillingOptions';
import { cn } from '@/lib/utils';

interface AddonServiceCardProps {
  addon: BillingAddon;
  isSelected: boolean;
  isPurchased: boolean;
  onToggle: (addon: BillingAddon) => void;
}

export default function AddonServiceCard({
  addon,
  isSelected,
  isPurchased,
  onToggle,
}: AddonServiceCardProps) {
  return (
    <div
      onClick={() => !isPurchased && onToggle(addon)}
      className={cn(
        'relative overflow-hidden rounded-xl border p-4 transition-all duration-200',
        isPurchased
          ? 'cursor-not-allowed bg-muted/50 border-muted opacity-80'
          : isSelected
          ? 'cursor-pointer border-primary bg-primary/5 ring-1 ring-primary'
          : 'cursor-pointer border-border bg-card hover:border-primary/50'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm leading-tight">{addon.name}</h4>
            {isPurchased && (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Purchased
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {addon.description}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="font-bold text-sm">
            Rs. {addon.amount.toLocaleString()}
          </div>
          {!isPurchased && (
            <div
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full border transition-colors',
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-muted-foreground/30 bg-transparent'
              )}
            >
              {isSelected && <Check size={12} strokeWidth={3} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
