import { useState } from 'react';
import { MagnifyingGlass, UsersThree, Buildings, List } from 'phosphor-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useApp } from '@/contexts/app-context';
import type { DirectoryFilters as DirectoryFiltersType } from '@/types';
import { HIERARCHY_LABELS } from '@/types';
import { cn } from '@/lib/utils';

/** Hierarchy options for filter (one "Department Leader" option; excludes legacy 'leader') */
const HIERARCHY_FILTER_OPTIONS: Array<keyof typeof HIERARCHY_LABELS> = ['chairman', 'executive', 'department-leader', 'member', 'hr'];

type ViewMode = 'grid' | 'list' | 'compact';
type SortOption = 'name' | 'department' | 'recent';
export type GroupByOption = 'none' | 'hierarchy' | 'department' | 'flat';

interface DirectoryFiltersProps {
  filters: DirectoryFiltersType;
  onFiltersChange: (f: DirectoryFiltersType) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  sort: SortOption;
  onSortChange: (s: SortOption) => void;
  className?: string;
  showGroupBy?: boolean;
  groupBy?: GroupByOption;
  onGroupByChange?: (g: GroupByOption) => void;
}

export function DirectoryFilters({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  sort,
  onSortChange,
  className,
  showGroupBy,
  groupBy = 'none',
  onGroupByChange,
}: DirectoryFiltersProps) {
  const { teams } = useApp();
  const [searchLocal, setSearchLocal] = useState(filters.search);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFiltersChange({ ...filters, search: searchLocal.trim() });
  };

  return (
    <div className={cn('space-y-4', className)}>
      <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-stretch gap-3">
        <div className="relative flex-1 w-full min-w-0 sm:min-w-[200px]">
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
          className="w-full sm:w-[180px] min-w-0"
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
          className="w-full sm:w-[160px] min-w-0"
        >
          <option value="">All levels</option>
          {HIERARCHY_FILTER_OPTIONS.map((h) => (
            <option key={h} value={h}>
              {HIERARCHY_LABELS[h]}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => onSortChange(e.target.value as SortOption)} className="w-full sm:w-[160px] min-w-0">
          <option value="name">Name A–Z</option>
          <option value="department">Department</option>
          <option value="recent">Recently joined</option>
        </Select>
        <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
          {(['grid', 'list', 'compact'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onViewModeChange(mode)}
              className={cn(
                'flex-1 sm:flex-none px-3 py-2.5 sm:py-2 text-sm font-medium capitalize transition-colors min-h-[44px] sm:min-h-0 touch-manipulation',
                viewMode === mode ? 'bg-accent text-accent-foreground' : 'bg-card hover:bg-muted active:bg-muted'
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </form>
      {showGroupBy && onGroupByChange && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Group by">
          <span className="text-sm font-medium text-muted-foreground shrink-0">Group by:</span>
          <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => onGroupByChange('none')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
                groupBy === 'none' ? 'bg-accent text-accent-foreground' : 'bg-card hover:bg-muted text-muted-foreground'
              )}
              aria-pressed={groupBy === 'none'}
            >
              None
            </button>
            <button
              type="button"
              onClick={() => onGroupByChange('hierarchy')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-border',
                groupBy === 'hierarchy' ? 'bg-accent text-accent-foreground' : 'bg-card hover:bg-muted text-muted-foreground'
              )}
              aria-pressed={groupBy === 'hierarchy'}
              title="Group by hierarchy"
            >
              <UsersThree size={16} weight="duotone" />
              Hierarchy
            </button>
            <button
              type="button"
              onClick={() => onGroupByChange('department')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-border',
                groupBy === 'department' ? 'bg-accent text-accent-foreground' : 'bg-card hover:bg-muted text-muted-foreground'
              )}
              aria-pressed={groupBy === 'department'}
              title="Group by department"
            >
              <Buildings size={16} weight="duotone" />
              Department
            </button>
            <button
              type="button"
              onClick={() => onGroupByChange('flat')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-border',
                groupBy === 'flat' ? 'bg-accent text-accent-foreground' : 'bg-card hover:bg-muted text-muted-foreground'
              )}
              aria-pressed={groupBy === 'flat'}
              title="A–Z"
            >
              <List size={16} weight="duotone" />
              A–Z
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
