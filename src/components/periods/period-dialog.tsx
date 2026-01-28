import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getReviewPeriod, saveReviewPeriod } from '@/lib/storage';
import { generateId } from '@/lib/utils';
import { getCurrentQuarter, getQuarterDates as getQDates, getHalfDates as getHDates, generatePeriodName as genPeriodName } from '@/lib/period-utils';
import type { ReviewPeriod } from '@/types';
import { useToast } from '@/contexts/toast-context';

const periodSchema = z.object({
  name: z.string().min(1, 'Period name is required'),
  type: z.enum(['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'Annual', 'Custom']),
  year: z.number().min(2000).max(2100),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  status: z.enum(['planning', 'active', 'completed', 'archived']),
  description: z.string().optional(),
}).refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
  message: 'End date must be after start date',
  path: ['endDate'],
});

type PeriodFormData = z.infer<typeof periodSchema>;

interface PeriodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodId: string | null;
  onSuccess: () => void;
}

export function PeriodDialog({ open, onOpenChange, periodId, onSuccess }: PeriodDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const currentYear = new Date().getFullYear();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PeriodFormData>({
    resolver: zodResolver(periodSchema),
    defaultValues: {
      name: '',
      type: getCurrentQuarter(),
      year: currentYear,
      startDate: '',
      endDate: '',
      status: 'planning',
      description: '',
    },
  });

  const type = watch('type');
  const year = watch('year');

  useEffect(() => {
    if (open && periodId) {
      loadPeriod();
    } else if (open && !periodId) {
      // Auto-fill dates based on type
      const currentType = getCurrentQuarter();
      const currentYr = currentYear;
      reset({
        name: genPeriodName(currentType, currentYr),
        type: currentType,
        year: currentYr,
        startDate: '',
        endDate: '',
        status: 'planning',
        description: '',
      });
      updateDates(currentType, currentYr);
    }
  }, [open, periodId]);

  useEffect(() => {
    if (open && !periodId && type && year) {
      updateDates(type, year);
      setValue('name', genPeriodName(type, year));
    }
  }, [type, year, open, periodId]);

  const updateDates = (periodType: ReviewPeriod['type'], periodYear: number) => {
    let dates: { start: Date; end: Date };
    if (['Q1', 'Q2', 'Q3', 'Q4'].includes(periodType)) {
      dates = getQDates(periodType as 'Q1' | 'Q2' | 'Q3' | 'Q4', periodYear);
    } else if (['H1', 'H2'].includes(periodType)) {
      dates = getHDates(periodType as 'H1' | 'H2', periodYear);
    } else if (periodType === 'Annual') {
      dates = {
        start: new Date(periodYear, 0, 1),
        end: new Date(periodYear, 11, 31, 23, 59, 59),
      };
    } else {
      // Custom - don't auto-fill
      return;
    }
    setValue('startDate', dates.start.toISOString().split('T')[0]);
    setValue('endDate', dates.end.toISOString().split('T')[0]);
  };

  const loadPeriod = async () => {
    if (!periodId) return;
    try {
      const period = await getReviewPeriod(periodId);
      if (period) {
        reset({
          name: period.name,
          type: period.type,
          year: period.year,
          startDate: period.startDate.split('T')[0],
          endDate: period.endDate.split('T')[0],
          status: period.status,
          description: period.description || '',
        });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load period.', variant: 'error' });
    }
  };

  const onSubmit = async (data: PeriodFormData) => {
    setLoading(true);
    try {
      const period: ReviewPeriod = {
        id: periodId || generateId(),
        name: data.name,
        type: data.type,
        year: data.year,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate + 'T23:59:59').toISOString(),
        status: data.status,
        description: data.description,
        createdAt: periodId ? (await getReviewPeriod(periodId))?.createdAt || new Date().toISOString() : new Date().toISOString(),
      };

      await saveReviewPeriod(period);
      onSuccess();
      onOpenChange(false);
      toast({ title: 'Success', description: 'Period saved successfully.', variant: 'success' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save period.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg border shadow-lg w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <h2 className="text-2xl font-bold">
            {periodId ? 'Edit Period' : 'Create Period'}
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X size={18} weight="duotone" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
          <div className="space-y-2">
            <Label htmlFor="name">Period Name</Label>
            <Input id="name" {...register('name')} placeholder="Q1 2025" />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">Period Type</Label>
              <Select id="type" {...register('type')}>
                <option value="Q1">Q1 (Quarter 1)</option>
                <option value="Q2">Q2 (Quarter 2)</option>
                <option value="Q3">Q3 (Quarter 3)</option>
                <option value="Q4">Q4 (Quarter 4)</option>
                <option value="H1">H1 (First Half)</option>
                <option value="H2">H2 (Second Half)</option>
                <option value="Annual">Annual</option>
                <option value="Custom">Custom</option>
              </Select>
              {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                min="2000"
                max="2100"
                {...register('year', { valueAsNumber: true })}
              />
              {errors.year && <p className="text-sm text-destructive">{errors.year.message}</p>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" {...register('startDate')} />
              {errors.startDate && <p className="text-sm text-destructive">{errors.startDate.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" {...register('endDate')} />
              {errors.endDate && <p className="text-sm text-destructive">{errors.endDate.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select id="status" {...register('status')}>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </Select>
            {errors.status && <p className="text-sm text-destructive">{errors.status.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Additional notes about this period..."
              rows={3}
            />
          </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 px-6 pb-6 border-t flex-shrink-0 bg-background">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : periodId ? 'Update Period' : 'Create Period'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
