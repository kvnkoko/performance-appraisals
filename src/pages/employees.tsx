import { useState } from 'react';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Plus, Pencil, Trash, Users } from 'phosphor-react';
import { EmployeeDialog } from '@/components/employees/employee-dialog';
import { HIERARCHY_LABELS } from '@/types';
import { deleteEmployee } from '@/lib/storage';
import { useToast } from '@/contexts/toast-context';
import { formatDate } from '@/lib/utils';

export function EmployeesPage() {
  const { employees, refresh } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
      try {
        await deleteEmployee(id);
        await refresh();
        toast({ title: 'Employee deleted', variant: 'success' });
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to delete employee.', variant: 'error' });
      }
    }
  };

  const filteredEmployees = employees.filter((employee) =>
    employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground mt-2">Manage your employee database</p>
        </div>
        <Button type="button" onClick={() => { setEditingEmployee(null); setDialogOpen(true); }}>
          <Plus size={18} weight="duotone" className="mr-2" />
          Add Employee
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEmployees.map((employee) => (
            <Card key={employee.id} className="hover:shadow-lg transition-all">
              <CardHeader>
                <CardTitle className="text-lg">{employee.name}</CardTitle>
                <CardDescription>{employee.role}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Hierarchy</p>
                    <p className="font-medium">{HIERARCHY_LABELS[employee.hierarchy]}</p>
                  </div>
                  {employee.email && (
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="text-sm">{employee.email}</p>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Added {formatDate(employee.createdAt)}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setEditingEmployee(employee.id);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil size={16} weight="duotone" className="mr-2" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(employee.id)}
                      title="Delete employee"
                    >
                      <Trash size={16} weight="duotone" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employeeId={editingEmployee}
        onSuccess={refresh}
      />
    </div>
  );
}
