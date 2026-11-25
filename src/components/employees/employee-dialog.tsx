import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Info, Copy, Check, Eye, EyeSlash, Crown, Briefcase, Buildings, UserCircle, Key, ShieldCheck, LockSimple, ArrowsClockwise } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { getEmployee, saveEmployee, saveUser, getUserByEmployeeId, createPerson, describeError } from '@/lib/storage';
import { generateId, formatDate } from '@/lib/utils';
import { getDepartmentLeaderId } from '@/lib/org-chart-utils';
import type { Employee, User, ExecutiveType, EmploymentStatus } from '@/types';
import { isDepartmentLeader, LOCKING_STATUSES } from '@/types';
import { useToast } from '@/contexts/toast-context';
import { useApp } from '@/contexts/app-context';
import { useUser } from '@/contexts/user-context';
import { useDialogRecord } from '@/hooks/use-dialog-record';

const EMPLOYMENT_STATUS_VALUES = ['permanent', 'temporary', 'contractor', 'probation', 'intern', 'on-leave', 'terminated', 'resigned'] as const;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,}$/;

const employeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  role: z.string().min(1, 'Role is required'),
  hierarchy: z.enum(['chairman', 'executive', 'leader', 'department-leader', 'member', 'hr']),
  executiveType: z.enum(['operational', 'advisory']).optional(),
  teamId: z.string().optional(),
  reportsTo: z.string().optional(),
  employmentStatus: z.enum(EMPLOYMENT_STATUS_VALUES).optional(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string | null;
  onSuccess: () => void;
}

