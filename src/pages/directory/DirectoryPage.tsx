import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserCircle, ArrowClockwise, Plus, UsersThree } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmployeeDialog } from '@/components/employees/employee-dialog';
import { useApp } from '@/contexts/app-context';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/contexts/toast-context';
import { DirectoryFilters, type GroupByOption } from './DirectoryFilters';
import { DirectoryGrid } from './DirectoryGrid';
import { ProfileEditModal } from './ProfileEditModal';
import type { Employee, DirectoryFilters as DirectoryFiltersType } from '@/types';
import { isDepartmentLeader } from '@/types';
import { cn } from '@/lib/utils';
import { getEmployees, getUserByEmployeeId, deleteEmployee } from '@/lib/storage';

const defaultFilters: DirectoryFiltersType = {
  search: '',
  department: null,
  hierarchy: null,
  location: null,
  skills: [],
};

const hierarchyOrder: Array<{ key: string; label: string; predicate: (e: Employee) => boolean }> = [
  { key: 'chairman', label: 'Chairman', predicate: (e) => e.hierarchy === 'chairman' },
  { key: 'executive', label: 'Executives', predicate: (e) => e.hierarchy === 'executive' },
  { key: 'leaders', label: 'Department Leaders', predicate: (e) => isDepartmentLeader(e.hierarchy) },
  { key: 'member', label: 'Team Members', predicate: (e) => e.hierarchy === 'member' },
  { key: 'hr', label: 'HR Personnel', predicate: (e) => e.hierarchy === 'hr' },
];

type ViewMode = 'grid' | 'list' | 'compact';
type SortOption = 'name' | 'department' | 'recent';

