import { X } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/app-context';
import type { OrgChartConfig } from '@/types';
import { HIERARCHY_LABELS } from '@/types';
import { cn } from '@/lib/utils';

const HIERARCHY_OPTIONS: Array<keyof typeof HIERARCHY_LABELS> = [
  'chairman',
  'executive',
  'department-leader',
  'member',
  'hr',
];

interface OrgChartFilterPanelProps {
  config: OrgChartConfig;
  setConfig: (c: OrgChartConfig) => void;
  onClose: () => void;
}

export function OrgChartFilterPanel({ config, setConfig, onClose }: OrgChartFilterPanelProps) {
  const { teams } = useApp();

  const toggleHierarchy = (h: (typeof HIERARCHY_OPTIONS)[number]) => {
    const toAdd = h === 'department-leader' ? ['leader', 'department-leader'] : [h];
    const toRemove = h === 'department-leader' ? ['leader', 'department-leader'] : [h];
    const currentlyIncluded = h === 'department-leader'
      ? config.includeHierarchy.some((x) => x === 'leader' || x === 'department-leader')
      : config.includeHierarchy.includes(h);
    const next = currentlyIncluded
      ? config.includeHierarchy.filter((x) => !toRemove.includes(x))
      : [...config.includeHierarchy, ...toAdd];
    setConfig({ ...config, includeHierarchy: next });
  };

  const isChecked = (h: (typeof HIERARCHY_OPTIONS)[number]) => {
    if (h === 'department-leader')
      return config.includeHierarchy.some((x) => x === 'leader' || x === 'department-leader');
    return config.includeHierarchy.includes(h);
  };

  const resetFilters = () => {
    setConfig({
      ...config,
      includeHierarchy: ['chairman', 'executive', 'leader', 'department-leader', 'member', 'hr'],
      groupByDepartment: false,
      sortAlphabetically: true,
    });
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 max-w-[90vw] border-l border-border bg-card shadow-xl flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Filter organization</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="Close filters"
        >
          <X size={20} weight="bold" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Hierarchy level</h3>
          <div className="space-y-2">
            {HIERARCHY_OPTIONS.map((h) => (
              <label key={h} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isChecked(h)}
                  onChange={() => toggleHierarchy(h)}
                  className="rounded border-border"
                />
                <span className="text-sm text-foreground">{HIERARCHY_LABELS[h]}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Layout</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.groupByDepartment}
                onChange={(e) => setConfig({ ...config, groupByDepartment: e.target.checked })}
                className="rounded border-border"
                aria-label="Group by department"
              />
              <span className="text-sm text-foreground">Group by department</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.sortAlphabetically !== false}
                onChange={(e) => setConfig({ ...config, sortAlphabetically: e.target.checked })}
                className="rounded border-border"
                aria-label="Sort by name A-Z within each level"
              />
              <span className="text-sm text-foreground">Sort by name (A–Z) within each level</span>
            </label>
          </div>
        </div>
        {teams.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Departments</h3>
            <p className="text-xs text-muted-foreground mb-2">
              Filter by hierarchy above. Departments shown in &quot;By department&quot; view.
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {teams.map((t) => (
                <li key={t.id}>{t.name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-border flex gap-2">
        <Button variant="outline" size="sm" onClick={resetFilters} className="flex-1">
          Reset
        </Button>
        <Button size="sm" onClick={onClose} className="flex-1">
          Done
        </Button>
      </div>
    </div>
  );
}
