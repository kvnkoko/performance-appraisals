import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Info, Copy, Check } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { getEmployee, saveEmployee, saveUser, getUserByUsername, getUsers, getUserByEmployeeId } from '@/lib/storage';
import { generateId, hashPassword } from '@/lib/utils';
import type { Employee, User } from '@/types';
import { useToast } from '@/contexts/toast-context';
import { useApp } from '@/contexts/app-context';
import { LinkSimple, LinkSimpleBreak, UserCircle } from 'phosphor-react';

const employeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  role: z.string().min(1, 'Role is required'),
  hierarchy: z.enum(['executive', 'leader', 'member']),
  teamId: z.string().optional(),
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
  const { teams } = useApp();
  const [loading, setLoading] = useState(false);
  const [linkedUser, setLinkedUser] = useState<User | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [showUserLink, setShowUserLink] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: '',
      email: '',
      role: '',
      hierarchy: 'member',
      teamId: '',
    },
  });

  const selectedHierarchy = watch('hierarchy');

  useEffect(() => {
    if (open && employeeId) {
      loadEmployee();
    } else if (open && !employeeId) {
      reset({
        name: '',
        email: '',
        role: '',
        hierarchy: 'member',
        teamId: '',
      });
      setLinkedUser(null);
      setShowUserLink(false);
    }
    // Load available users when dialog opens
    if (open) {
      loadAvailableUsers();
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
          teamId: employee.teamId || '',
        });
        
        // Load linked user if exists
        const user = await getUserByEmployeeId(employeeId);
        setLinkedUser(user || null);
      }
    } catch (error) {
      console.error('Error loading employee:', error);
      toast({ title: 'Error', description: 'Failed to load employee.', variant: 'error' });
    }
  };
  
  const loadAvailableUsers = async () => {
    try {
      const users = await getUsers();
      // Filter out users that are already linked to other employees (except current one)
      const available = users.filter(u => !u.employeeId || (employeeId && u.employeeId === employeeId));
      setAvailableUsers(available);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };
  
  const handleLinkUser = async () => {
    if (!selectedUserId || !employeeId) return;
    
    try {
      const user = availableUsers.find(u => u.id === selectedUserId);
      if (!user) return;
      
      const updatedUser: User = {
        ...user,
        employeeId: employeeId,
      };
      
      await saveUser(updatedUser);
      setLinkedUser(updatedUser);
      setShowUserLink(false);
      setSelectedUserId('');
      await loadAvailableUsers();
      
      // Dispatch event to notify Users page to refresh
      window.dispatchEvent(new CustomEvent('userUpdated', { detail: { userId: updatedUser.id } }));
      
      toast({ title: 'Success', description: 'User linked to employee successfully.', variant: 'success' });
    } catch (error) {
      console.error('Error linking user:', error);
      toast({ title: 'Error', description: 'Failed to link user.', variant: 'error' });
    }
  };
  
  const handleUnlinkUser = async () => {
    if (!linkedUser || !employeeId) return;
    
    try {
      const updatedUser: User = {
        ...linkedUser,
        employeeId: undefined,
      };
      
      await saveUser(updatedUser);
      setLinkedUser(null);
      await loadAvailableUsers();
      
      // Dispatch event to notify Users page to refresh
      window.dispatchEvent(new CustomEvent('userUpdated', { detail: { userId: updatedUser.id } }));
      
      toast({ title: 'Success', description: 'User unlinked from employee successfully.', variant: 'success' });
    } catch (error) {
      console.error('Error unlinking user:', error);
      toast({ title: 'Error', description: 'Failed to unlink user.', variant: 'error' });
    }
  };

  // Generate username from name (e.g., "John Doe" -> "john.doe")
  const generateUsername = (name: string, email?: string): string => {
    if (email) {
      // Use email prefix as username
      return email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    // Generate from name
    return name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
  };

  // Generate random password
  const generateRandomPassword = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const [createdCredentials, setCreatedCredentials] = useState<{ username: string; password: string } | null>(null);
  const [copiedField, setCopiedField] = useState<'username' | 'password' | null>(null);

  const copyToClipboard = async (text: string, field: 'username' | 'password') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const onSubmit = async (data: EmployeeFormData) => {
    setLoading(true);
    setCreatedCredentials(null);
    
    try {
      const existingEmployee = employeeId ? await getEmployee(employeeId) : null;
      const newEmployeeId = employeeId || generateId();
      
      const employee: Employee = {
        id: newEmployeeId,
        name: data.name,
        email: data.email || undefined,
        role: data.role,
        hierarchy: data.hierarchy,
        teamId: data.hierarchy !== 'executive' && data.teamId ? data.teamId : undefined,
        createdAt: existingEmployee?.createdAt || new Date().toISOString(),
      };

      await saveEmployee(employee);
      
      // Auto-create user account for new employees
      if (!employeeId) {
        // Generate base username
        const baseUsername = generateUsername(data.name, data.email);
        let username = baseUsername;
        
        // Get all existing users to check for duplicates (case-insensitive)
        const { getUsers } = await import('@/lib/storage');
        const allUsers = await getUsers();
        const existingUsernames = new Set(allUsers.map(u => u.username.toLowerCase()));
        
        // Check if username already exists and make it unique if needed
        let attempt = 1;
        const maxAttempts = 1000; // Prevent infinite loops
        while (existingUsernames.has(username.toLowerCase()) && attempt < maxAttempts) {
          username = `${baseUsername}${attempt}`;
          attempt++;
        }
        
        if (attempt >= maxAttempts) {
          // Fallback: use timestamp to ensure uniqueness
          username = `${baseUsername}${Date.now().toString().slice(-6)}`;
        }
        
        // Double-check the final username doesn't exist
        const finalCheck = await getUserByUsername(username);
        if (finalCheck) {
          // Last resort: add random suffix
          const randomSuffix = Math.random().toString(36).substring(2, 6);
          username = `${baseUsername}${randomSuffix}`;
        }
        
        const password = generateRandomPassword();
        const passwordHash = await hashPassword(password);
        
        const user: User = {
          id: generateId(),
          username: username.toLowerCase(), // Ensure lowercase for consistency
          passwordHash,
          name: data.name,
          email: data.email || undefined,
          role: 'staff', // All employees get staff role
          active: true,
          employeeId: newEmployeeId,
          mustChangePassword: true, // Force password change on first login
          createdAt: new Date().toISOString(),
        };
        
        try {
          await saveUser(user);
        } catch (userError: any) {
          console.error('Error saving user:', userError);
          // If it's a constraint error, try with a more unique username
          if (userError?.name === 'ConstraintError' || userError?.message?.includes('unique') || userError?.message?.includes('constraint')) {
            // Generate a completely unique username with timestamp
            const uniqueUsername = `${baseUsername}${Date.now().toString().slice(-8)}`;
            const retryUser: User = {
              ...user,
              username: uniqueUsername.toLowerCase(),
            };
            await saveUser(retryUser);
            // Update the username in credentials and user object
            username = uniqueUsername;
            user.username = uniqueUsername.toLowerCase();
          } else {
            throw userError; // Re-throw if it's a different error
          }
        }
        
        // Verify the user was saved correctly by reloading it
        const savedUser = await getUserByEmployeeId(newEmployeeId);
        if (savedUser) {
          setLinkedUser(savedUser);
          // Use the saved username from the database
          username = savedUser.username;
        } else {
          // If not found, set it anyway (might be a timing issue with Supabase)
          setLinkedUser(user);
        }
        
        // Dispatch custom event to notify Users page to refresh
        window.dispatchEvent(new CustomEvent('userCreated', { detail: { userId: user.id, employeeId: newEmployeeId } }));
        
        // Show credentials to admin
        setCreatedCredentials({ username, password });
        
        toast({ 
          title: 'Employee & Login Created', 
          description: 'A login account has been created. Please share the credentials with the employee.', 
          variant: 'success' 
        });
      } else {
        // Editing existing employee - refresh and close
        onSuccess();
        onOpenChange(false);
        toast({ title: 'Success', description: 'Employee updated successfully.', variant: 'success' });
        // Reload linked user in case it changed
        if (employeeId) {
          const user = await getUserByEmployeeId(employeeId);
          setLinkedUser(user || null);
        }
      }
    } catch (error) {
      console.error('Error saving employee:', error);
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.name === 'ConstraintError' || error.message.includes('unique') || error.message.includes('constraint')) {
          toast({ 
            title: 'Error', 
            description: 'A user with a similar username already exists. Please try again or manually link an existing user.', 
            variant: 'error' 
          });
        } else {
          toast({ title: 'Error', description: `Failed to save employee: ${error.message}`, variant: 'error' });
        }
      } else {
        toast({ title: 'Error', description: 'Failed to save employee. Please try again.', variant: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleClose = () => {
    setCreatedCredentials(null);
    onOpenChange(false);
  };
  
  const handleDone = async () => {
    // Refresh employees list
    onSuccess();
    
    // Refresh available users list in case we need to link more
    await loadAvailableUsers();
    
    setCreatedCredentials(null);
    onOpenChange(false);
  };

  if (!open) return null;

  // Show credentials screen after creating new employee
  if (createdCredentials) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-background rounded-lg border shadow-lg w-full max-w-md">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-2xl font-bold text-green-600">Employee Created</h2>
            <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
              <X size={18} weight="duotone" />
            </Button>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <Info size={20} weight="duotone" className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-semibold">Important: Save these credentials!</p>
                <p className="mt-1">Share these login details with the employee. They will be required to change their password on first login.</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Username</Label>
                <div className="flex gap-2">
                  <Input 
                    value={createdCredentials.username} 
                    readOnly 
                    className="font-mono bg-muted"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(createdCredentials.username, 'username')}
                  >
                    {copiedField === 'username' ? <Check size={16} /> : <Copy size={16} />}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Temporary Password</Label>
                <div className="flex gap-2">
                  <Input 
                    value={createdCredentials.password} 
                    readOnly 
                    className="font-mono bg-muted"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(createdCredentials.password, 'password')}
                  >
                    {copiedField === 'password' ? <Check size={16} /> : <Copy size={16} />}
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" onClick={handleDone}>
                Done
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg border shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">
            {employeeId ? 'Edit Employee' : 'Add Employee'}
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
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

          {/* Team selector - only show for non-executives */}
          {selectedHierarchy !== 'executive' && (
            <div className="space-y-2">
              <Label htmlFor="teamId">Team</Label>
              <Select id="teamId" {...register('teamId')}>
                <option value="">Select a team (optional)</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedHierarchy === 'leader' 
                  ? 'The team this leader manages' 
                  : 'The team this member belongs to'}
              </p>
              {errors.teamId && <p className="text-sm text-destructive">{errors.teamId.message}</p>}
            </div>
          )}

          {/* User Account Linking Section */}
          {employeeId && (
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <UserCircle size={18} weight="duotone" />
                  User Account
                </Label>
                {!linkedUser && !showUserLink && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUserLink(true)}
                  >
                    <LinkSimple size={16} className="mr-1.5" />
                    Link User
                  </Button>
                )}
              </div>
              
              {linkedUser ? (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded bg-green-500/20">
                        <UserCircle size={16} weight="duotone" className="text-green-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{linkedUser.name}</div>
                        <div className="text-xs text-muted-foreground">@{linkedUser.username}</div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleUnlinkUser}
                      className="text-red-600 hover:text-red-700 hover:bg-red-500/10"
                    >
                      <LinkSimpleBreak size={16} />
                    </Button>
                  </div>
                </div>
              ) : showUserLink ? (
                <div className="space-y-2 p-3 rounded-lg bg-muted/50 border">
                  <Select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                  >
                    <option value="">Select a user to link...</option>
                    {availableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} (@{user.username})
                      </option>
                    ))}
                  </Select>
                  {availableUsers.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No available users to link. Create a user account first.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowUserLink(false);
                        setSelectedUserId('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleLinkUser}
                      disabled={!selectedUserId}
                    >
                      Link User
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No user account linked. Link an existing user or create a new one when saving.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={handleClose}>
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
