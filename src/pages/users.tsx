import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Plus, Pencil, Trash, User, Shield, UserCircle } from 'phosphor-react';
import { deleteUser, getUsers, saveUser, getUserByUsername } from '@/lib/storage';
import { useToast } from '@/contexts/toast-context';
import { formatDate } from '@/lib/utils';
import { generateId, hashPassword } from '@/lib/utils';
import type { User as UserType } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>{isEditing ? 'Edit User' : 'Add User'}</CardTitle>
          <CardDescription>
            {isEditing ? 'Update user information' : 'Create a new user account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                {...register('username')}
                placeholder="Enter username"
                disabled={isEditing} // Don't allow username changes
              />
              {errors.username && (
                <p className="text-xs text-destructive">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password {isEditing ? '(leave blank to keep current)' : '*'}
              </Label>
              <Input
                id="password"
                type="password"
                {...register('password')}
                placeholder={isEditing ? 'Enter new password (optional)' : 'Enter password'}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Enter full name"
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="Enter email (optional)"
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <select
                id="role"
                {...register('role')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
              {errors.role && (
                <p className="text-xs text-destructive">{errors.role.message}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="active"
                {...register('active')}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="active" className="text-sm font-normal cursor-pointer">
                Active (user can log in)
              </Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1">
                {isEditing ? 'Update' : 'Create'}
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadUsers = async () => {
    try {
      setLoading(true);
      const allUsers = await getUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({ title: 'Error', description: 'Failed to load users', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        await deleteUser(id);
        await loadUsers();
        toast({ title: 'User deleted', variant: 'success' });
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to delete user.', variant: 'error' });
      }
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground mt-2">Manage user accounts and access</p>
        </div>
        <Button type="button" onClick={() => { setEditingUser(null); setDialogOpen(true); }}>
          <Plus size={18} weight="duotone" className="mr-2" />
          Add User
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
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
            <Card key={user.id} className="hover:shadow-lg transition-all">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{user.name}</CardTitle>
                  {user.role === 'admin' && (
                    <Shield size={20} weight="duotone" className="text-purple-500" />
                  )}
                </div>
                <CardDescription>@{user.username}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {user.email && (
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="text-sm">{user.email}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Role</p>
                    <p className="font-medium capitalize">{user.role}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className={`text-sm font-medium ${user.active ? 'text-green-600' : 'text-red-600'}`}>
                      {user.active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                  {user.lastLoginAt && (
                    <div>
                      <p className="text-sm text-muted-foreground">Last Login</p>
                      <p className="text-sm">{formatDate(user.lastLoginAt)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="text-sm">{formatDate(user.createdAt)}</p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditingUser(user); setDialogOpen(true); }}
                      className="flex-1"
                    >
                      <Pencil size={16} className="mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(user.id)}
                      className="flex-1 text-destructive hover:text-destructive"
                    >
                      <Trash size={16} className="mr-1" />
                      Delete
                    </Button>
                  </div>
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
    </div>
  );
}
