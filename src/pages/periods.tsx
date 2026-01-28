import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Plus, Pencil, Trash, Calendar } from 'phosphor-react';
import { PeriodDialog } from '@/components/periods/period-dialog';
import { PeriodBadge } from '@/components/periods/period-badge';
import { getReviewPeriods, deleteReviewPeriod, saveReviewPeriod } from '@/lib/storage';
import { useToast } from '@/contexts/toast-context';
import { formatDateRange, getDaysRemaining } from '@/lib/period-utils';
import type { ReviewPeriod } from '@/types';

export function PeriodsPage() {
  const { refresh } = useApp();
  const { toast } = useToast();
  const [periods, setPeriods] = useState<ReviewPeriod[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null; name: string }>({
    open: false,
    id: null,
    name: '',
  });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadPeriods();
  }, []);

  const loadPeriods = async () => {
    try {
      const data = await getReviewPeriods();
      setPeriods(data.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        const typeOrder = ['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'Annual', 'Custom'];
        return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
      }));
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load review periods.', variant: 'error' });
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirm({ open: true, id, name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.id) return;
    
    setDeleting(true);
    try {
      await deleteReviewPeriod(deleteConfirm.id);
      await loadPeriods();
      await refresh();
      toast({ title: 'Success', description: 'Review period deleted successfully', variant: 'success' });
      setDeleteConfirm({ open: false, id: null, name: '' });
    } catch (error) {
      console.error('Delete error:', error);
      toast({ title: 'Error', description: 'Failed to delete review period. Please try again.', variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (period: ReviewPeriod, newStatus: ReviewPeriod['status']) => {
    try {
      await saveReviewPeriod({ ...period, status: newStatus });
      await loadPeriods();
      await refresh();
      toast({ title: 'Status updated', variant: 'success' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update status.', variant: 'error' });
    }
  };

  const filteredPeriods = periods.filter((period) => {
    if (filterStatus !== 'all' && period.status !== filterStatus) return false;
    if (filterYear !== 'all' && period.year !== Number(filterYear)) return false;
    return true;
  });

  const years = [...new Set(periods.map((p) => p.year))].sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title text-foreground">Review Periods</h1>
          <p className="page-subtitle text-muted-foreground">Manage quarterly, semi-annual, and annual review periods</p>
        </div>
        <Button type="button" onClick={() => { setEditingPeriod(null); setDialogOpen(true); }}>
          <Plus size={18} weight="duotone" className="mr-2" />
          Create Period
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Label htmlFor="status-filter">Filter by Status</Label>
          <Select id="status-filter" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
        <div className="flex-1">
          <Label htmlFor="year-filter">Filter by Year</Label>
          <Select id="year-filter" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
            <option value="all">All Years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {filteredPeriods.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No periods found</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first review period to get started
            </p>
            <Button type="button" onClick={() => { setEditingPeriod(null); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Create Period
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredPeriods.map((period) => {
            const daysRemaining = period.status === 'active' ? getDaysRemaining(period.endDate) : null;
            return (
              <Card key={period.id} className="hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <PeriodBadge period={period} />
                      </div>
                      <CardTitle className="text-xl">{period.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {formatDateRange(period.startDate, period.endDate)}
                        {daysRemaining !== null && daysRemaining > 0 && (
                          <span className="ml-2 text-amber-600 font-medium">
                            • {daysRemaining} days remaining
                          </span>
                        )}
                        {daysRemaining !== null && daysRemaining <= 0 && (
                          <span className="ml-2 text-red-600 font-medium">
                            • Period ended
                          </span>
                        )}
                      </CardDescription>
                      {period.description && (
                        <p className="text-sm text-muted-foreground mt-2">{period.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={period.status}
                        onChange={(e) => handleStatusChange(period, e.target.value as ReviewPeriod['status'])}
                        className="w-32"
                      >
                        <option value="planning">Planning</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="archived">Archived</option>
                      </Select>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingPeriod(period.id);
                          setDialogOpen(true);
                        }}
                        title="Edit period"
                      >
                        <Pencil size={16} weight="duotone" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(period.id, period.name);
                        }}
                        title="Delete period"
                      >
                        <Trash size={16} weight="duotone" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      <PeriodDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        periodId={editingPeriod}
        onSuccess={() => {
          loadPeriods();
          refresh();
        }}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null, name: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete Review Period"
        description={`Are you sure you want to delete "${deleteConfirm.name}"? This will also delete all appraisal forms (assignments) and links for this period. This action cannot be undone.`}
        confirmText="Delete Period"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
