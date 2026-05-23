import { Check, XCircle } from 'lucide-react';
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
  const isAvailable = addon.is_available !== false;
  const disabledReason = addon.disabled_reason;
  const purchasedLabel = addon.purchase_policy === 'repeatable' ? 'Purchased before' : 'Purchased';

  return (
    <div
      onClick={() => isAvailable && onToggle(addon)}
      className={cn(
        'relative overflow-hidden rounded-xl border p-4 transition-all duration-200',
        !isAvailable
          ? 'cursor-not-allowed bg-muted/50 border-muted opacity-80'
          : isSelected
          ? 'cursor-pointer border-primary bg-primary/5 ring-1 ring-primary'
          : 'cursor-pointer border-border bg-card hover:border-primary/50'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm leading-tight">{addon.name}</h4>
            {addon.badge && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                {addon.badge}
              </span>
            )}
            {isPurchased && (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {purchasedLabel}
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {addon.description}
          </p>

          {((addon.includes && addon.includes.length > 0) || (addon.not_included && addon.not_included.length > 0)) && (
            <div className="mt-3 space-y-2">
              {addon.includes && addon.includes.length > 0 && (
                <ul className="space-y-1">
                  {addon.includes.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Check className="size-3 text-emerald-500 mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
              {addon.not_included && addon.not_included.length > 0 && (
                <ul className="space-y-1">
                  {addon.not_included.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <XCircle className="size-3 text-destructive mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!isAvailable && disabledReason && (
            <div className="text-xs font-medium text-destructive mt-2">
              {disabledReason}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="font-bold text-sm">
            Rs. {addon.amount.toLocaleString()}
          </div>
          {addon.billing_type === 'monthly' && (
            <div className="text-[10px] text-muted-foreground mt-[-4px]">
              Manual monthly service fee
            </div>
          )}
          {isAvailable && (
            <div
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full border transition-colors mt-1',
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
