import { useMemo, useState, useCallback } from 'react';
import { useApp } from '@/contexts/app-context';
import { buildOrgChartLevels, getDepartmentSubtree } from '@/lib/org-chart-utils';
import type { OrgChartNode, OrgChartConfig } from '@/types';
import { LOCKING_STATUSES } from '@/types';

const defaultConfig: OrgChartConfig = {
  rootEmployeeId: null,
  includeHierarchy: ['chairman', 'executive', 'leader', 'department-leader', 'member', 'hr'],
  groupByDepartment: false,
  sortAlphabetically: true,
  maxDepth: 15,
};

/** Exclude terminated/resigned from org chart – only show currently working employees. */
function isActiveEmployee(e: { employmentStatus?: string }): boolean {
  return !LOCKING_STATUSES.includes((e.employmentStatus ?? 'permanent') as 'terminated' | 'resigned');
}

export function useOrgChartData() {
  const { employees, teams, employeeProfiles } = useApp();
  const [config, setConfig] = useState<OrgChartConfig>(defaultConfig);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterSearch, setFilterSearch] = useState('');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [highlightEmployeeId, setHighlightEmployeeId] = useState<string | null>(null);

  const activeEmployees = useMemo(
    () => employees.filter(isActiveEmployee),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    const byHierarchy = config.includeHierarchy.length
      ? activeEmployees.filter((e) => config.includeHierarchy.includes(e.hierarchy))
      : activeEmployees;
    return byHierarchy;
  }, [activeEmployees, config.includeHierarchy]);

  const levels = useMemo(() => {
    return buildOrgChartLevels(filteredEmployees, employeeProfiles, teams, config);
  }, [filteredEmployees, employeeProfiles, teams, config]);

  const toggleExpand = useCallback((employeeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }, []);

  const getDepartmentTree = useCallback(
    (teamId: string): OrgChartNode | null => {
      return getDepartmentSubtree(teamId, activeEmployees, teams, employeeProfiles);
    },
    [activeEmployees, teams, employeeProfiles]
  );

  return {
    levels,
    config,
    setConfig,
    expandedIds,
    toggleExpand,
    getDepartmentTree,
    employees: activeEmployees,
    teams,
    employeeProfiles,
    filterSearch,
    setFilterSearch,
    filterPanelOpen,
    setFilterPanelOpen,
    highlightEmployeeId,
    setHighlightEmployeeId,
  };
}
