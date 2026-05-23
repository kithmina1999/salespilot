import { BillingAddon } from '@/hooks/useBillingOptions';
import AddonServiceCard from './AddonServiceCard';

interface CheckoutAddonsProps {
  addons: BillingAddon[];
  purchasedAddonKeys: string[];
  selectedAddonKeys: string[];
  onToggleAddon: (addon: BillingAddon) => void;
}

export default function CheckoutAddons({
  addons,
  purchasedAddonKeys,
  selectedAddonKeys,
  onToggleAddon,
}: CheckoutAddonsProps) {
  if (!addons || addons.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-bold tracking-tight">Optional Services</h3>
        <p className="text-sm text-muted-foreground">
          Expert help to get your WhatsApp store up and running faster.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {addons.map((addon) => (
          <AddonServiceCard
            key={addon.key}
            addon={addon}
            isSelected={selectedAddonKeys.includes(addon.key)}
            isPurchased={purchasedAddonKeys.includes(addon.key)}
            onToggle={onToggleAddon}
          />
        ))}
      </div>
    </div>
  );
}
