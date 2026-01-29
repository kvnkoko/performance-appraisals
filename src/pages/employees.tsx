import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Plus, Pencil, Trash, Users, MagnifyingGlass, UsersThree, CheckCircle, ArrowClockwise, List, Buildings } from 'phosphor-react';
import { EmployeeDialog } from '@/components/employees/employee-dialog';
import { HIERARCHY_LABELS, EMPLOYMENT_STATUS_LABELS, isDepartmentLeader } from '@/types';
import type { EmploymentStatus } from '@/types';
import { deleteEmployee, getUserByEmployeeId } from '@/lib/storage';
import { useToast } from '@/contexts/toast-context';
import { formatDate } from '@/lib/utils';

export function EmployeesPage() {
  const { employees, teams, refresh } = useApp();
  const [linkedUsers, setLinkedUsers] = useState<Record<string, { name: string; username: string }>>({});
  const wasHiddenRef = useRef(false);
  
  // Helper to get team name
  const getTeamName = (teamId?: string) => {
    if (!teamId) return null;
    const team = teams.find(t => t.id === teamId);
    return team?.name;
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  type GroupBy = 'hierarchy' | 'department' | 'flat';
  const [groupBy, setGroupBy] = useState<GroupBy>('hierarchy');
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null; name: string }>({
    open: false,
    id: null,
    name: '',
  });
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  
  // Load linked users for all employees
  useEffect(() => {
    const loadLinkedUsers = async () => {
      const usersMap: Record<string, { name: string; username: string }> = {};
      for (const employee of employees) {
        try {
          const user = await getUserByEmployeeId(employee.id);
          if (user) usersMap[employee.id] = { name: user.name, username: user.username };
        } catch {
          /* ignore */
        }
      }
      setLinkedUsers(usersMap);
    };
    
    if (employees.length > 0) {
      loadLinkedUsers();
    } else {
      setLinkedUsers({});
    }
  }, [employees]);
  
  // Listen for user creation/update events to refresh linked users
  useEffect(() => {
    const loadLinkedUsers = async () => {
      const usersMap: Record<string, { name: string; username: string }> = {};
      for (const employee of employees) {
        try {
          const user = await getUserByEmployeeId(employee.id);
          if (user) {
            usersMap[employee.id] = { name: user.name, username: user.username };
          }
        } catch (error) {
          // Ignore errors
        }
      }
      setLinkedUsers(usersMap);
    };
    
    const handleUserEvent = () => {
      if (import.meta.env.DEV) console.log('User event received, refreshing linked users...');
      loadLinkedUsers();
    };
    
    const handleEmployeeEvent = () => {
      if (import.meta.env.DEV) console.log('Employee event received, refreshing employees and linked users...');
      refresh();
      setTimeout(() => loadLinkedUsers(), 300);
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        wasHiddenRef.current = true;
      } else if (document.visibilityState === 'visible' && wasHiddenRef.current) {
        wasHiddenRef.current = false;
        if (import.meta.env.DEV) console.log('Tab visible, refreshing linked users...');
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
  }, [employees, refresh]);

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirm({ open: true, id, name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    
    setDeleting(true);
    try {
      await deleteEmployee(deleteConfirm.id);
      await refresh();
      toast({ title: 'Success', description: 'Employee deleted successfully', variant: 'success' });
      setDeleteConfirm({ open: false, id: null, name: '' });
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: 'Error', description: 'Failed to delete employee. Please try again.', variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const filteredEmployees = employees.filter((employee) =>
    employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /** Group by hierarchy: Chairman → Executives → Department Leaders → Team Members → HR */
  const hierarchyOrder: Array<{ key: string; label: string; predicate: (e: (typeof employees)[0]) => boolean }> = [
    { key: 'chairman', label: 'Chairman', predicate: (e) => e.hierarchy === 'chairman' },
    { key: 'executive', label: 'Executives', predicate: (e) => e.hierarchy === 'executive' },
    { key: 'leaders', label: 'Department Leaders', predicate: (e) => isDepartmentLeader(e.hierarchy) },
    { key: 'member', label: 'Team Members', predicate: (e) => e.hierarchy === 'member' },
    { key: 'hr', label: 'HR Personnel', predicate: (e) => e.hierarchy === 'hr' },
  ];

  type EmployeeGroup = { key: string; label: string; employees: typeof filteredEmployees };
  const groups: EmployeeGroup[] = (() => {
    if (groupBy === 'hierarchy') {
      return hierarchyOrder.map(({ key, label, predicate }) => ({
        key,
        label,
        employees: filteredEmployees.filter(predicate),
      })).filter((g) => g.employees.length > 0);
    }
    if (groupBy === 'department') {
      const byTeam = new Map<string | 'none', typeof filteredEmployees>();
      for (const e of filteredEmployees) {
        const tid = e.teamId ?? 'none';
        if (!byTeam.has(tid)) byTeam.set(tid, []);
        byTeam.get(tid)!.push(e);
      }
      const result: EmployeeGroup[] = [];
      for (const team of teams) {
        const list = byTeam.get(team.id);
        if (list?.length) result.push({ key: team.id, label: team.name, employees: list });
      }
      const noDept = byTeam.get('none');
      if (noDept?.length) result.push({ key: 'none', label: 'No department', employees: noDept });
      return result;
    }
    // flat: single group, sorted by name
    const sorted = [...filteredEmployees].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return sorted.length ? [{ key: 'all', label: 'All employees', employees: sorted }] : [];
  })();

  return (
    <div className="space-y-6 pb-8 sm:pb-10 lg:pb-12">
      {/* Header – award-worthy hierarchy */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title text-foreground">Employees</h1>
          <p className="page-subtitle">Manage your employee database</p>
        </div>
        <div className="flex gap-3">
          <Button 
            type="button" 
            onClick={async () => {
              await refresh();
              // Reload linked users after refresh
              const loadLinkedUsers = async () => {
                const usersMap: Record<string, { name: string; username: string }> = {};
                const { getEmployees } = await import('@/lib/storage');
                const updatedEmployees = await getEmployees();
                for (const employee of updatedEmployees) {
                  try {
                    const user = await getUserByEmployeeId(employee.id);
                    if (user) {
                      usersMap[employee.id] = { name: user.name, username: user.username };
                    }
                  } catch (error) {
                    // Ignore errors
                  }
                }
                setLinkedUsers(usersMap);
              };
              loadLinkedUsers();
            }}
            variant="outline"
            size="lg"
            title="Refresh employees and linked users"
          >
            <ArrowClockwise size={20} weight="duotone" className="mr-2" />
            Refresh
          </Button>
          <Button 
            type="button" 
            onClick={() => { setEditingEmployee(null); setDialogOpen(true); }}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transition-all"
            size="lg"
          >
            <Plus size={20} weight="duotone" className="mr-2" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* Search and view filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Input
            placeholder="Search employees by name or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 pl-10 text-base"
            aria-label="Search employees by name or role"
          />
          <MagnifyingGlass size={20} weight="duotone" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden shrink-0" role="group" aria-label="Group employees by">
          <button
            type="button"
            onClick={() => setGroupBy('hierarchy')}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${groupBy === 'hierarchy' ? 'bg-accent text-accent-foreground' : 'bg-card hover:bg-muted text-muted-foreground'}`}
            title="Group by hierarchy"
            aria-pressed={groupBy === 'hierarchy'}
          >
            <UsersThree size={18} weight="duotone" />
            Hierarchy
          </button>
          <button
            type="button"
            onClick={() => setGroupBy('department')}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors border-l border-border ${groupBy === 'department' ? 'bg-accent text-accent-foreground' : 'bg-card hover:bg-muted text-muted-foreground'}`}
            title="Group by department"
            aria-pressed={groupBy === 'department'}
          >
            <Buildings size={18} weight="duotone" />
            Department
          </button>
          <button
            type="button"
            onClick={() => setGroupBy('flat')}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors border-l border-border ${groupBy === 'flat' ? 'bg-accent text-accent-foreground' : 'bg-card hover:bg-muted text-muted-foreground'}`}
            title="Flat list (A–Z)"
            aria-pressed={groupBy === 'flat'}
          >
            <List size={18} weight="duotone" />
            A–Z
          </button>
        </div>
      </div>

      {filteredEmployees.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? 'No employees found' : 'No employees yet'}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Add your first employee to get started'}
            </p>
            {!searchQuery && (
              <Button onClick={() => { setEditingEmployee(null); setDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <UsersThree size={20} weight="duotone" className="text-muted-foreground" />
                {group.label}
                <span className="text-sm font-normal text-muted-foreground">({group.employees.length})</span>
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {group.employees.map((employee) => (
                  <Card 
                    key={employee.id} 
                    className="hover:shadow-xl transition-all duration-300 border-2 hover:border-purple-500/50 group"
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg group-hover:text-purple-600 transition-colors">
                        {employee.name}
                      </CardTitle>
                      <CardDescription className="text-base">{employee.role}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="text-muted-foreground min-w-[80px]">Hierarchy:</span>
                        <span className={employee.hierarchy === 'hr' ? 'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300 border border-teal-200 dark:border-teal-700' : 'font-semibold'}>
                          {HIERARCHY_LABELS[employee.hierarchy]}
                        </span>
                        {employee.hierarchy === 'executive' && employee.executiveType && (
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                            {employee.executiveType === 'operational' ? 'Operational' : 'Advisory'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="text-muted-foreground min-w-[80px]">Status:</span>
                        <span className={
                          (employee.employmentStatus ?? 'permanent') === 'terminated' || (employee.employmentStatus ?? 'permanent') === 'resigned'
                            ? 'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-700'
                            : 'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground border border-border'
                        }>
                          {EMPLOYMENT_STATUS_LABELS[(employee.employmentStatus ?? 'permanent') as EmploymentStatus]}
                        </span>
                      </div>
                {employee.teamId && getTeamName(employee.teamId) && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground min-w-[80px]">Team:</span>
                    <span className="inline-flex items-center gap-1 text-primary">
                      <UsersThree size={14} weight="duotone" />
                      {getTeamName(employee.teamId)}
                    </span>
                  </div>
                )}
                {employee.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground min-w-[80px]">Email:</span>
                    <span className="truncate">{employee.email}</span>
                  </div>
                )}
                {linkedUsers[employee.id] && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground min-w-[80px]">User:</span>
                    <span className="inline-flex items-center gap-1 text-green-600">
                      <CheckCircle size={14} weight="duotone" />
                      {linkedUsers[employee.id].name} (@{linkedUsers[employee.id].username})
                    </span>
                  </div>
                )}
                {!linkedUsers[employee.id] && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground min-w-[80px]">User:</span>
                    <span className="text-xs text-muted-foreground italic">Not linked</span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Added {formatDate(employee.createdAt)}
                </div>
                      <div className="flex gap-2 pt-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1 hover:bg-purple-500 hover:text-white hover:border-purple-500 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEmployee(employee.id);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil size={16} weight="duotone" className="mr-1.5" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1 text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(employee.id, employee.name);
                          }}
                          >
                            <Trash size={16} weight="duotone" className="mr-1.5" />
                            Delete
                          </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
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
        employeeId={editingEmployee}
        onSuccess={() => {
          refresh();
          // Reload linked users after refresh
          setTimeout(() => {
            const loadLinkedUsers = async () => {
              const usersMap: Record<string, { name: string; username: string }> = {};
              const updatedEmployees = await import('@/lib/storage').then(m => m.getEmployees());
              for (const employee of updatedEmployees) {
                try {
                  const user = await getUserByEmployeeId(employee.id);
                  if (user) {
                    usersMap[employee.id] = { name: user.name, username: user.username };
                  }
                } catch (error) {
                  // Ignore errors
                }
              }
              setLinkedUsers(usersMap);
            };
            loadLinkedUsers();
          }, 500);
        }}
      />
    </div>
  );
}
