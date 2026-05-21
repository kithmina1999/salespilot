'use client';

import type { ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export default function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="dash-label normal-case tracking-normal text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1 rounded-xl border border-border bg-muted p-1" role="group" aria-label={label}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                active
                  ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300 shadow-sm'
                  : 'border-transparent text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground'
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
