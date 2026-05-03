import Link from 'next/link';
import type { ReactNode } from 'react';

interface DashboardEmptyInsightProps {
  icon?: ReactNode;
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  className?: string;
}

export default function DashboardEmptyInsight({
  icon,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  className = '',
}: DashboardEmptyInsightProps) {
  return (
    <div className={`dash-empty ${className}`}>
      {icon}
      <div>
        <p className="dash-empty-title">{title}</p>
        <p className="dash-empty-copy mt-1">{description}</p>
      </div>
      {(primaryHref && primaryLabel) || (secondaryHref && secondaryLabel) ? (
        <div className="flex flex-wrap justify-center gap-3">
          {primaryHref && primaryLabel && (
            <Link href={primaryHref} className="dash-primary-action">
              {primaryLabel}
            </Link>
          )}
          {secondaryHref && secondaryLabel && (
            <Link href={secondaryHref} className="dash-secondary-action">
              {secondaryLabel}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
