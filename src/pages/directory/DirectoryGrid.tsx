import { useMemo } from 'react';
import { ProfileCard } from './ProfileCard';
import type { Employee, EmployeeProfile, DirectoryFilters } from '@/types';
import { isDepartmentLeader, LOCKING_STATUSES } from '@/types';
import { useApp } from '@/contexts/app-context';

type ViewMode = 'grid' | 'list' | 'compact';
type SortOption = 'name' | 'department' | 'recent';

interface DirectoryGridProps {
  filters: DirectoryFilters;
  viewMode: ViewMode;
  sort: SortOption;
  employeeProfiles: EmployeeProfile[];
  onCardClick: (employee: Employee) => void;
  onEditClick: (employee: Employee) => void;
  showAdminActions?: boolean;
  linkedUsers?: Record<string, { name: string; username: string }>;
  onEditRecord?: (employee: Employee) => void;
  onDelete?: (id: string, name: string) => void;
  /** When provided, show only these employees (no internal filter/sort). Used for sectioned layout. */
  employeesOverride?: Employee[];
}

export function DirectoryGrid({
  filters,
  viewMode,
  sort,
  employeeProfiles,
  onCardClick,
  onEditClick,
  showAdminActions,
  linkedUsers,
  onEditRecord,
  onDelete,
  employeesOverride,
}: DirectoryGridProps) {
  const { employees, teams } = useApp();

  const filteredAndSorted = useMemo(() => {
    if (employeesOverride != null) return employeesOverride;
    const employmentFilter = filters.employmentStatus ?? 'active';
    let list =
      employmentFilter === 'all'
        ? employees.slice()
        : employees.filter((e) => !LOCKING_STATUSES.includes((e.employmentStatus ?? 'permanent') as 'terminated' | 'resigned'));
    const search = filters.search.toLowerCase().trim();
    if (search) {
      const teamNames = new Map(teams.map((t) => [t.id, t.name.toLowerCase()]));
      list = list.filter((e) => {
        if (e.name.toLowerCase().includes(search)) return true;
        if (e.role.toLowerCase().includes(search)) return true;
        if (e.email?.toLowerCase().includes(search)) return true;
        if (e.teamId && teamNames.get(e.teamId)?.includes(search)) return true;
        const profile = employeeProfiles.find((p) => p.employeeId === e.id);
        if (profile?.location?.toLowerCase().includes(search)) return true;
        if (profile?.skills?.some((s) => s.toLowerCase().includes(search))) return true;
        return false;
      });
    }
    if (filters.department) {
      list = list.filter((e) => e.teamId === filters.department);
    }
    if (filters.hierarchy) {
      list = list.filter((e) =>
        filters.hierarchy === 'department-leader' ? isDepartmentLeader(e.hierarchy) : e.hierarchy === filters.hierarchy
      );
    }
    if (sort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'department') {
      list.sort((a, b) => {
        const ta = a.teamId ? teams.find((t) => t.id === a.teamId)?.name ?? '' : '';
        const tb = b.teamId ? teams.find((t) => t.id === b.teamId)?.name ?? '' : '';
        return ta.localeCompare(tb) || a.name.localeCompare(b.name);
      });
    } else if (sort === 'recent') {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list;
  }, [employees, teams, filters, sort, employeeProfiles, employeesOverride]);

  const getProfile = (employeeId: string) => employeeProfiles.find((p) => p.employeeId === employeeId) ?? null;
  const getLinkedUser = (employeeId: string) => (linkedUsers && linkedUsers[employeeId]) ?? null;

  const commonCardProps = (employee: Employee) => ({
    employee,
    profile: getProfile(employee.id),
    onClick: () => onCardClick(employee),
    onEdit: () => onEditClick(employee),
    showAdminActions,
    linkedUser: showAdminActions ? getLinkedUser(employee.id) : undefined,
    onEditRecord: showAdminActions && onEditRecord ? () => onEditRecord(employee) : undefined,
    onDelete: showAdminActions && onDelete ? () => onDelete(employee.id, employee.name) : undefined,
  });

  if (viewMode === 'list') {
    return (
      <div className="directory-grid-cards space-y-3">
        {filteredAndSorted.map((employee, i) => (
          <ProfileCard key={employee.id} variant="list" index={i} {...commonCardProps(employee)} />
        ))}
      </div>
    );
  }

  if (viewMode === 'compact') {
    return (
      <div className="directory-grid-cards grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 min-w-0 w-full">
        {filteredAndSorted.map((employee, i) => (
          <ProfileCard key={employee.id} variant="compact" index={i} {...commonCardProps(employee)} />
        ))}
      </div>
    );
  }

  return (
    <div className="directory-grid-cards grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 min-w-0 w-full items-start content-start">
      {filteredAndSorted.map((employee, i) => (
        <ProfileCard key={employee.id} variant="grid" index={i} {...commonCardProps(employee)} />
      ))}
    </div>
  );
}
