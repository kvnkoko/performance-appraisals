import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TreeStructure, SquaresFour, Funnel } from 'phosphor-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useOrgChartData } from '@/hooks/use-org-chart-data';
import { OrgChartTree } from './OrgChartTree';
import { OrgChartControls } from './OrgChartControls';
import { OrgChartFilterPanel } from './OrgChartFilterPanel';
import { DepartmentView } from './DepartmentView';
import { ProfileEditModal } from '@/pages/directory/ProfileEditModal';
import { useApp } from '@/contexts/app-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Employee } from '@/types';
import { cn } from '@/lib/utils';

type ViewMode = 'tree' | 'department';

export function OrgChartPage() {
  const navigate = useNavigate();
  const { employees, loading } = useApp();
  const {
    levels,
    config,
    setConfig,
    filterSearch,
    setFilterSearch,
    filterPanelOpen,
    setFilterPanelOpen,
    highlightEmployeeId,
    employees: activeEmployees,
  } = useOrgChartData();
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const zoomApiRef = useRef<{ zoomIn: () => void; zoomOut: () => void; resetTransform: () => void } | null>(null);

  const searchMatchIds = useMemo(() => {
    if (!filterSearch.trim()) return undefined;
    const q = filterSearch.toLowerCase().trim();
    const ids = activeEmployees
      .filter((e) => e.name.toLowerCase().includes(q) || e.role?.toLowerCase().includes(q))
      .map((e) => e.id);
    return ids.length > 0 ? new Set(ids) : undefined;
  }, [activeEmployees, filterSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <p className="text-muted-foreground text-sm font-medium">Loading org chart…</p>
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
        <TreeStructure size={48} weight="duotone" className="mx-auto text-muted-foreground" />
        <p className="text-muted-foreground mt-4">No employees to display. Add employees and set Reports To to build the chart.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full max-w-full gap-6">
      <header className="flex-shrink-0 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Organization chart</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Company structure and reporting lines</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Find employee..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="w-44 h-9 bg-card"
            aria-label="Search organization chart by employee name or role"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterPanelOpen((x) => !x)}
            className="gap-1"
            aria-label="Open organization chart filters"
            aria-expanded={filterPanelOpen}
          >
            <Funnel size={16} weight="duotone" />
            Filters
          </Button>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('tree')}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors',
                viewMode === 'tree' ? 'bg-accent text-accent-foreground' : 'bg-card hover:bg-muted'
              )}
            >
              <TreeStructure size={18} weight="duotone" /> Tree
            </button>
            <button
              type="button"
              onClick={() => setViewMode('department')}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors',
                viewMode === 'department' ? 'bg-accent text-accent-foreground' : 'bg-card hover:bg-muted'
              )}
            >
              <SquaresFour size={18} weight="duotone" /> By department
            </button>
          </div>
          {viewMode === 'tree' && (
            <OrgChartControls
              onResetView={() => zoomApiRef.current?.resetTransform()}
              onZoomIn={() => zoomApiRef.current?.zoomIn()}
              onZoomOut={() => zoomApiRef.current?.zoomOut()}
            />
          )}
        </div>
      </header>

      {filterPanelOpen && (
        <OrgChartFilterPanel config={config} setConfig={setConfig} onClose={() => setFilterPanelOpen(false)} />
      )}

      <div
        className={cn(
          'rounded-xl border border-border bg-card/80 overflow-hidden flex-shrink-0',
          viewMode === 'tree'
            ? 'min-h-[360px] flex-1'
            : 'min-h-[280px]'
        )}
      >
        {viewMode === 'tree' ? (
          <TransformWrapper
            initialScale={1}
            minScale={0.3}
            maxScale={2}
            centerOnInit
            panning={{ allowLeftClickPan: true }}
            ref={(ref) => {
              if (!ref) {
                zoomApiRef.current = null;
                return;
              }
              if (typeof ref === 'object' && 'zoomIn' in ref) {
                const r = ref as { zoomIn: () => void; zoomOut: () => void; resetTransform: () => void };
                zoomApiRef.current = {
                  zoomIn: () => r.zoomIn(),
                  zoomOut: () => r.zoomOut(),
                  resetTransform: () => r.resetTransform(),
                };
              }
            }}
          >
            <TransformComponent wrapperClass="!w-full !h-full !min-h-[360px]" contentClass="!w-full !min-h-0">
              <div className="px-6 pt-6 pb-4 w-full flex items-start justify-center">
                {levels.some((level) => level.length > 0) ? (
                  <OrgChartTree
                    levels={levels}
                    showDepartmentLabels={config.groupByDepartment}
                    onSelectEmployee={(emp) => navigate(`/profile/${emp.id}`)}
                    highlightEmployeeId={highlightEmployeeId ?? undefined}
                    searchMatchIds={searchMatchIds}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center max-w-md">
                    <TreeStructure size={48} weight="duotone" className="text-muted-foreground mb-4" />
                    <p className="text-muted-foreground font-medium">No hierarchy levels found</p>
                    <p className="text-muted-foreground text-sm mt-1">Set employee hierarchy (e.g. Chairman, Executive, Department Leader, Member) to build the chart.</p>
                  </div>
                )}
              </div>
            </TransformComponent>
          </TransformWrapper>
        ) : (
          <div className="px-6 pt-6 pb-4">
            <DepartmentView onSelectEmployee={(emp) => navigate(`/profile/${emp.id}`)} />
          </div>
        )}
      </div>

      {editEmployee && (
        <ProfileEditModal
          employee={editEmployee}
          onClose={() => setEditEmployee(null)}
          onSaved={() => setEditEmployee(null)}
        />
      )}
    </div>
  );
}
