import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Info, Copy, Check, Eye, EyeSlash } from 'phosphor-react';
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
  reportsTo: z.string().optional(),
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
  const { teams, employees } = useApp();
  const [loading, setLoading] = useState(false);
  const [linkedUser, setLinkedUser] = useState<User | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [showUserLink, setShowUserLink] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [autoCreateUser, setAutoCreateUser] = useState(true); // Default to auto-create for new employees

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
      reportsTo: '',
    },
  });

  const selectedHierarchy = watch('hierarchy');

  useEffect(() => {
    if (open && employeeId) {
      loadEmployee();
      setAutoCreateUser(false); // Don't auto-create for existing employees
    } else if (open && !employeeId) {
      reset({
        name: '',
        email: '',
        role: '',
        hierarchy: 'member',
        teamId: '',
        reportsTo: '',
      });
      setLinkedUser(null);
      setShowUserLink(false);
      setAutoCreateUser(true); // Auto-create for new employees by default
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
          reportsTo: employee.reportsTo || '',
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
      
      // Verify the user was saved correctly by reloading it
      const { getUser } = await import('@/lib/storage');
      const savedUser = await getUser(updatedUser.id);
      if (savedUser && savedUser.employeeId === employeeId) {
        console.log('User link verified - employeeId persisted:', savedUser.employeeId);
        setLinkedUser(savedUser);
      } else {
        console.warn('User link verification failed - reloading from storage');
        // Try reloading by employeeId
        const reloadedUser = await getUserByEmployeeId(employeeId);
        if (reloadedUser) {
          setLinkedUser(reloadedUser);
        } else {
          setLinkedUser(updatedUser); // Fallback to what we tried to save
        }
      }
      
      setShowUserLink(false);
      setSelectedUserId('');
      await loadAvailableUsers();
      
      // Dispatch events to notify both Users and Employees pages to refresh
      window.dispatchEvent(new CustomEvent('userUpdated', { detail: { userId: updatedUser.id, employeeId: employeeId } }));
      window.dispatchEvent(new CustomEvent('employeeUpdated', { detail: { employeeId: employeeId } }));
      
      // Also dispatch after delays to ensure pages catch it
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('userUpdated', { detail: { userId: updatedUser.id, employeeId: employeeId } }));
        window.dispatchEvent(new CustomEvent('employeeUpdated', { detail: { employeeId: employeeId } }));
      }, 500);
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('userUpdated', { detail: { userId: updatedUser.id, employeeId: employeeId } }));
        window.dispatchEvent(new CustomEvent('employeeUpdated', { detail: { employeeId: employeeId } }));
      }, 2000);
      
      // Refresh employees list
      onSuccess();
      
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
      
      // Verify the user was saved correctly by reloading it
      const { getUser } = await import('@/lib/storage');
      const savedUser = await getUser(updatedUser.id);
      if (savedUser && !savedUser.employeeId) {
        console.log('User unlink verified - employeeId removed');
        setLinkedUser(null);
      } else {
        console.warn('User unlink verification failed - reloading from storage');
        const reloadedUser = await getUser(updatedUser.id);
        setLinkedUser(reloadedUser?.employeeId === employeeId ? reloadedUser : null);
      }
      
      await loadAvailableUsers();
      
      // Dispatch events to notify both Users and Employees pages to refresh
      window.dispatchEvent(new CustomEvent('userUpdated', { detail: { userId: updatedUser.id, employeeId: undefined } }));
      window.dispatchEvent(new CustomEvent('employeeUpdated', { detail: { employeeId: employeeId } }));
      
      // Also dispatch after delays to ensure pages catch it
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('userUpdated', { detail: { userId: updatedUser.id, employeeId: undefined } }));
        window.dispatchEvent(new CustomEvent('employeeUpdated', { detail: { employeeId: employeeId } }));
      }, 500);
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('userUpdated', { detail: { userId: updatedUser.id, employeeId: undefined } }));
        window.dispatchEvent(new CustomEvent('employeeUpdated', { detail: { employeeId: employeeId } }));
      }, 2000);
      
      // Refresh employees list
      onSuccess();
      
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

  const [createdCredentials, setCreatedCredentials] = useState<{ userId: string; username: string; password: string; employeeId: string } | null>(null);
  const [editableUsername, setEditableUsername] = useState('');
  const [editablePassword, setEditablePassword] = useState('');
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
        reportsTo: data.reportsTo || undefined,
        createdAt: existingEmployee?.createdAt || new Date().toISOString(),
      };

      await saveEmployee(employee);
      
      // Dispatch event to notify other pages (like Teams) to refresh
      window.dispatchEvent(new CustomEvent('employeeCreated', { detail: { employeeId: newEmployeeId } }));
      window.dispatchEvent(new CustomEvent('employeeUpdated', { detail: { employeeId: newEmployeeId } }));
      
      // Auto-create user account for new employees (unless user opted out)
      if (!employeeId && autoCreateUser) {
        try {
          console.log('Auto-creating user account for new employee:', { employeeId: newEmployeeId, name: data.name });
          // Generate base username
          const baseUsername = generateUsername(data.name, data.email);
          
          // Get all existing users to check for duplicates (case-insensitive)
          const { getUsers, getUserByUsername } = await import('@/lib/storage');
          const allUsers = await getUsers();
          const existingUsernames = new Set(allUsers.map(u => u.username.toLowerCase()));
          
          // Generate a guaranteed unique username using timestamp + random suffix
          // This ensures uniqueness even if there are race conditions
          const timestamp = Date.now().toString().slice(-8);
          const randomSuffix = Math.random().toString(36).substring(2, 6);
          let username = `${baseUsername}${timestamp}${randomSuffix}`.toLowerCase();
          
          // Verify uniqueness - if it exists, keep trying with new random suffix
          let uniquenessCheck = await getUserByUsername(username);
          let uniquenessAttempts = 0;
          const maxUniquenessAttempts = 10;
          
          while (uniquenessCheck && uniquenessAttempts < maxUniquenessAttempts) {
            const newRandomSuffix = Math.random().toString(36).substring(2, 8);
            username = `${baseUsername}${Date.now().toString().slice(-8)}${newRandomSuffix}`.toLowerCase();
            uniquenessCheck = await getUserByUsername(username);
            uniquenessAttempts++;
          }
          
          // Final fallback: if still not unique, use UUID-like approach
          if (uniquenessCheck) {
            username = `${baseUsername}${Date.now()}${Math.random().toString(36).substring(2, 9)}`.toLowerCase();
          }
          
          const password = generateRandomPassword();
          const passwordHash = await hashPassword(password);
          
          const user: User = {
            id: generateId(),
            username: username.toLowerCase().trim(), // Ensure lowercase and trimmed
            passwordHash,
            name: data.name,
            email: data.email || undefined,
            role: 'staff', // All employees get staff role
            active: true,
            employeeId: newEmployeeId,
            mustChangePassword: true, // Force password change on first login
            createdAt: new Date().toISOString(),
          };
          
          // Try saving with retry logic for constraint errors
          let saveAttempts = 0;
          const maxSaveAttempts = 5;
          let saveSuccess = false;
          let finalUsername = username;
          
          while (!saveSuccess && saveAttempts < maxSaveAttempts) {
            try {
              await saveUser(user);
              saveSuccess = true;
              console.log('User saved successfully:', { userId: user.id, username: user.username });
            } catch (userError: any) {
              saveAttempts++;
              console.error(`Error saving user (attempt ${saveAttempts}/${maxSaveAttempts}):`, userError);
              
              // If it's a constraint error, generate a new unique username
              if (userError?.name === 'ConstraintError' || userError?.message?.includes('unique') || userError?.message?.includes('constraint') || userError?.message?.includes('by-username')) {
                // Generate a completely new unique username
                const newTimestamp = Date.now().toString();
                const newRandom = Math.random().toString(36).substring(2, 10);
                finalUsername = `${baseUsername}${newTimestamp}${newRandom}`.toLowerCase().trim();
                user.username = finalUsername;
                
                // Verify this new username doesn't exist
                const verifyCheck = await getUserByUsername(finalUsername);
                if (verifyCheck) {
                  // If it still exists, use a more aggressive approach
                  finalUsername = `${baseUsername}${Date.now()}${Math.random().toString(36).substring(2, 11)}`.toLowerCase().trim();
                  user.username = finalUsername;
                }
                
                if (saveAttempts < maxSaveAttempts) {
                  // Wait a bit before retrying to avoid race conditions
                  await new Promise(resolve => setTimeout(resolve, 100 * saveAttempts));
                  continue; // Retry with new username
                } else {
                  // Max attempts reached, throw error
                  throw new Error(`Failed to create user after ${maxSaveAttempts} attempts due to username conflicts. Please try again or create user manually.`);
                }
              } else {
                // Different error, throw it
                throw userError;
              }
            }
          }
          
          // Update username variable for credentials display
          username = finalUsername;
          
          // Wait a moment to ensure the user is fully saved (especially for Supabase)
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Verify the user was saved correctly by reloading it
          let savedUser = await getUserByEmployeeId(newEmployeeId);
          let retries = 0;
          const maxRetries = 5;
          
          // Retry loading the user if not found (for Supabase async operations)
          while (!savedUser && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500));
            savedUser = await getUserByEmployeeId(newEmployeeId);
            retries++;
          }
          
          // If still not found by employeeId, try loading by user ID
          if (!savedUser) {
            const { getUser } = await import('@/lib/storage');
            savedUser = await getUser(user.id);
          }
          
          if (savedUser) {
            setLinkedUser(savedUser);
            // Use the saved username from the database
            username = savedUser.username;
            
            console.log('User created successfully:', { userId: savedUser.id, username: savedUser.username, employeeId: newEmployeeId });
            
            // Verify user exists in database by fetching all users
            const { getUsers } = await import('@/lib/storage');
            const allUsers = await getUsers();
            const userExists = allUsers.some(u => u.id === savedUser.id);
            console.log('User verification:', { userId: savedUser.id, exists: userExists, totalUsers: allUsers.length });
            
            // Dispatch custom event to notify Users page to refresh (multiple times to ensure it's caught)
            window.dispatchEvent(new CustomEvent('userCreated', { detail: { userId: savedUser.id, employeeId: newEmployeeId } }));
            
            // Also dispatch after delays to catch Users page if it wasn't ready
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('userCreated', { detail: { userId: savedUser.id, employeeId: newEmployeeId } }));
              // Also trigger a storage event as backup
              window.dispatchEvent(new StorageEvent('storage', { key: 'users-updated' }));
            }, 1000);
            
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('userCreated', { detail: { userId: savedUser.id, employeeId: newEmployeeId } }));
            }, 3000);
            
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('userCreated', { detail: { userId: savedUser.id, employeeId: newEmployeeId } }));
            }, 5000);
            
            // Show credentials to admin with editable fields
            setCreatedCredentials({ 
              userId: savedUser.id, 
              username: savedUser.username, 
              password: password,
              employeeId: newEmployeeId
            });
            setEditableUsername(savedUser.username);
            setEditablePassword(password);
            
            toast({ 
              title: 'Employee & Login Created', 
              description: 'A login account has been created. You can edit the username and password before saving.', 
              variant: 'success' 
            });
          } else {
            // Last resort - use the user object we created (shouldn't happen, but handle gracefully)
            console.warn('User not found after creation, using created user object', { userId: user.id, username: user.username });
            setLinkedUser(user);
            
            // Dispatch custom event to notify Users page to refresh (multiple times to ensure it's caught)
            window.dispatchEvent(new CustomEvent('userCreated', { detail: { userId: user.id, employeeId: newEmployeeId } }));
            
            // Also dispatch after delays to catch Users page if it wasn't ready
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('userCreated', { detail: { userId: user.id, employeeId: newEmployeeId } }));
            }, 1000);
            
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('userCreated', { detail: { userId: user.id, employeeId: newEmployeeId } }));
            }, 3000);
            
            // Show credentials to admin with editable fields
            setCreatedCredentials({ 
              userId: user.id, 
              username: user.username, 
              password: password,
              employeeId: newEmployeeId
            });
            setEditableUsername(user.username);
            setEditablePassword(password);
            
            toast({ 
              title: 'Employee & Login Created', 
              description: 'A login account has been created. You can edit the username and password before saving.', 
              variant: 'success' 
            });
          }
        } catch (userCreationError: any) {
          // If user creation fails, still save the employee but show a warning
          console.error('Failed to auto-create user account:', userCreationError);
          toast({ 
            title: 'Employee Created', 
            description: 'Employee saved successfully, but user account creation failed. You can manually link a user account later.', 
            variant: 'default' 
          });
          // Refresh employees list
          onSuccess();
          onOpenChange(false);
        }
      } else {
        // Editing existing employee OR new employee with auto-create disabled
        if (!employeeId && !autoCreateUser) {
          // New employee but auto-create disabled - just save employee
          toast({ 
            title: 'Employee Created', 
            description: 'Employee saved successfully. You can link a user account manually.', 
            variant: 'success' 
          });
        } else {
          // Editing existing employee - refresh and close
          toast({ title: 'Success', description: 'Employee updated successfully.', variant: 'success' });
        }
        
        // Dispatch event to notify other pages (like Teams) to refresh
        window.dispatchEvent(new CustomEvent('employeeCreated', { detail: { employeeId: newEmployeeId } }));
        window.dispatchEvent(new CustomEvent('employeeUpdated', { detail: { employeeId: newEmployeeId } }));
        
        // Also dispatch after delays to catch pages if they weren't ready
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('employeeCreated', { detail: { employeeId: newEmployeeId } }));
          window.dispatchEvent(new CustomEvent('employeeUpdated', { detail: { employeeId: newEmployeeId } }));
        }, 500);
        
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('employeeCreated', { detail: { employeeId: newEmployeeId } }));
          window.dispatchEvent(new CustomEvent('employeeUpdated', { detail: { employeeId: newEmployeeId } }));
        }, 2000);
        
        onSuccess();
        onOpenChange(false);
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
    setEditableUsername('');
    setEditablePassword('');
    setShowPassword(false);
    onOpenChange(false);
  };
  
  const handleDone = async () => {
    // Dispatch final event to ensure Users page refreshes (multiple times)
    if (createdCredentials) {
      window.dispatchEvent(new CustomEvent('userCreated', { detail: { userId: createdCredentials.userId, employeeId: createdCredentials.employeeId } }));
      
      // Dispatch again after delays to ensure Users page catches it
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('userCreated', { detail: { userId: createdCredentials.userId, employeeId: createdCredentials.employeeId } }));
      }, 500);
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('userCreated', { detail: { userId: createdCredentials.userId, employeeId: createdCredentials.employeeId } }));
      }, 2000);
    }
    
    // Refresh employees list
    onSuccess();
    
    // Refresh available users list in case we need to link more
    await loadAvailableUsers();
    
    setCreatedCredentials(null);
    setEditableUsername('');
    setEditablePassword('');
    setShowPassword(false);
    onOpenChange(false);
  };
  
  const handleSaveCredentials = async () => {
    if (!createdCredentials) return;
    
    setSavingCredentials(true);
    try {
      // Get the current user (Supabase first, then IndexedDB for read-your-writes)
      const { getUser } = await import('@/lib/storage');
      let currentUser = await getUser(createdCredentials.userId);
      // If just created, linkedUser may hold the user before it's visible from storage
      if (!currentUser && linkedUser?.id === createdCredentials.userId) {
        currentUser = linkedUser;
      }
      if (!currentUser) {
        toast({ title: 'Error', description: 'User not found.', variant: 'error' });
        setSavingCredentials(false);
        return;
      }
      
      // Check if username changed and if new username is available
      if (editableUsername.toLowerCase().trim() !== currentUser.username.toLowerCase()) {
        const { getUserByUsername } = await import('@/lib/storage');
        const existingUser = await getUserByUsername(editableUsername.toLowerCase().trim());
        if (existingUser && existingUser.id !== currentUser.id) {
          toast({ title: 'Error', description: 'Username already exists. Please choose a different one.', variant: 'error' });
          setSavingCredentials(false);
          return;
        }
      }
      
      // Update user with new username and/or password
      const updatedUser: User = {
        ...currentUser,
        username: editableUsername.toLowerCase().trim(),
      };
      
      // Update password if changed
      if (editablePassword.trim() && editablePassword !== createdCredentials.password) {
        updatedUser.passwordHash = await hashPassword(editablePassword);
        updatedUser.mustChangePassword = true; // Force password change if password was changed
      }
      
      // Try saving with retry logic for constraint errors
      let saveAttempts = 0;
      const maxSaveAttempts = 3;
      let saveSuccess = false;
      
      while (!saveSuccess && saveAttempts < maxSaveAttempts) {
        try {
          await saveUser(updatedUser);
          saveSuccess = true;
        } catch (saveError: any) {
          saveAttempts++;
          console.error(`Error saving credentials (attempt ${saveAttempts}/${maxSaveAttempts}):`, saveError);
          
          // If it's a constraint error, check if username was changed
          if ((saveError?.name === 'ConstraintError' || saveError?.message?.includes('unique') || saveError?.message?.includes('constraint') || saveError?.message?.includes('by-username')) && 
              editableUsername.toLowerCase().trim() !== currentUser.username.toLowerCase()) {
            // Username conflict - check again
            const { getUserByUsername } = await import('@/lib/storage');
            const conflictCheck = await getUserByUsername(editableUsername.toLowerCase().trim());
            if (conflictCheck && conflictCheck.id !== currentUser.id) {
              toast({ 
                title: 'Error', 
                description: 'Username already exists. Please choose a different one.', 
                variant: 'error' 
              });
              setSavingCredentials(false);
              return;
            }
            
            // If no conflict found but still error, try with a timestamp suffix
            if (saveAttempts < maxSaveAttempts) {
              const timestampSuffix = Date.now().toString().slice(-6);
              updatedUser.username = `${editableUsername.toLowerCase().trim()}${timestampSuffix}`;
              await new Promise(resolve => setTimeout(resolve, 100 * saveAttempts));
              continue;
            }
          }
          
          // If max attempts reached or different error, throw
          if (saveAttempts >= maxSaveAttempts) {
            throw new Error(`Failed to save credentials after ${maxSaveAttempts} attempts. Please try again.`);
          }
          throw saveError;
        }
      }
      
      // Reload the user to get the latest data (reuse getUser from above)
      const reloadedUser = await getUser(updatedUser.id);
      
      if (reloadedUser) {
        // Update credentials display with saved values
        const finalPassword = editablePassword.trim() || createdCredentials.password;
        setCreatedCredentials({
          ...createdCredentials,
          username: reloadedUser.username,
          password: finalPassword,
        });
        setEditableUsername(reloadedUser.username);
        setEditablePassword(finalPassword);
        setLinkedUser(reloadedUser);
      }
      
      // Dispatch event to refresh Users page (multiple times to ensure it's caught)
      window.dispatchEvent(new CustomEvent('userUpdated', { detail: { userId: updatedUser.id } }));
      window.dispatchEvent(new CustomEvent('userCreated', { detail: { userId: updatedUser.id, employeeId: createdCredentials.employeeId } }));
      
      // Also dispatch after delays to catch Users page if it wasn't ready
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('userUpdated', { detail: { userId: updatedUser.id } }));
        window.dispatchEvent(new CustomEvent('userCreated', { detail: { userId: updatedUser.id, employeeId: createdCredentials.employeeId } }));
      }, 500);
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('userUpdated', { detail: { userId: updatedUser.id } }));
        window.dispatchEvent(new CustomEvent('userCreated', { detail: { userId: updatedUser.id, employeeId: createdCredentials.employeeId } }));
      }, 2000);
      
      // Refresh employees list to show linked user
      onSuccess();
      
      toast({ title: 'Success', description: 'Credentials updated successfully.', variant: 'success' });
    } catch (error) {
      console.error('Error saving credentials:', error);
      toast({ title: 'Error', description: 'Failed to save credentials.', variant: 'error' });
    } finally {
      setSavingCredentials(false);
    }
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
              {(editableUsername !== createdCredentials.username || editablePassword !== createdCredentials.password) && (
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-400">
                  You have unsaved changes. Click "Save Credentials" to apply them.
                </div>
              )}
              
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Username</Label>
                <div className="flex gap-2">
                  <Input 
                    value={editableUsername} 
                    onChange={(e) => setEditableUsername(e.target.value)}
                    className="font-mono"
                    placeholder="Enter username"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(editableUsername, 'username')}
                    title="Copy username"
                  >
                    {copiedField === 'username' ? <Check size={16} /> : <Copy size={16} />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">You can edit the username before saving</p>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Temporary Password</Label>
                <div className="flex gap-2">
                  <Input 
                    type={showPassword ? "text" : "password"}
                    value={editablePassword} 
                    onChange={(e) => setEditablePassword(e.target.value)}
                    className="font-mono"
                    placeholder="Enter password (min 6 characters)"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(editablePassword, 'password')}
                    title="Copy password"
                  >
                    {copiedField === 'password' ? <Check size={16} /> : <Copy size={16} />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">You can edit the password before saving (minimum 6 characters)</p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline"
                onClick={handleDone}
                disabled={savingCredentials}
              >
                Skip & Done
              </Button>
              <Button 
                type="button" 
                onClick={handleSaveCredentials}
                disabled={savingCredentials || !editableUsername.trim() || editablePassword.trim().length < 6}
              >
                {savingCredentials ? 'Saving...' : 'Save Credentials'}
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

          {/* Reports To - for members and leaders (direct manager for auto-assignment) */}
          {(selectedHierarchy === 'member' || selectedHierarchy === 'leader') && (
            <div className="space-y-2">
              <Label htmlFor="reportsTo">Reports To</Label>
              <Select id="reportsTo" {...register('reportsTo')}>
                <option value="">Not set</option>
                {employees
                  .filter((e) => (e.hierarchy === 'leader' || e.hierarchy === 'executive') && e.id !== employeeId)
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.hierarchy})
                    </option>
                  ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Direct manager. Used for auto-assignment of appraisals (Leader→Member, Member→Leader).
              </p>
              {errors.reportsTo && <p className="text-sm text-destructive">{errors.reportsTo.message}</p>}
            </div>
          )}

          {/* User Account Section - Different UI for new vs existing employees */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <UserCircle size={18} weight="duotone" />
                User Account
              </Label>
            </div>
            
            {employeeId ? (
              // Existing employee - show linking options
              <>
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
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      No user account linked. Link an existing user below.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowUserLink(true)}
                    >
                      <LinkSimple size={16} className="mr-1.5" />
                      Link User
                    </Button>
                  </div>
                )}
              </>
            ) : (
              // New employee - show auto-create option
              <div className="space-y-3 p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded bg-blue-500/20 mt-0.5">
                    <UserCircle size={18} weight="duotone" className="text-blue-600" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                          Auto-create Login Account
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          A user account will be automatically created with login credentials
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoCreateUser}
                          onChange={(e) => setAutoCreateUser(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    {autoCreateUser && (
                      <div className="mt-2 p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-start gap-2">
                          <Info size={16} weight="duotone" className="text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-blue-800 dark:text-blue-200">
                            <p className="font-medium">What happens:</p>
                            <ul className="mt-1 space-y-0.5 list-disc list-inside">
                              <li>Username will be auto-generated from name/email</li>
                              <li>A secure temporary password will be created</li>
                              <li>You'll be able to edit credentials before saving</li>
                              <li>Employee will be required to change password on first login</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                    {!autoCreateUser && (
                      <div className="mt-2 p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-2">
                          <Info size={16} weight="duotone" className="text-amber-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-amber-800 dark:text-amber-200">
                            You can manually link a user account after creating the employee.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

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
