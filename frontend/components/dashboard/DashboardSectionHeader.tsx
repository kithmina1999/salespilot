import type { ReactNode } from 'react';

interface DashboardSectionHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export default function DashboardSectionHeader({
  title,
  description,
  actions,
  className = '',
}: DashboardSectionHeaderProps) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div>
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {description && <p className="dash-muted mt-0.5">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