export function DirectoryPage() {
  const navigate = useNavigate();
  const { employees, employeeProfiles, teams, settings, loading, refresh } = useApp();
  const { user, isAdmin } = useUser();
  const { toast } = useToast();
  const [filters, setFilters] = useState<DirectoryFiltersType>(defaultFilters);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sort, setSort] = useState<SortOption>('name');
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const recoveryAttempted = useRef(false);

  const admin = isAdmin();
  const [linkedUsers, setLinkedUsers] = useState<Record<string, { name: string; username: string }>>({});
  const wasHiddenRef = useRef(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null; name: string }>({
    open: false,
    id: null,
    name: '',
  });
  const [deleting, setDeleting] = useState(false);

  const loadLinkedUsers = useMemo(
    () => async () => {
      const usersMap: Record<string, { name: string; username: string }> = {};
      for (const employee of employees) {
        try {
          const userRecord = await getUserByEmployeeId(employee.id);
          if (userRecord) usersMap[employee.id] = { name: userRecord.name, username: userRecord.username };
        } catch {
          /* ignore */
        }
      }
      setLinkedUsers(usersMap);
    },
    [employees]
  );

  useEffect(() => {
    if (loading || employees.length > 0 || recoveryAttempted.current) return;
    recoveryAttempted.current = true;
    getEmployees().then((list) => {
      if (list.length > 0) refresh();
    });
  }, [loading, employees.length, refresh]);

  useEffect(() => {
    if (!admin || employees.length === 0) {
      if (admin && employees.length === 0) setLinkedUsers({});
      return;
    }
    loadLinkedUsers();
  }, [admin, employees, loadLinkedUsers]);

  useEffect(() => {
    if (!admin) return;
    const handleUserEvent = () => {
      loadLinkedUsers();
    };
    const handleEmployeeEvent = () => {
      refresh();
      setTimeout(() => loadLinkedUsers(), 300);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') wasHiddenRef.current = true;
      else if (document.visibilityState === 'visible' && wasHiddenRef.current) {
        wasHiddenRef.current = false;
        loadLinkedUsers();
      }
    };
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') loadLinkedUsers();
    }, 60000);
    window.addEventListener('userCreated', handleUserEvent);
    window.addEventListener('userUpdated', handleUserEvent);
    window.addEventListener('employeeCreated', handleEmployeeEvent);
    window.addEventListener('employeeUpdated', handleEmployeeEvent);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('userCreated', handleUserEvent);
      window.removeEventListener('userUpdated', handleUserEvent);
      window.removeEventListener('employeeCreated', handleEmployeeEvent);
      window.removeEventListener('employeeUpdated', handleEmployeeEvent);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(pollInterval);
    };
  }, [admin, refresh, loadLinkedUsers]);

  const filteredForSections = useMemo(() => {
    let list = employees.slice();
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
    if (filters.department) list = list.filter((e) => e.teamId === filters.department);
    if (filters.hierarchy) {
      list = list.filter((e) =>
        filters.hierarchy === 'department-leader' ? isDepartmentLeader(e.hierarchy) : e.hierarchy === filters.hierarchy
      );
    }
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'department') {
      list.sort((a, b) => {
        const ta = a.teamId ? teams.find((t) => t.id === a.teamId)?.name ?? '' : '';
        const tb = b.teamId ? teams.find((t) => t.id === b.teamId)?.name ?? '' : '';
        return ta.localeCompare(tb) || a.name.localeCompare(b.name);
      });
    } else if (sort === 'recent') {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list;
  }, [employees, teams, filters, sort, employeeProfiles]);

  const groups = useMemo(() => {
    if (groupBy === 'none') return null;
    if (groupBy === 'hierarchy') {
      return hierarchyOrder
        .map(({ key, label, predicate }) => ({
          key,
          label,
          employees: filteredForSections.filter(predicate),
        }))
        .filter((g) => g.employees.length > 0);
    }
    if (groupBy === 'department') {
      const byTeam = new Map<string | 'none', Employee[]>();
      for (const e of filteredForSections) {
        const tid = e.teamId ?? 'none';
        if (!byTeam.has(tid)) byTeam.set(tid, []);
        byTeam.get(tid)!.push(e);
      }
      const result: Array<{ key: string; label: string; employees: Employee[] }> = [];
      for (const team of teams) {
        const list = byTeam.get(team.id);
        if (list?.length) result.push({ key: team.id, label: team.name, employees: list });
      }
      const noDept = byTeam.get('none');
      if (noDept?.length) result.push({ key: 'none', label: 'No department', employees: noDept });
      return result;
    }
    if (groupBy === 'flat') {
      const sorted = [...filteredForSections].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      return sorted.length ? [{ key: 'all', label: 'All employees', employees: sorted }] : [];
    }
    return null;
  }, [groupBy, filteredForSections, teams]);

  const handleRefresh = async () => {
    await refresh();
    if (admin) loadLinkedUsers();
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirm({ open: true, id, name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    setDeleting(true);
    try {
      await deleteEmployee(deleteConfirm.id);
      await refresh();
      if (admin) loadLinkedUsers();
      toast({ title: 'Success', description: 'Employee deleted successfully', variant: 'success' });
      setDeleteConfirm({ open: false, id: null, name: '' });
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: 'Error', description: 'Failed to delete employee. Please try again.', variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const onEditRecord = (employee: Employee) => {
    setEditingEmployeeId(employee.id);
    setDialogOpen(true);
  };

  const onDialogSuccess = () => {
    refresh();
    setTimeout(() => loadLinkedUsers(), 500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <p className="text-muted-foreground text-sm font-medium">Loading directory…</p>
      </div>
    );
  }

  const showSectioned = admin && groupBy !== 'none' && groups && groups.length > 0;
  const empty = employees.length === 0;
  const emptyFiltered = !empty && filteredForSections.length === 0;

  return (
    <div className="space-y-6 pb-8 sm:pb-10 lg:pb-12 min-w-0 w-full max-w-full">
      <header
        className={cn(
          'relative rounded-2xl overflow-hidden px-4 py-6 sm:px-6 sm:py-10',
          'bg-gradient-to-br from-accent/15 via-accent/5 to-transparent',
          'border border-border/60'
        )}
      >
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {admin ? 'Employees' : settings.name || 'Our People'}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              {admin ? 'Manage your employee database' : 'Meet the team'}
            </p>
            <div className="flex items-center gap-4 mt-3 sm:mt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm sm:text-base">
                <Users size={20} weight="duotone" className="sm:w-6 sm:h-6 shrink-0" />
                <span className="text-xl sm:text-2xl font-semibold text-foreground">{employees.length}</span>
                <span>people</span>
              </div>
            </div>
          </div>
          {admin && (
            <div className="flex flex-wrap gap-3 shrink-0">
              <Button type="button" onClick={handleRefresh} variant="outline" size="lg" aria-label="Refresh employees and linked users">
                <ArrowClockwise size={20} weight="duotone" className="mr-2" />
                Refresh
              </Button>
              <Button
                type="button"
                onClick={() => { setEditingEmployeeId(null); setDialogOpen(true); }}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transition-all"
                size="lg"
                aria-label="Add Employee"
              >
                <Plus size={20} weight="duotone" className="mr-2" />
                Add Employee
              </Button>
            </div>
          )}
        </div>
      </header>

      <section className="min-w-0 w-full">
        <DirectoryFilters
          filters={filters}
          onFiltersChange={setFilters}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sort={sort}
          onSortChange={setSort}
          showGroupBy={admin}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
        />
      </section>

      <section className="min-w-0 w-full">
        {empty ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
            <UserCircle size={48} weight="duotone" className="mx-auto text-muted-foreground" />
            <p className="text-muted-foreground mt-4">
              {admin ? 'No employees yet.' : 'No employees in the directory yet.'}
            </p>
            {admin && (
              <Button className="mt-4" onClick={() => { setEditingEmployeeId(null); setDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            )}
          </div>
        ) : emptyFiltered ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
            <p className="text-muted-foreground">No employees match the current filters.</p>
          </div>
        ) : showSectioned ? (
          <div className="space-y-8 min-w-0">
            {groups!.map((group) => (
              <div key={group.key} className="min-w-0">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <UsersThree size={20} weight="duotone" className="text-muted-foreground" />
                  {group.label}
                  <span className="text-sm font-normal text-muted-foreground">({group.employees.length})</span>
                </h2>
                <DirectoryGrid
                  filters={filters}
                  viewMode={viewMode}
                  sort={sort}
                  employeeProfiles={employeeProfiles}
                  onCardClick={(emp) => navigate(`/profile/${emp.id}`)}
                  onEditClick={(emp) => { if (user?.employeeId === emp.id || admin) setEditEmployee(emp); }}
                  employeesOverride={group.employees}
                  showAdminActions={true}
                  linkedUsers={linkedUsers}
                  onEditRecord={onEditRecord}
                  onDelete={handleDeleteClick}
                />
              </div>
            ))}
          </div>
        ) : (
          <DirectoryGrid
            filters={filters}
            viewMode={viewMode}
            sort={sort}
            employeeProfiles={employeeProfiles}
            onCardClick={(emp) => navigate(`/profile/${emp.id}`)}
            onEditClick={(emp) => { if (user?.employeeId === emp.id || admin) setEditEmployee(emp); }}
            showAdminActions={admin}
            linkedUsers={admin ? linkedUsers : undefined}
            onEditRecord={admin ? onEditRecord : undefined}
            onDelete={admin ? handleDeleteClick : undefined}
          />
        )}
      </section>

      {editEmployee && (user?.employeeId === editEmployee.id || admin) && (
        <ProfileEditModal
          employee={editEmployee}
          onClose={() => setEditEmployee(null)}
          onSaved={() => setEditEmployee(null)}
        />
      )}

      {admin && (
        <>
          <ConfirmDialog
            open={deleteConfirm.open}
            onClose={() => setDeleteConfirm({ open: false, id: null, name: '' })}
            onConfirm={handleDeleteConfirm}
            title="Delete Employee"
            description={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone and will remove all associated data.`}
            confirmText="Delete Employee"
            cancelText="Cancel"
            variant="danger"
            loading={deleting}
          />
          <EmployeeDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            employeeId={editingEmployeeId}
            onSuccess={onDialogSuccess}
          />
        </>
      )}
    </div>
  );
}
