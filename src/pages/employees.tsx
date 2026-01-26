import { useState } from 'react';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Plus, Pencil, Trash, Users, MagnifyingGlass, UsersThree, UserCircle, CheckCircle, ArrowClockwise } from 'phosphor-react';
import { EmployeeDialog } from '@/components/employees/employee-dialog';
import { HIERARCHY_LABELS } from '@/types';
import { deleteEmployee, getUserByEmployeeId } from '@/lib/storage';
import { useToast } from '@/contexts/toast-context';
import { formatDate } from '@/lib/utils';
import { useEffect } from 'react';

export function EmployeesPage() {
  const { employees, teams, refresh } = useApp();
  const [linkedUsers, setLinkedUsers] = useState<Record<string, { name: string; username: string }>>({});
  
  // Helper to get team name
  const getTeamName = (teamId?: string) => {
    if (!teamId) return null;
    const team = teams.find(t => t.id === teamId);
    return team?.name;
  };
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
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
      console.log('Loading linked users for', employees.length, 'employees');
      const usersMap: Record<string, { name: string; username: string }> = {};
      for (const employee of employees) {
        try {
          const user = await getUserByEmployeeId(employee.id);
          if (user) {
            usersMap[employee.id] = { name: user.name, username: user.username };
            console.log('Found linked user for employee', employee.id, ':', user.username);
          } else {
            console.log('No linked user found for employee', employee.id);
          }
        } catch (error) {
          console.error('Error loading linked user for employee', employee.id, ':', error);
        }
      }
      console.log('Loaded', Object.keys(usersMap).length, 'linked users');
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
      console.log('User event received, refreshing linked users...');
      loadLinkedUsers();
    };
    
    // Listen for window focus to refresh when user returns to the page
    const handleFocus = () => {
      console.log('Window focused, refreshing linked users...');
      loadLinkedUsers();
    };
    
    // Poll for updates every 10 seconds (as a fallback, only when page is visible)
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadLinkedUsers();
      }
    }, 10000);
    
    window.addEventListener('userCreated', handleUserEvent);
    window.addEventListener('userUpdated', handleUserEvent);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('userCreated', handleUserEvent);
      window.removeEventListener('userUpdated', handleUserEvent);
      window.removeEventListener('focus', handleFocus);
      clearInterval(pollInterval);
    };
  }, [employees]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Employees
          </h1>
          <p className="text-muted-foreground mt-2">Manage your employee database</p>
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

      {/* Search */}
      <div className="relative">
        <Input
          placeholder="Search employees by name or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12 pl-10 text-base"
        />
        <MagnifyingGlass size={20} weight="duotone" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEmployees.map((employee) => (
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
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground min-w-[80px]">Hierarchy:</span>
                  <span className="font-semibold">{HIERARCHY_LABELS[employee.hierarchy]}</span>
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
