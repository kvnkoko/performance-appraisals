import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Plus, Pencil, Trash, User, Shield, UserCircle, Users, LinkSimple, LinkSimpleBreak, UsersThree, ArrowClockwise } from 'phosphor-react';
import { deleteUser, getUsers, saveUser, getUserByUsername, getEmployees, getEmployee } from '@/lib/storage';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/contexts/toast-context';
import { formatDate } from '@/lib/utils';
import { generateId, hashPassword } from '@/lib/utils';
import type { User as UserType, Employee } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useApp } from '@/contexts/app-context';

const userSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(50, 'Username must be less than 50 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  role: z.enum(['admin', 'staff']),
  active: z.boolean(),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserDialogProps {
  open: boolean;
  onClose: () => void;
  user?: UserType | null;
  onSave: () => void;
}

function UserDialog({ open, onClose, user, onSave }: UserDialogProps) {
  const { toast } = useToast();
  const { employees } = useApp();
  const [linkedEmployee, setLinkedEmployee] = useState<Employee | null>(null);
  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);
  const [showEmployeeLink, setShowEmployeeLink] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: '',
      password: '',
      name: '',
      email: '',
      role: 'staff',
      active: true,
    },
  });

  const isEditing = !!user;
  const passwordValue = watch('password');
  
  useEffect(() => {
    if (open && user) {
      loadLinkedEmployee();
      loadAvailableEmployees();
    } else if (open) {
      setLinkedEmployee(null);
      setShowEmployeeLink(false);
      loadAvailableEmployees();
    }
  }, [open, user]);

  useEffect(() => {
    if (user) {
      reset({
        username: user.username,
        password: '', // Don't prefill password
        name: user.name,
        email: user.email || '',
        role: user.role,
        active: user.active,
      });
    } else {
      reset({
        username: '',
        password: '',
        name: '',
        email: '',
        role: 'staff',
        active: true,
      });
    }
  }, [user, open, reset]);
  
  const loadLinkedEmployee = async () => {
    if (!user?.employeeId) {
      setLinkedEmployee(null);
      return;
    }
    try {
      const employee = await getEmployee(user.employeeId);
      setLinkedEmployee(employee || null);
    } catch (error) {
      console.error('Error loading linked employee:', error);
      setLinkedEmployee(null);
    }
  };
  
  const loadAvailableEmployees = async () => {
    try {
      const allEmployees = await getEmployees();
      const allUsers = await getUsers();
      // Filter out employees that are already linked to other users (except current one)
      const available = allEmployees.filter(e => {
        if (!e.id) return false;
        // If this user already has an employee linked, include that employee
        if (user?.employeeId === e.id) return true;
        // Otherwise, check if employee is linked to any other user
        return !allUsers.some(u => u.employeeId === e.id && u.id !== user?.id);
      });
      setAvailableEmployees(available);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };
  
  const handleLinkEmployee = async () => {
    if (!selectedEmployeeId || !user) return;
    
    try {
      const employee = availableEmployees.find(e => e.id === selectedEmployeeId);
      if (!employee) return;
      
      const updatedUser: UserType = {
        ...user,
        employeeId: selectedEmployeeId,
      };
      
      await saveUser(updatedUser);
      await loadLinkedEmployee();
      setShowEmployeeLink(false);
      setSelectedEmployeeId('');
      await loadAvailableEmployees();
      toast({ title: 'Success', description: 'Employee linked to user successfully.', variant: 'success' });
      onSave(); // Refresh the list
    } catch (error) {
      console.error('Error linking employee:', error);
      toast({ title: 'Error', description: 'Failed to link employee.', variant: 'error' });
    }
  };
  
  const handleUnlinkEmployee = async () => {
    if (!linkedEmployee || !user) return;
    
    try {
      const updatedUser: UserType = {
        ...user,
        employeeId: undefined,
      };
      
      await saveUser(updatedUser);
      setLinkedEmployee(null);
      await loadAvailableEmployees();
      toast({ title: 'Success', description: 'Employee unlinked from user successfully.', variant: 'success' });
      onSave(); // Refresh the list
    } catch (error) {
      console.error('Error unlinking employee:', error);
      toast({ title: 'Error', description: 'Failed to unlink employee.', variant: 'error' });
    }
  };

  if (!open) return null;

  const onSubmit = async (data: UserFormData) => {
    try {
      // Check if username already exists (when creating new user or changing username)
      if (!isEditing || data.username !== user.username) {
        const existingUser = await getUserByUsername(data.username);
        if (existingUser) {
          toast({ title: 'Error', description: 'Username already exists', variant: 'error' });
          return;
        }
      }

      const userData: UserType = {
        id: user?.id || generateId(),
        username: data.username,
        passwordHash: user?.passwordHash || '', // Will be set below if password provided
        name: data.name,
        email: data.email || undefined,
        role: data.role,
        active: data.active,
        employeeId: user?.employeeId, // Preserve existing employee link
        createdAt: user?.createdAt || new Date().toISOString(),
        lastLoginAt: user?.lastLoginAt,
      };

      // Only update password if provided
      if (data.password && data.password.trim()) {
        userData.passwordHash = await hashPassword(data.password);
      } else if (!isEditing) {
        // New user must have a password
        toast({ title: 'Error', description: 'Password is required for new users', variant: 'error' });
        return;
      } else {
        // Keep existing password hash when editing
        userData.passwordHash = user.passwordHash;
      }

      await saveUser(userData);
      toast({ title: 'Success', description: `User ${isEditing ? 'updated' : 'created'} successfully`, variant: 'success' });
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving user:', error);
      toast({ title: 'Error', description: 'Failed to save user', variant: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border-2">
        <CardHeader className="border-b bg-gradient-to-r from-purple-500/10 to-pink-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              {isEditing ? (
                <Pencil size={24} weight="duotone" className="text-purple-500" />
              ) : (
                <User size={24} weight="duotone" className="text-purple-500" />
              )}
            </div>
            <div>
              <CardTitle className="text-2xl">{isEditing ? 'Edit User' : 'Add New User'}</CardTitle>
              <CardDescription className="mt-1">
                {isEditing ? 'Update user information and permissions' : 'Create a new user account for portal access'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="username" className="text-sm font-semibold">Username *</Label>
                <Input
                  id="username"
                  {...register('username')}
                  placeholder="e.g., john.doe"
                  disabled={isEditing}
                  className="h-11"
                />
                {errors.username && (
                  <p className="text-xs text-destructive mt-1">{errors.username.message}</p>
                )}
                {!isEditing && (
                  <p className="text-xs text-muted-foreground">Username cannot be changed after creation</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold">Full Name *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="e.g., John Doe"
                  className="h-11"
                />
                {errors.name && (
                  <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  placeholder="e.g., john@company.com"
                  className="h-11"
                />
                {errors.email && (
                  <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold">
                  Password {isEditing ? '(optional)' : '*'}
                </Label>
                <Input
                  id="password"
                  type="password"
                  {...register('password')}
                  placeholder={isEditing ? 'Leave blank to keep current' : 'Min. 6 characters'}
                  className="h-11"
                />
                {errors.password && (
                  <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
                )}
                {!isEditing && (
                  <p className="text-xs text-muted-foreground">Minimum 6 characters required</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role" className="text-sm font-semibold">Role *</Label>
                <select
                  id="role"
                  {...register('role')}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 transition-colors"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
                {errors.role && (
                  <p className="text-xs text-destructive mt-1">{errors.role.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Admin users have full access to all features
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center space-x-3 p-4 rounded-lg border bg-muted/30">
                  <input
                    type="checkbox"
                    id="active"
                    {...register('active')}
                    className="h-5 w-5 rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                  />
                  <div className="flex-1">
                    <Label htmlFor="active" className="text-sm font-semibold cursor-pointer">
                      Active Account
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {user?.active ? 'User can log in and access the portal' : 'User account is disabled'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Employee Linking Section */}
              {isEditing && (
                <div className="space-y-3 md:col-span-2 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <UsersThree size={18} weight="duotone" />
                      Linked Employee
                    </Label>
                    {!linkedEmployee && !showEmployeeLink && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowEmployeeLink(true)}
                      >
                        <LinkSimple size={16} className="mr-1.5" />
                        Link Employee
                      </Button>
                    )}
                  </div>
                  
                  {linkedEmployee ? (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded bg-green-500/20">
                            <UsersThree size={16} weight="duotone" className="text-green-600" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">{linkedEmployee.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {linkedEmployee.role} • {linkedEmployee.hierarchy}
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleUnlinkEmployee}
                          className="text-red-600 hover:text-red-700 hover:bg-red-500/10"
                        >
                          <LinkSimpleBreak size={16} />
                        </Button>
                      </div>
                    </div>
                  ) : showEmployeeLink ? (
                    <div className="space-y-2 p-3 rounded-lg bg-muted/50 border">
                      <Select
                        value={selectedEmployeeId}
                        onChange={(e) => setSelectedEmployeeId(e.target.value)}
                        className="w-full"
                      >
                        <option value="">Select an employee to link...</option>
                        {availableEmployees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name} ({employee.role})
                          </option>
                        ))}
                      </Select>
                      {availableEmployees.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No available employees to link. Create an employee first.
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowEmployeeLink(false);
                            setSelectedEmployeeId('');
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleLinkEmployee}
                          disabled={!selectedEmployeeId}
                        >
                          Link Employee
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No employee linked. Link an employee to enable portal access for this user.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-6 border-t">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-11">
                Cancel
              </Button>
              <Button type="submit" className="flex-1 h-11 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                {isEditing ? (
                  <>
                    <Pencil size={18} className="mr-2" />
                    Update User
                  </>
                ) : (
                  <>
                    <Plus size={18} className="mr-2" />
                    Create User
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function UsersPage() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [linkedEmployees, setLinkedEmployees] = useState<Record<string, { name: string; role: string }>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null; name: string }>({
    open: false,
    id: null,
    name: '',
  });
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const { employees } = useApp();
  
  const loadUsers = async () => {
    try {
      setLoading(true);
      const allUsers = await getUsers();
      setUsers(allUsers);
      
      // Load linked employees
      const employeesMap: Record<string, { name: string; role: string }> = {};
      for (const user of allUsers) {
        if (user.employeeId) {
          const employee = employees.find(e => e.id === user.employeeId);
          if (employee) {
            employeesMap[user.id] = { name: employee.name, role: employee.role };
          }
        }
      }
      setLinkedEmployees(employeesMap);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({ title: 'Error', description: 'Failed to load users', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    
    // Listen for user creation/update events
    const handleUserEvent = () => {
      console.log('User event received, refreshing users list...');
      loadUsers();
    };
    
    // Listen for window focus to refresh when user returns to the page
    const handleFocus = () => {
      console.log('Window focused, refreshing users list...');
      loadUsers();
    };
    
    window.addEventListener('userCreated', handleUserEvent);
    window.addEventListener('userUpdated', handleUserEvent);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('userCreated', handleUserEvent);
      window.removeEventListener('userUpdated', handleUserEvent);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirm({ open: true, id, name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    
    setDeleting(true);
    try {
      await deleteUser(deleteConfirm.id);
      await loadUsers();
      toast({ title: 'Success', description: 'User deleted successfully', variant: 'success' });
      setDeleteConfirm({ open: false, id: null, name: '' });
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: 'Error', description: 'Failed to delete user. Please try again.', variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            User Management
          </h1>
          <p className="text-muted-foreground mt-2">Manage user accounts and portal access</p>
        </div>
        <div className="flex gap-3">
          <Button 
            type="button" 
            onClick={loadUsers}
            variant="outline"
            size="lg"
            title="Refresh users list"
          >
            <ArrowClockwise size={20} weight="duotone" className="mr-2" />
            Refresh
          </Button>
          <Button 
            type="button" 
            onClick={() => { setEditingUser(null); setDialogOpen(true); }}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transition-all"
            size="lg"
          >
            <Plus size={20} weight="duotone" className="mr-2" />
            Add New User
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold mt-1">{users.length}</p>
              </div>
              <div className="p-3 rounded-full bg-purple-500/10">
                <UserCircle size={24} weight="duotone" className="text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                <p className="text-2xl font-bold mt-1">{users.filter(u => u.active).length}</p>
              </div>
              <div className="p-3 rounded-full bg-green-500/10">
                <User size={24} weight="duotone" className="text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Admins</p>
                <p className="text-2xl font-bold mt-1">{users.filter(u => u.role === 'admin').length}</p>
              </div>
              <div className="p-3 rounded-full bg-pink-500/10">
                <Shield size={24} weight="duotone" className="text-pink-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Staff</p>
                <p className="text-2xl font-bold mt-1">{users.filter(u => u.role === 'staff').length}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/10">
                <Users size={24} weight="duotone" className="text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Input
          placeholder="Search by name, username, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12 pl-10 text-base"
        />
        <User size={20} weight="duotone" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </div>

      {filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? 'No users found' : 'No users yet'}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Add your first user to get started'}
            </p>
            {!searchQuery && (
              <Button onClick={() => { setEditingUser(null); setDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.map((user) => (
            <Card 
              key={user.id} 
              className="hover:shadow-xl transition-all duration-300 border-2 hover:border-purple-500/50 group"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`p-2.5 rounded-lg ${
                      user.role === 'admin' 
                        ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20' 
                        : 'bg-blue-500/10'
                    }`}>
                      {user.role === 'admin' ? (
                        <Shield size={24} weight="duotone" className="text-purple-500" />
                      ) : (
                        <User size={24} weight="duotone" className="text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{user.name}</CardTitle>
                      <CardDescription className="truncate">@{user.username}</CardDescription>
                    </div>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    user.active 
                      ? 'bg-green-500/20 text-green-600' 
                      : 'bg-red-500/20 text-red-600'
                  }`}>
                    {user.active ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {user.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground min-w-[60px]">Email:</span>
                    <span className="truncate">{user.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground min-w-[60px]">Role:</span>
                  <span className={`font-semibold capitalize ${
                    user.role === 'admin' ? 'text-purple-600' : 'text-blue-600'
                  }`}>
                    {user.role}
                  </span>
                </div>
                {user.lastLoginAt && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground min-w-[60px]">Last Login:</span>
                    <span>{formatDate(user.lastLoginAt)}</span>
                  </div>
                )}
                {linkedEmployees[user.id] && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground min-w-[60px]">Employee:</span>
                    <span className="inline-flex items-center gap-1 text-green-600">
                      <UsersThree size={14} weight="duotone" />
                      {linkedEmployees[user.id].name} ({linkedEmployees[user.id].role})
                    </span>
                  </div>
                )}
                {user.mustChangePassword && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 text-xs font-medium">
                      Must Change Password
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground min-w-[60px]">Created:</span>
                  <span>{formatDate(user.createdAt)}</span>
                </div>
                <div className="flex gap-2 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setEditingUser(user); setDialogOpen(true); }}
                    className="flex-1 hover:bg-purple-500 hover:text-white hover:border-purple-500 transition-colors"
                  >
                    <Pencil size={16} className="mr-1.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(user.id, user.name);
                    }}
                    className="flex-1 text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
                  >
                    <Trash size={16} className="mr-1.5" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <UserDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingUser(null); }}
        user={editingUser}
        onSave={loadUsers}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null, name: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete User"
        description={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone and will remove all associated data.`}
        confirmText="Delete User"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
