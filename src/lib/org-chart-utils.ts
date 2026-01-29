import type { Employee, EmployeeProfile, Team, OrgChartNode, OrgChartConfig } from '@/types';
import { isDepartmentLeader } from '@/types';

const VALID_HIERARCHIES: Employee['hierarchy'][] = ['chairman', 'executive', 'leader', 'department-leader', 'member', 'hr'];
function normalizeHierarchy(h: string | null | undefined): Employee['hierarchy'] {
  if (h && VALID_HIERARCHIES.includes(h as Employee['hierarchy'])) return h as Employee['hierarchy'];
  return 'member';
}

/** Hierarchy order: chairman → executive → department-leader → member/hr */
function getHierarchyLevel(h: Employee['hierarchy']): number {
  if (h === 'chairman') return 0;
  if (h === 'executive') return 1;
  if (isDepartmentLeader(h)) return 2;
  return 3; // member, hr
}

/** Get children by hierarchy only. Chairman → executives; executive → department leaders; leader → members (+ hr). */
function getChildrenByHierarchy(parent: Employee, employees: Employee[]): Employee[] {
  const level = getHierarchyLevel(parent.hierarchy);
  if (level >= 3) return [];
  if (parent.hierarchy === 'chairman') return employees.filter((e) => e.hierarchy === 'executive');
  if (parent.hierarchy === 'executive') return employees.filter((e) => isDepartmentLeader(e.hierarchy));
  if (isDepartmentLeader(parent.hierarchy)) return employees.filter((e) => e.hierarchy === 'member' || e.hierarchy === 'hr');
  return [];
}

export function getDirectReports(employeeId: string, employees: Employee[]): Employee[] {
  return employees.filter((e) => e.reportsTo === employeeId);
}

const MAX_CHAIN_DEPTH = 50;

export function getReportingChain(employeeId: string, employees: Employee[]): Employee[] {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const chain: Employee[] = [];
  const visited = new Set<string>();
  let current = byId.get(employeeId);
  let depth = 0;
  while (current?.reportsTo && depth < MAX_CHAIN_DEPTH) {
    const nextId = current.reportsTo;
    if (visited.has(nextId)) break;
    visited.add(nextId);
    const manager = byId.get(nextId);
    if (!manager) break;
    chain.push(manager);
    current = manager;
    depth++;
  }
  return chain;
}

/** Get the department leader's employee ID for a team (first leader/executive/HR with this teamId). */
export function getDepartmentLeaderId(teamId: string, employees: Employee[]): string | undefined {
  const leader = employees.find(
    (e) =>
      e.teamId === teamId &&
      (e.hierarchy === 'leader' || e.hierarchy === 'department-leader' || e.hierarchy === 'executive' || e.hierarchy === 'hr')
  );
  return leader?.id;
}

function buildHierarchyNode(
  employee: Employee,
  employees: Employee[],
  profiles: EmployeeProfile[],
  teams: Team[],
  visited: Set<string>,
  depth: number
): OrgChartNode {
  if (visited.has(employee.id)) {
    return { employee, children: [], team: employee.teamId ? teams.find((t) => t.id === employee.teamId) : undefined, isExpanded: true };
  }
  visited.add(employee.id);
  const profile = profiles.find((p) => p.employeeId === employee.id);
  const team = employee.teamId ? teams.find((t) => t.id === employee.teamId) : undefined;
  const childEmployees = getChildrenByHierarchy(employee, employees);
  const children = childEmployees.map((c) => buildHierarchyNode(c, employees, profiles, teams, visited, depth + 1));
  return {
    employee,
    profile,
    children,
    team,
    isExpanded: depth < 2,
  };
}

export function getDepartmentSubtree(
  teamId: string,
  employees: Employee[],
  teams: Team[],
  profiles: EmployeeProfile[]
): OrgChartNode | null {
  const team = teams.find((t) => t.id === teamId);
  if (!team) return null;
  const inTeam = employees.filter((e) => e.teamId === teamId);
  if (inTeam.length === 0) return null;
  const allowed = new Set<Employee['hierarchy']>(['chairman', 'executive', 'leader', 'department-leader', 'member', 'hr']);
  const filtered = inTeam.filter((e) => allowed.has(e.hierarchy));
  const chairmen = filtered.filter((e) => e.hierarchy === 'chairman');
  const executives = filtered.filter((e) => e.hierarchy === 'executive');
  const leaders = filtered.filter((e) => isDepartmentLeader(e.hierarchy));
  const roots = chairmen.length > 0 ? chairmen : executives.length > 0 ? executives : leaders.slice(0, 1);
  if (roots.length === 0) {
    const first = filtered[0];
    return buildHierarchyNode(first, filtered, profiles, teams, new Set(), 0);
  }
  const visited = new Set<string>();
  const firstRoot = roots[0];
  return buildHierarchyNode(firstRoot, filtered, profiles, teams, visited, 0);
}

