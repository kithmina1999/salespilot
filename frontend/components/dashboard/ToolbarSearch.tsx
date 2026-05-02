'use client';

import { Search } from 'lucide-react';

interface ToolbarSearchProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  className?: string;
}

export default function ToolbarSearch({
  value,
  onChange,
  label,
  placeholder,
  className = '',
}: ToolbarSearchProps) {
  return (
    <label className={`relative block ${className}`}>
      <span className="sr-only">{label}</span>
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="dash-input w-full pl-9"
      />
    </label>
  );
}
