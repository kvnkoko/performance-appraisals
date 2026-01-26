import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getTeam, saveTeam } from '@/lib/storage';
import { generateId } from '@/lib/utils';
import type { Team } from '@/types';
import { useToast } from '@/contexts/toast-context';

const teamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
});

type TeamFormData = z.infer<typeof teamSchema>;

interface TeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string | null;
  onSuccess: () => void;
}

export function TeamDialog({ open, onOpenChange, teamId, onSuccess }: TeamDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg border shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">
            {teamId ? 'Edit Team' : 'Create Team'}
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X size={18} weight="duotone" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
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

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : teamId ? 'Update Team' : 'Create Team'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
