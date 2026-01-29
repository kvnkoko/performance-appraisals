import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, UserPlus, UserCircle, Crown, Briefcase } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { getTeam, saveTeam, updateEmployeeTeam } from '@/lib/storage';
import { generateId } from '@/lib/utils';
import type { Team } from '@/types';
import { useToast } from '@/contexts/toast-context';
import { useApp } from '@/contexts/app-context';
import { HIERARCHY_LABELS } from '@/types';

const teamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
});

type TeamFormData = z.infer<typeof teamSchema>;

interface TeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string | null;
  onSuccess: () => void | Promise<void>;
}

export function TeamDialog({ open, onOpenChange, teamId, onSuccess }: TeamDialogProps) {
  const { toast } = useToast();
  const { employees } = useApp();
  const [loading, setLoading] = useState(false);
  const [addLeaderId, setAddLeaderId] = useState('');
  const [leaderActionLoading, setLeaderActionLoading] = useState<string | null>(null);

  // Department leaders: executives, leaders, and HR whose teamId is this team
  const currentLeaders = teamId
    ? employees.filter(
        (e) => e.teamId === teamId && (e.hierarchy === 'leader' || e.hierarchy === 'department-leader' || e.hierarchy === 'executive' || e.hierarchy === 'hr')
      )
    : [];
  // Executives, leaders, and HR not already leading this team (for "Add leader" dropdown)
  const availableToAdd = teamId
    ? employees.filter(
        (e) =>
          (e.hierarchy === 'leader' || e.hierarchy === 'department-leader' || e.hierarchy === 'executive' || e.hierarchy === 'hr') && e.teamId !== teamId
      )
    : [];

  const assignLeader = async (employeeId: string) => {
    if (!teamId) return;
    const emp = employees.find((e) => e.id === employeeId);
    setLeaderActionLoading(employeeId);
    try {
      await updateEmployeeTeam(employeeId, teamId);
      window.dispatchEvent(new CustomEvent('employeeUpdated', { detail: { employeeId } }));
      await Promise.resolve(onSuccess());
      setAddLeaderId('');
      toast({
        title: 'Leader assigned',
        description: emp ? `${emp.name} is now a leader of this department.` : 'Department leader updated.',
        variant: 'success',
      });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to assign leader.', variant: 'error' });
    } finally {
      setLeaderActionLoading(null);
    }
  };

  const removeAsLeader = async (employeeId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    setLeaderActionLoading(employeeId);
    try {
      await updateEmployeeTeam(employeeId, null);
      window.dispatchEvent(new CustomEvent('employeeUpdated', { detail: { employeeId } }));
      await Promise.resolve(onSuccess());
      toast({
        title: 'Removed as leader',
        description: emp ? `${emp.name} is no longer a leader of this department.` : 'Leader removed.',
        variant: 'success',
      });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to remove leader.', variant: 'error' });
    } finally {
      setLeaderActionLoading(null);
    }
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  useEffect(() => {
    if (open && teamId) {
      loadTeam();
    } else if (open && !teamId) {
      reset({
        name: '',
        description: '',
      });
    }
  }, [open, teamId]);

  const loadTeam = async () => {
    if (!teamId) return;
    try {
      const team = await getTeam(teamId);
      if (team) {
        reset({
          name: team.name,
          description: team.description || '',
        });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load team.', variant: 'error' });
    }
  };

  const onSubmit = async (data: TeamFormData) => {
    setLoading(true);
    try {
      const existingTeam = teamId ? await getTeam(teamId) : null;
      const team: Team = {
        id: teamId || generateId(),
        name: data.name,
        description: data.description || undefined,
        createdAt: existingTeam?.createdAt || new Date().toISOString(),
      };

      await saveTeam(team);
      
      // Dispatch custom event to notify Teams page to refresh
      window.dispatchEvent(new CustomEvent('teamCreated', { detail: { teamId: team.id } }));
      window.dispatchEvent(new CustomEvent('teamUpdated', { detail: { teamId: team.id } }));
      
      // Also dispatch after delays to catch Teams page if it wasn't ready
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('teamCreated', { detail: { teamId: team.id } }));
        window.dispatchEvent(new CustomEvent('teamUpdated', { detail: { teamId: team.id } }));
      }, 500);
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('teamCreated', { detail: { teamId: team.id } }));
        window.dispatchEvent(new CustomEvent('teamUpdated', { detail: { teamId: team.id } }));
      }, 2000);
      
      onSuccess();
      onOpenChange(false);
      toast({ title: 'Success', description: 'Team saved successfully.', variant: 'success' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save team.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`bg-background rounded-xl border shadow-2xl w-full max-h-[90vh] flex flex-col overflow-hidden ${teamId ? 'max-w-lg' : 'max-w-md'}`}>
        <div className="flex items-center justify-between p-6 border-b bg-muted/30 flex-shrink-0">
          <h2 className="text-2xl font-bold tracking-tight">
            {teamId ? 'Edit Team & Leaders' : 'Create Team'}
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X size={18} weight="duotone" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-5 min-h-0">
          <div className="space-y-2">
            <Label htmlFor="name">Team Name</Label>
            <Input 
              id="name" 
              {...register('name')} 
              placeholder="e.g., Engineering, Marketing, Sales" 
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea 
              id="description" 
              {...register('description')} 
              placeholder="Brief description of the team's purpose..."
              rows={3}
            />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>

          {teamId && (
            <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center gap-2">
                <UserPlus size={20} weight="duotone" className="text-primary" />
                <Label className="text-base font-semibold">Department Leaders</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Assign Executives or Leaders to lead this department. Executives who lead a department see both executive appraisal forms and leader-to-member forms for this team.
              </p>
              {currentLeaders.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {currentLeaders.map((leader) => (
                    <span
                      key={leader.id}
                      className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm shadow-sm"
                    >
                      {leader.hierarchy === 'executive' ? (
                        <Crown size={16} weight="duotone" className="text-purple-600 dark:text-purple-400" />
                      ) : (
                        <Briefcase size={16} weight="duotone" className="text-amber-600 dark:text-amber-400" />
                      )}
                      <span className="font-medium">{leader.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({HIERARCHY_LABELS[leader.hierarchy]})
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAsLeader(leader.id)}
                        disabled={leaderActionLoading === leader.id}
                        className="ml-1 rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                        title="Remove as leader"
                      >
                        <X size={14} weight="bold" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={addLeaderId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setAddLeaderId('');
                    if (id) assignLeader(id);
                  }}
                  className="max-w-[260px]"
                  disabled={leaderActionLoading !== null}
                >
                  <option value="">Add Executive or Leader…</option>
                  {availableToAdd.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} — {HIERARCHY_LABELS[emp.hierarchy]}
                    </option>
                  ))}
                </Select>
                {availableToAdd.length === 0 && currentLeaders.length === 0 && (
                  <span className="text-sm text-muted-foreground">
                    No Executives or Leaders in the system yet. Add them from the Employees tab.
                  </span>
                )}
                {availableToAdd.length === 0 && currentLeaders.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    All Executives and Leaders are already assigned.
                  </span>
                )}
              </div>
            </div>
          )}
          </div>

          <div className="flex justify-end gap-3 pt-4 px-6 pb-6 border-t flex-shrink-0 bg-background">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : teamId ? 'Update Team' : 'Create Team'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
