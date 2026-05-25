'use client';
import type { RuleEntry } from '@/hooks/useRulesPage';

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string;
  customRules: RuleEntry[];
  onSelect: (cat: string) => void;
}

export function CategoryFilter({
  categories,
  selectedCategory,
  customRules,
  onSelect,
}: CategoryFilterProps) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const count =
            cat === 'All'
              ? customRules.length
              : customRules.filter((r) => (r.category || 'General') === cat).length;

          return (
            <button
              key={cat}
              onClick={() => onSelect(cat)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedCategory === cat
                  ? 'bg-secondary text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>{cat}</span>
              <span className="text-xs bg-background border border-border px-2 py-0.5 rounded-full text-muted-foreground">
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
