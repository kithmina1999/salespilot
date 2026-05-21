import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface BillingPageHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
}

export default function BillingPageHeader({
  icon: Icon,
  title,
  description,
  actions,
}: BillingPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-foreground">
          <Icon className="h-8 w-8 text-emerald-400" />
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