/** "Ei Shwe Sin Phyo" -> "eishwesinphyo", the convention existing usernames follow. */
function suggestUsername(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

const isLocking = (status: EmploymentStatus | undefined) => LOCKING_STATUSES.includes(status ?? 'permanent');

export function EmployeeDialog({ open, onOpenChange, employeeId, onSuccess }: EmployeeDialogProps) {
  const { toast } = useToast();
  const { teams, employees } = useApp();
  const { realUser } = useUser();
  const [loading, setLoading] = useState(false);

  // Sign-in section
  const [account, setAccount] = useState<User | null>(null);
  const [originalStatus, setOriginalStatus] = useState<EmploymentStatus | undefined>(undefined);
  const [username, setUsername] = useState('');
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [adminAccess, setAdminAccess] = useState(false);
  const [canSignIn, setCanSignIn] = useState(true);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState<{ name: string; username: string; password: string } | null>(null);
  const [copiedField, setCopiedField] = useState<'username' | 'password' | null>(null);

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
      executiveType: undefined as ExecutiveType | undefined,
      teamId: '',
      reportsTo: '',
      employmentStatus: 'permanent' as EmploymentStatus,
    },
  });

  const selectedHierarchy = watch('hierarchy');
  const selectedEmploymentStatus = watch('employmentStatus');
  const watchedName = watch('name');
  const isSelf = !!account && account.id === realUser?.id;
  const creatingSignIn = !account;

  const loadingRecord = useDialogRecord(
    open,
    employeeId,
    async (id) => {
      const [employee, login] = await Promise.all([getEmployee(id), getUserByEmployeeId(id)]);
      return employee ? { employee, login: login ?? null } : undefined;
    },
    (record) => {
      if (!record) {
        toast({ title: 'Not found', description: 'This person no longer exists.', variant: 'error' });
        onOpenChange(false);
        return;
      }
      const { employee, login } = record;
      const raw = employee.hierarchy as string;
      const validHierarchy = ['chairman', 'executive', 'leader', 'department-leader', 'member', 'hr'].includes(raw)
        ? raw
        : 'member';
      // Map legacy 'leader' to 'department-leader' for form display (Select has department-leader, not leader)
      const formHierarchy = validHierarchy === 'leader' ? 'department-leader' : validHierarchy;
      reset({
        name: employee.name,
        email: employee.email || '',
        role: employee.role,
        hierarchy: formHierarchy as EmployeeFormData['hierarchy'],
        executiveType: employee.executiveType,
        teamId: employee.teamId || '',
        reportsTo: employee.reportsTo || '',
        employmentStatus: employee.employmentStatus ?? 'permanent',
      });
      setOriginalStatus(employee.employmentStatus ?? 'permanent');
      setAccount(login);
      setUsername(login?.username ?? suggestUsername(employee.name));
      setUsernameEdited(!!login);
      setAdminAccess(login?.role === 'admin');
      setCanSignIn(login ? login.active !== false : true);
      setNewPassword(login ? null : generatePassword());
    },
    (error) => {
      console.error('Error loading person:', error);
      toast({ title: 'Error', description: 'Failed to load this person.', variant: 'error' });
      onOpenChange(false);
    }
  );
  const loaded = !loadingRecord;

  useEffect(() => {
    if (!open) return;
    setCredentials(null);
    setShowPassword(false);
    setUsernameEdited(false);
    if (!employeeId) {
      reset({
        name: '',
        email: '',
        role: '',
        hierarchy: 'member',
        executiveType: undefined,
        teamId: '',
        reportsTo: '',
        employmentStatus: 'permanent',
      });
      setAccount(null);
      setOriginalStatus(undefined);
      setUsername('');
      setAdminAccess(false);
      setCanSignIn(true);
      setNewPassword(generatePassword());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employeeId]);

  // Suggest a username from the name until the admin types their own.
  useEffect(() => {
    if (creatingSignIn && !usernameEdited) setUsername(suggestUsername(watchedName || ''));
  }, [watchedName, creatingSignIn, usernameEdited]);

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
    const cleanUsername = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(cleanUsername)) {
      toast({
        title: 'Check the username',
        description: 'Use at least 3 characters: lowercase letters, numbers, dots, dashes or underscores.',
        variant: 'error',
      });
      return;
    }
    setLoading(true);
    try {
      const existingEmployee = employeeId ? await getEmployee(employeeId) : null;
      const personId = employeeId || generateId();
      // Auto-set Reports to = department leader when not set (persist to DB)
      let reportsTo = data.reportsTo || undefined;
      if (data.teamId && !reportsTo) {
        const leaderId = getDepartmentLeaderId(data.teamId, employees);
        if (leaderId && leaderId !== personId) reportsTo = leaderId;
      }
      const employmentStatus = (data.employmentStatus ?? 'permanent') as EmploymentStatus;
      const employee: Employee = {
        id: personId,
        name: data.name.trim(),
        email: data.email || undefined,
        role: data.role,
        hierarchy: data.hierarchy,
        executiveType: data.executiveType,
        teamId: data.teamId ? data.teamId : undefined,
        reportsTo,
        employmentStatus,
        createdAt: existingEmployee?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const role: User['role'] = adminAccess ? 'admin' : 'staff';

      if (!employeeId) {
        await createPerson(employee, { username: cleanUsername, role, password: newPassword! });
        setCredentials({ name: employee.name, username: cleanUsername, password: newPassword! });
        toast({ title: 'Person added', description: 'Share their sign-in details below.', variant: 'success' });
      } else {
        await saveEmployee(employee);
        const nowLocked = isLocking(employmentStatus);
        const wasLocked = isLocking(originalStatus);

        if (account) {
          // The database already locks/unlocks the sign-in when the status changes.
          const active = nowLocked ? false : wasLocked ? true : canSignIn;
          const changed =
            cleanUsername !== account.username || role !== account.role || active !== (account.active !== false) || !!newPassword;
          if (changed) {
            await saveUser(
              {
                ...account,
                username: cleanUsername,
                role,
                active,
                mustChangePassword: newPassword ? true : account.mustChangePassword,
              },
              { password: newPassword ?? undefined }
            );
          }
        } else if (newPassword) {
          await saveUser(
            {
              id: generateId(),
              username: cleanUsername,
              passwordHash: '',
              name: employee.name,
              email: employee.email,
              role,
              active: !nowLocked,
              employeeId: personId,
              mustChangePassword: true,
              createdAt: new Date().toISOString(),
            },
            { password: newPassword }
          );
        }

        if (nowLocked && !wasLocked) {
          try {
            const channel = new BroadcastChannel('appraisals-auth');
            channel.postMessage({ type: 'employeeTerminatedOrResigned', employeeId: personId });
            channel.close();
          } catch {
            // BroadcastChannel not supported
          }
        }

        if (newPassword) {
          setCredentials({ name: employee.name, username: cleanUsername, password: newPassword });
        } else {
          toast({
            title: 'Saved',
            description:
              nowLocked && !wasLocked
                ? 'Their sign-in has been locked and they are signed out on all devices.'
                : wasLocked && !nowLocked
                  ? 'Their sign-in has been unlocked.'
                  : 'Changes saved.',
            variant: 'success',
          });
          onOpenChange(false);
        }
      }

      window.dispatchEvent(new CustomEvent('employeeUpdated', { detail: { employeeId: personId } }));
      window.dispatchEvent(new CustomEvent('userUpdated', { detail: { employeeId: personId } }));
      onSuccess();
    } catch (error) {
      console.error('Error saving person:', error);
      toast({ title: 'Could not save', description: describeError(error, 'Something went wrong. Please try again.'), variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCredentials(null);
    setNewPassword(null);
    setShowPassword(false);
    onOpenChange(false);
  };

  if (!open) return null;

  if (credentials) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-background rounded-lg border shadow-lg w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
            <h2 className="text-xl font-bold">Sign-in details for {credentials.name}</h2>
            <Button type="button" variant="ghost" size="sm" onClick={handleClose} aria-label="Close">
              <X size={18} weight="duotone" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <Info size={20} weight="duotone" className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-semibold">This password is shown only once.</p>
                <p className="mt-1">Share it with them privately. They will be asked to choose their own password when they first sign in.</p>
              </div>
            </div>
            {(['username', 'password'] as const).map((field) => (
              <div key={field} className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                  {field === 'username' ? 'Username' : 'Temporary password'}
                </Label>
                <div className="flex gap-2">
                  <Input readOnly value={credentials[field]} className="font-mono" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(credentials[field], field)}
                    aria-label={`Copy ${field}`}
                  >
                    {copiedField === field ? <Check size={16} /> : <Copy size={16} />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 p-6 pt-4 border-t flex-shrink-0 bg-background">
            <Button type="button" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const statusLocks = isLocking(selectedEmploymentStatus as EmploymentStatus);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg border shadow-lg w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <h2 className="text-2xl font-bold">
            {employeeId ? 'Edit Person' : 'Add Person'}
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={handleClose} aria-label="Close">
            <X size={18} weight="duotone" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {!loaded && <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>}
          <div className={loaded ? 'space-y-4' : 'hidden'}>
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
              <option value="chairman">Chairman</option>
              <option value="executive">Executive</option>
              <option value="department-leader">Department Leader</option>
              <option value="member">Team Member</option>
              <option value="hr">HR Personnel</option>
            </Select>
            <p className="text-xs text-muted-foreground">
              HR personnel can appraise all employees company-wide.
            </p>
            {errors.hierarchy && <p className="text-sm text-destructive">{errors.hierarchy.message}</p>}
          </div>

          {/* Team / Department — prominent "Assign as department head" for Executives */}
          {selectedHierarchy === 'executive' ? (
            <div className="space-y-2 rounded-xl border-2 border-purple-500/20 bg-purple-500/5 p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/20">
                  <Crown size={20} weight="duotone" className="text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <Label htmlFor="teamId" className="text-base font-semibold">
                    Assign as department head
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Optional. When set, this executive leads the chosen department and sees both executive appraisal forms and leader-to-member forms for that team.
                  </p>
                </div>
              </div>
              <Select id="teamId" {...register('teamId')} className="bg-background">
                <option value="">No department — executive only</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                You can also assign leaders from the Teams tab: open a team → Edit → add Executives or Leaders under “Department Leaders”.
              </p>
              {errors.teamId && <p className="text-sm text-destructive">{errors.teamId.message}</p>}
            </div>
          ) : (selectedHierarchy === 'leader' || selectedHierarchy === 'department-leader') ? (
            <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20">
                  <Briefcase size={20} weight="duotone" className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <Label htmlFor="teamId" className="text-base font-semibold">
                    Team this leader manages
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    The department or team this leader is responsible for.
                  </p>
                </div>
              </div>
              <Select id="teamId" {...register('teamId')} className="bg-background">
                <option value="">Select a team (optional)</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
              {errors.teamId && <p className="text-sm text-destructive">{errors.teamId.message}</p>}
            </div>
          ) : selectedHierarchy === 'hr' ? (
            <div className="space-y-2 rounded-xl border border-teal-500/20 bg-teal-500/5 p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/20">
                  <UserCircle size={20} weight="duotone" className="text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <Label htmlFor="teamId" className="text-base font-semibold">
                    Assign as head of HR department
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Optional. When set, this HR person is the department head for the chosen team (e.g. HR team).
                  </p>
                </div>
              </div>
              <Select id="teamId" {...register('teamId')} className="bg-background">
                <option value="">No department — HR only</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
              {errors.teamId && <p className="text-sm text-destructive">{errors.teamId.message}</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Buildings size={18} weight="duotone" className="text-muted-foreground" />
                <Label htmlFor="teamId">Team / Department</Label>
              </div>
              <Select id="teamId" {...register('teamId')}>
                <option value="">Select a team (optional)</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                The team or department this member belongs to.
              </p>
              {errors.teamId && <p className="text-sm text-destructive">{errors.teamId.message}</p>}
            </div>
          )}

          {/* Executive type: operational (manages dept) vs advisory (no dept) */}
          {selectedHierarchy === 'executive' && (
            <div className="space-y-2">
              <Label htmlFor="executiveType">Executive Type</Label>
              <Select id="executiveType" {...register('executiveType')}>
                <option value="">Not set</option>
                <option value="operational">Operational (manages department(s))</option>
                <option value="advisory">Advisory (no direct department)</option>
              </Select>
              <p className="text-xs text-muted-foreground">
                Operational executives oversee department(s); advisory executives have no direct department management.
              </p>
            </div>
          )}

          {/* Reports To - for members, leaders, and executives (direct manager for auto-assignment) */}
          {(selectedHierarchy === 'member' || selectedHierarchy === 'leader' || selectedHierarchy === 'department-leader' || selectedHierarchy === 'executive') && (
            <div className="space-y-2">
              <Label htmlFor="reportsTo">Reports To</Label>
              <Select id="reportsTo" {...register('reportsTo')}>
                <option value="">Not set</option>
                {employees
                  .filter((e) => {
                    if (e.id === employeeId) return false;
                    if (selectedHierarchy === 'executive') return e.hierarchy === 'chairman';
                    if (isDepartmentLeader(selectedHierarchy)) return e.hierarchy === 'chairman' || e.hierarchy === 'executive';
                    return isDepartmentLeader(e.hierarchy) || e.hierarchy === 'executive' || e.hierarchy === 'chairman';
                  })
                  .map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.hierarchy})
                    </option>
                  ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Direct manager (Leader or Executive). Executives who lead a department can have direct reports and appear in auto-assignment like leaders.
              </p>
              {errors.reportsTo && <p className="text-sm text-destructive">{errors.reportsTo.message}</p>}
            </div>
          )}

          {/* Employment status */}
          <div className="space-y-2">
            <Label htmlFor="employmentStatus">Employment status</Label>
            <Select id="employmentStatus" {...register('employmentStatus')}>
              <option value="permanent">Permanent</option>
              <option value="temporary">Temporary</option>
              <option value="contractor">Contractor</option>
              <option value="probation">Probation</option>
              <option value="intern">Intern</option>
              <option value="on-leave">On leave</option>
              <option value="terminated">Terminated</option>
              <option value="resigned">Resigned</option>
            </Select>
            {statusLocks ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Their sign-in will be locked and they will be signed out on all devices.
              </p>
            ) : null}
            {errors.employmentStatus && <p className="text-sm text-destructive">{errors.employmentStatus.message}</p>}
          </div>

          {/* Sign-in */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Key size={18} weight="duotone" />
                Sign-in
              </Label>
              {account && (
                <span className="text-xs text-muted-foreground">
                  {account.lastLoginAt ? `Last signed in ${formatDate(account.lastLoginAt)}` : 'Never signed in'}
                </span>
              )}
            </div>

            {employeeId && !account && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                This person has no sign-in yet. One will be created when you save.
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="signin-username" className="text-xs">Username</Label>
              <Input
                id="signin-username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase());
                  setUsernameEdited(true);
                }}
                className="font-mono"
                autoComplete="off"
                placeholder="username"
              />
            </div>

            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-primary"
                checked={adminAccess}
                disabled={isSelf}
                onChange={(e) => setAdminAccess(e.target.checked)}
              />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <ShieldCheck size={16} weight="duotone" /> Admin access
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {isSelf
                    ? 'You cannot remove your own admin access. Ask another administrator.'
                    : 'Can manage people, forms, periods and settings, and see everyone’s results.'}
                </span>
              </span>
            </label>

            {account && (
              <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary"
                  checked={statusLocks ? false : isLocking(originalStatus) ? true : canSignIn}
                  disabled={statusLocks || isSelf || isLocking(originalStatus)}
                  onChange={(e) => setCanSignIn(e.target.checked)}
                />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <LockSimple size={16} weight="duotone" /> Can sign in
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {statusLocks
                      ? 'Locked because they have left.'
                      : isLocking(originalStatus)
                        ? 'Will be unlocked because their status changes back.'
                        : 'Untick to lock their sign-in without changing their employment status.'}
                  </span>
                </span>
              </label>
            )}

            {account && newPassword === null ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setNewPassword(generatePassword())}>
                <ArrowsClockwise size={16} className="mr-1.5" />
                Reset password
              </Button>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">{account ? 'New temporary password' : 'Temporary password'}</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword ?? ''}
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setNewPassword(generatePassword())}
                    aria-label="Generate another password"
                  >
                    <ArrowsClockwise size={16} />
                  </Button>
                  {account && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setNewPassword(null)}>
                      Cancel
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Shown again after saving so you can share it. They must choose their own password at first sign-in.
                </p>
              </div>
            )}
          </div>
          </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 px-6 pb-6 border-t flex-shrink-0 bg-background">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !loaded}>
              {loading ? 'Saving...' : employeeId ? 'Save' : 'Add Person'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
