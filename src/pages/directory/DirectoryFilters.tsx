import { useState } from 'react';
import { MagnifyingGlass } from 'phosphor-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useApp } from '@/contexts/app-context';
import type { DirectoryFilters as DirectoryFiltersType } from '@/types';
import { HIERARCHY_LABELS } from '@/types';

/** Hierarchy options for filter (one "Department Leader" option; excludes legacy 'leader') */
const HIERARCHY_FILTER_OPTIONS: Array<keyof typeof HIERARCHY_LABELS> = ['chairman', 'executive', 'department-leader', 'member', 'hr'];
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'list' | 'compact';
type SortOption = 'name' | 'department' | 'recent';

interface DirectoryFiltersProps {
  filters: DirectoryFiltersType;
  onFiltersChange: (f: DirectoryFiltersType) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  sort: SortOption;
  onSortChange: (s: SortOption) => void;
  className?: string;
}

export function DirectoryFilters({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  sort,
  onSortChange,
  className,
}: DirectoryFiltersProps) {
  const { teams } = useApp();
  const [searchLocal, setSearchLocal] = useState(filters.search);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFiltersChange({ ...filters, search: searchLocal.trim() });
  };

  return (
    <div className={cn('space-y-4', className)}>
      <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlass
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-foreground/70 pointer-events-none"
            size={20}
            weight="duotone"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search by name, role, department..."
            value={searchLocal}
            onChange={(e) => setSearchLocal(e.target.value)}
            onBlur={() => onFiltersChange({ ...filters, search: searchLocal.trim() })}
            className="pl-10 bg-card/80 border-border/60 backdrop-blur-sm"
          />
        </div>
        <Select
          value={filters.department ?? ''}
          onChange={(e) => onFiltersChange({ ...filters, department: e.target.value || null })}
          className="w-[180px]"
        >
          <option value="">All departments</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select
          value={filters.hierarchy ?? ''}
          onChange={(e) => onFiltersChange({ ...filters, hierarchy: (e.target.value as keyof typeof HIERARCHY_LABELS) || null })}
          className="w-[160px]"
        >
          <option value="">All levels</option>
          {HIERARCHY_FILTER_OPTIONS.map((h) => (
            <option key={h} value={h}>
              {HIERARCHY_LABELS[h]}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => onSortChange(e.target.value as SortOption)} className="w-[160px]">
          <option value="name">Name A–Z</option>
          <option value="department">Department</option>
          <option value="recent">Recently joined</option>
        </Select>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(['grid', 'list', 'compact'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onViewModeChange(mode)}
              className={cn(
                'px-3 py-2 text-sm font-medium capitalize transition-colors',
                viewMode === mode ? 'bg-accent text-accent-foreground' : 'bg-card hover:bg-muted'
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
