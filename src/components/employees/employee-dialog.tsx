import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { getEmployee, saveEmployee } from '@/lib/storage';
import { generateId } from '@/lib/utils';
import type { Employee } from '@/types';
import { useToast } from '@/contexts/toast-context';

const employeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  role: z.string().min(1, 'Role is required'),
  hierarchy: z.enum(['executive', 'leader', 'member']),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string | null;
  onSuccess: () => void;
}

export function EmployeeDialog({ open, onOpenChange, employeeId, onSuccess }: EmployeeDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: '',
      email: '',
      role: '',
      hierarchy: 'member',
    },
  });

  useEffect(() => {
    if (open && employeeId) {
      loadEmployee();
    } else if (open && !employeeId) {
      reset({
        name: '',
        email: '',
        role: '',
        hierarchy: 'member',
      });
    }
  }, [open, employeeId]);

  const loadEmployee = async () => {
    if (!employeeId) return;
    try {
      const employee = await getEmployee(employeeId);
      if (employee) {
        reset({
          name: employee.name,
          email: employee.email || '',
          role: employee.role,
          hierarchy: employee.hierarchy,
        });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load employee.', variant: 'error' });
    }
  };

  const onSubmit = async (data: EmployeeFormData) => {
    setLoading(true);
    try {
      const existingEmployee = employeeId ? await getEmployee(employeeId) : null;
      const employee: Employee = {
        id: employeeId || generateId(),
        name: data.name,
        email: data.email || undefined,
        role: data.role,
        hierarchy: data.hierarchy,
        createdAt: existingEmployee?.createdAt || new Date().toISOString(),
      };

      await saveEmployee(employee);
      onSuccess();
      onOpenChange(false);
      toast({ title: 'Success', description: 'Employee saved successfully.', variant: 'success' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save employee.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg border shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">
            {employeeId ? 'Edit Employee' : 'Add Employee'}
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X size={18} weight="duotone" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" {...register('name')} placeholder="John Doe" />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email (Optional)</Label>
            <Input id="email" type="email" {...register('email')} placeholder="john@company.com" />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input id="role" {...register('role')} placeholder="Software Engineer" />
            {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="hierarchy">Hierarchy Level</Label>
            <Select id="hierarchy" {...register('hierarchy')}>
              <option value="executive">Executive</option>
              <option value="leader">Leader</option>
              <option value="member">Member</option>
            </Select>
            {errors.hierarchy && <p className="text-sm text-destructive">{errors.hierarchy.message}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : employeeId ? 'Update Employee' : 'Add Employee'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