/** Build org chart as four levels (rows): chairman, executives, department heads, members/hr. No parent-child nesting. */
export function buildOrgChartLevels(
  employees: Employee[],
  profiles: EmployeeProfile[],
  teams: Team[],
  config: OrgChartConfig
): OrgChartNode[][] {
  const allowed = new Set(config.includeHierarchy);
  const normalized = employees.map((e) => ({ ...e, hierarchy: normalizeHierarchy(e.hierarchy) }));
  const filtered = normalized.filter((e) => allowed.has(e.hierarchy));

  function toNode(employee: Employee): OrgChartNode {
    const profile = profiles.find((p) => p.employeeId === employee.id);
    const team = employee.teamId ? teams.find((t) => t.id === employee.teamId) : undefined;
    return { employee, profile, team, children: [] };
  }

  const level0 = filtered.filter((e) => e.hierarchy === 'chairman').map(toNode);
  const level1 = filtered.filter((e) => e.hierarchy === 'executive').map(toNode);
  const level2 = filtered.filter((e) => isDepartmentLeader(e.hierarchy)).map(toNode);
  const level3 = filtered.filter((e) => e.hierarchy === 'member' || e.hierarchy === 'hr').map(toNode);

  const sortLevel = (nodes: OrgChartNode[]) => {
    if (config.groupByDepartment) {
      return [...nodes].sort((a, b) => {
        const teamA = a.team?.name ?? '';
        const teamB = b.team?.name ?? '';
        if (teamA !== teamB) return teamA.localeCompare(teamB, undefined, { sensitivity: 'base' });
        return a.employee.name.localeCompare(b.employee.name, undefined, { sensitivity: 'base' });
      });
    }
    if (config.sortAlphabetically !== false) {
      return [...nodes].sort((a, b) =>
        a.employee.name.localeCompare(b.employee.name, undefined, { sensitivity: 'base' })
      );
    }
    return nodes;
  };

  return [
    sortLevel(level0),
    sortLevel(level1),
    sortLevel(level2),
    sortLevel(level3),
  ];
}

/** Flatten a tree (single root) into levels for level-based rendering. Used by DepartmentView. */
export function treeToLevels(root: OrgChartNode): OrgChartNode[][] {
  const levels: OrgChartNode[][] = [];
  function traverse(n: OrgChartNode, depth: number) {
    if (!levels[depth]) levels[depth] = [];
    levels[depth].push({ employee: n.employee, profile: n.profile, team: n.team, children: [] });
    n.children.forEach((c) => traverse(c, depth + 1));
  }
  traverse(root, 0);
  return levels;
}

export function buildOrgChartTree(
  employees: Employee[],
  profiles: EmployeeProfile[],
  teams: Team[],
  config: OrgChartConfig
): OrgChartNode[] {
  const { rootEmployeeId, includeHierarchy, maxDepth = 20 } = config;
  const allowed = new Set(includeHierarchy);
  const normalized = employees.map((e) => ({ ...e, hierarchy: normalizeHierarchy(e.hierarchy) }));
  const filtered = normalized.filter((e) => allowed.has(e.hierarchy));
  const byId = new Map(filtered.map((e) => [e.id, e]));

  let roots: Employee[] = [];

  if (rootEmployeeId) {
    const root = byId.get(rootEmployeeId);
    if (root) roots = [root];
  } else {
    const chairmen = filtered.filter((e) => e.hierarchy === 'chairman');
    const executives = filtered.filter((e) => e.hierarchy === 'executive');
    const deptLeaders = filtered.filter((e) => isDepartmentLeader(e.hierarchy));
    const membersOrHr = filtered.filter((e) => e.hierarchy === 'member' || e.hierarchy === 'hr');
    const firstChairman = chairmen.length > 0 ? chairmen[0] : undefined;
    const firstExecutive = executives.length > 0 ? executives[0] : undefined;
    const firstDeptLeader = deptLeaders.length > 0 ? deptLeaders[0] : undefined;
    const firstMemberOrHr = membersOrHr.length > 0 ? membersOrHr[0] : undefined;
    const singleRoot = firstChairman ?? firstExecutive ?? firstDeptLeader ?? firstMemberOrHr ?? filtered[0];
    if (singleRoot) roots = [singleRoot];
  }

  const visited = new Set<string>();
  function build(n: Employee, depth: number): OrgChartNode {
    if (depth >= maxDepth) return { employee: n, children: [], isExpanded: false };
    visited.add(n.id);
    const profile = profiles.find((p) => p.employeeId === n.id);
    const team = n.teamId ? teams.find((t) => t.id === n.teamId) : undefined;
    const childEmployees = getChildrenByHierarchy(n, filtered).filter((e) => !visited.has(e.id));
    const children = childEmployees.map((c) => {
      visited.add(c.id);
      return build(c, depth + 1);
    });
    return {
      employee: n,
      profile,
      children,
      team,
      isExpanded: depth < 2,
    };
  }

  return roots.map((r) => build(r, 0));
}
