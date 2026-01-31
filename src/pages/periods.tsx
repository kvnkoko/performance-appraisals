import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Plus, Pencil, Trash, Calendar, Trophy, FileText, Eye, X, PencilSimple, Check } from 'phosphor-react';
import { PeriodDialog } from '@/components/periods/period-dialog';
import { PeriodBadge } from '@/components/periods/period-badge';
import { CompletedFormViewModal } from '@/components/shared/completed-form-view-modal';
import { getReviewPeriods, deleteReviewPeriod, saveReviewPeriod, saveEmployeeOfPeriodOverrides } from '@/lib/storage';
import { useToast } from '@/contexts/toast-context';
import { formatDateRange, getDaysRemaining } from '@/lib/period-utils';
import type { ReviewPeriod } from '@/types';

export function PeriodsPage() {
  const { appraisals, assignments, employees, templates, settings, refresh } = useApp();
  const { toast } = useToast();
  const overrides = settings.employeeOfPeriodOverrides ?? {};
  const [periods, setPeriods] = useState<ReviewPeriod[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string | null; name: string }>({
    open: false,
    id: null,
    name: '',
  });
  const [deleting, setDeleting] = useState(false);
  const [periodFormsPeriodId, setPeriodFormsPeriodId] = useState<string | null>(null);
  const [viewAppraisalId, setViewAppraisalId] = useState<string | null>(null);
  const [editingEotPPeriodId, setEditingEotPPeriodId] = useState<string | null>(null);
  const [eotPDraftEmployeeId, setEotPDraftEmployeeId] = useState<string>('');

  useEffect(() => {
    loadPeriods();
  }, []);

  const loadPeriods = async () => {
    try {
      const data = await getReviewPeriods();
      setPeriods(data.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
    } catch (error) {
      console.error('Failed to load periods:', error);
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
    } catch {
      toast({ title: 'Error', description: 'Failed to update status.', variant: 'error' });
    }
  };

  const filteredPeriods = periods.filter((period) => {
    if (filterStatus !== 'all' && period.status !== filterStatus) return false;
    if (filterYear !== 'all' && period.year !== Number(filterYear)) return false;
    if (filterType !== 'all' && period.type !== filterType) return false;
    return true;
  });

  const getPeriodStats = (period: ReviewPeriod) => {
    const periodAppraisals = appraisals.filter(
      (a) => a.reviewPeriodId === period.id && a.completedAt
    );
    const periodAssignments = assignments.filter((a) => a.reviewPeriodId === period.id);
    const totalAssignments = periodAssignments.length;
    const assignmentsWithCompletedAppraisal = periodAssignments.filter((a) =>
      periodAppraisals.some(
        (p) =>
          p.employeeId === a.employeeId &&
          p.appraiserId === a.appraiserId &&
          p.templateId === a.templateId
      )
    ).length;
    const totalToComplete = totalAssignments || periodAppraisals.length || 1;
    const completedCount = totalAssignments > 0 ? assignmentsWithCompletedAppraisal : periodAppraisals.length;
    const completionRate = totalToComplete > 0 ? (completedCount / totalToComplete) * 100 : 0;
    const avgScore = periodAppraisals.length > 0
      ? periodAppraisals.reduce((sum, a) => sum + (a.score / a.maxScore) * 100, 0) / periodAppraisals.length
      : 0;

    const employeeScores: Record<string, { total: number; max: number; count: number }> = {};
    periodAppraisals.forEach((appraisal) => {
      if (!employeeScores[appraisal.employeeId]) {
        employeeScores[appraisal.employeeId] = { total: 0, max: 0, count: 0 };
      }
      employeeScores[appraisal.employeeId].total += (appraisal.score / appraisal.maxScore) * 100;
      employeeScores[appraisal.employeeId].max += 100;
      employeeScores[appraisal.employeeId].count += 1;
    });

    const topPerformers = Object.entries(employeeScores)
      .map(([employeeId, data]) => ({
        employeeId,
        percentage: data.total / data.count,
        employee: employees.find((e) => e.id === employeeId),
      }))
      .filter((item) => item.employee)
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3);

    const overrideEmployeeId = overrides[period.id];
    const employeeOfPeriod = overrideEmployeeId
      ? employees.find((e) => e.id === overrideEmployeeId)
      : topPerformers[0]?.employee ?? null;

    return {
      totalToComplete,
      completedCount,
      completionRate,
      avgScore: Math.round(avgScore),
      topPerformers,
      employeeOfPeriod,
      employeeOfPeriodIsOverride: !!overrideEmployeeId,
    };
  };

  const years = [...new Set(periods.map((p) => p.year))].sort((a, b) => b - a);

  return (
    <div className="space-y-6 pb-8 sm:pb-10 lg:pb-12 min-w-0 w-full max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title text-foreground">Review Periods</h1>
          <p className="page-subtitle text-muted-foreground">
            Manage periods and view performance data across all review cycles
          </p>
        </div>
        <Button type="button" onClick={() => { setEditingPeriod(null); setDialogOpen(true); }} size="lg">
          <Plus size={18} weight="duotone" className="mr-2" />
          Create Period
        </Button>
      </div>

      {/* Filters */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0">
          <Label htmlFor="year-filter" className="text-sm font-medium">Year</Label>
          <Select id="year-filter" value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="mt-1.5 w-full">
            <option value="all">All Years</option>
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </Select>
        </div>
        <div className="min-w-0">
          <Label htmlFor="type-filter" className="text-sm font-medium">Type</Label>
          <Select id="type-filter" value={filterType} onChange={(e) => setFilterType(e.target.value)} className="mt-1.5 w-full">
            <option value="all">All Types</option>
            <option value="Monthly">Monthly</option>
            <option value="Q1">Q1</option>
            <option value="Q2">Q2</option>
            <option value="Q3">Q3</option>
            <option value="Q4">Q4</option>
            <option value="H1">H1</option>
            <option value="H2">H2</option>
            <option value="Annual">Annual</option>
            <option value="Custom">Custom</option>
          </Select>
        </div>
        <div className="min-w-0">
          <Label htmlFor="status-filter" className="text-sm font-medium">Status</Label>
          <Select id="status-filter" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="mt-1.5 w-full">
            <option value="all">All Statuses</option>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
      </div>

      {filteredPeriods.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No periods found</h3>
            <p className="text-muted-foreground text-center mb-4 max-w-sm">
              {periods.length === 0
                ? 'Create your first review period to get started'
                : 'No periods match the current filters'}
            </p>
            <Button type="button" onClick={() => { setEditingPeriod(null); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Create Period
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {filteredPeriods.map((period) => {
            const stats = getPeriodStats(period);
            const daysRemaining = period.status === 'active' ? getDaysRemaining(period.endDate) : null;
            return (
              <Card key={period.id} className="overflow-hidden border-border/60 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        <PeriodBadge period={period} />
                        {stats.completedCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setPeriodFormsPeriodId(period.id)}
                            className="text-sm font-medium text-primary hover:underline"
                          >
                            View completed forms ({stats.completedCount})
                          </button>
                        )}
                      </div>
                      <CardTitle className="text-xl">{period.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {formatDateRange(period.startDate, period.endDate)}
                        {daysRemaining !== null && daysRemaining > 0 && (
                          <span className="ml-2 text-amber-600 font-medium">• {daysRemaining} days remaining</span>
                        )}
                        {daysRemaining !== null && daysRemaining <= 0 && period.status === 'active' && (
                          <span className="ml-2 text-red-600 font-medium">• Period ended</span>
                        )}
                      </CardDescription>
                      {period.description && (
                        <p className="text-sm text-muted-foreground mt-2">{period.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <Select
                        value={period.status}
                        onChange={(e) => handleStatusChange(period, e.target.value as ReviewPeriod['status'])}
                        className="w-[130px]"
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
                        onClick={() => { setEditingPeriod(period.id); setDialogOpen(true); }}
                        title="Edit period"
                      >
                        <Pencil size={16} weight="duotone" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-500 hover:text-white hover:border-red-500"
                        onClick={() => handleDeleteClick(period.id, period.name)}
                        title="Delete period"
                      >
                        <Trash size={16} weight="duotone" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  <div className="grid gap-4 grid-cols-2 md:grid-cols-4 min-w-0">
                    <div className="rounded-lg bg-muted/40 dark:bg-muted/20 p-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Appraisals</div>
                      <div className="text-xl font-bold mt-0.5">{stats.completedCount}/{stats.totalToComplete}</div>
                      <div className="text-xs text-muted-foreground mt-1">{Math.round(stats.completionRate)}% complete</div>
                    </div>
                    <div className="rounded-lg bg-muted/40 dark:bg-muted/20 p-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg Score</div>
                      <div className="text-xl font-bold mt-0.5">{stats.avgScore}%</div>
                    </div>
                    <div className="rounded-lg bg-muted/40 dark:bg-muted/20 p-3">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completion</div>
                      <div className="text-xl font-bold mt-0.5">{Math.round(stats.completionRate)}%</div>
                    </div>
                    <div className="rounded-lg bg-muted/40 dark:bg-muted/20 p-3 min-w-0">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Top performers</div>
                      {stats.topPerformers.length > 0 ? (
                        <div className="space-y-1">
                          {stats.topPerformers.map((performer, idx) => (
                            <div key={performer.employeeId} className="flex items-center gap-2 text-sm truncate">
                              <Trophy size={14} weight="duotone" className={idx === 0 ? 'text-amber-500 shrink-0' : 'text-muted-foreground shrink-0'} />
                              <span className="font-medium truncate">{performer.employee?.name}</span>
                              <span className="text-muted-foreground shrink-0">({Math.round(performer.percentage)}%)</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No data yet</div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 dark:bg-muted/10 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Trophy size={16} weight="duotone" className="text-amber-500 shrink-0" />
                      <span className="text-sm font-semibold text-foreground">Employee of the Period</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">Awarded for this period (override if different from top scorer).</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground min-w-0 truncate">
                        {stats.employeeOfPeriod ? `${stats.employeeOfPeriod.name} (${stats.employeeOfPeriod.role})` : '—'}
                      </span>
                      {stats.employeeOfPeriodIsOverride && (
                        <span className="inline-flex items-center rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200 shrink-0">
                          Override
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          setEditingEotPPeriodId(period.id);
                          setEotPDraftEmployeeId(overrides[period.id] ?? '');
                        }}
                      >
                        <PencilSimple size={14} weight="duotone" className="mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <PeriodDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        periodId={editingPeriod}
        onSuccess={async () => {
          await loadPeriods();
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

      {/* Employee of the Period modal */}
      {editingEotPPeriodId != null && (() => {
        const period = periods.find((p) => p.id === editingEotPPeriodId);
        const periodAppraisals = appraisals.filter((a) => a.reviewPeriodId === editingEotPPeriodId && a.completedAt);
        const employeeScores: Record<string, { total: number; count: number }> = {};
        periodAppraisals.forEach((a) => {
          if (!employeeScores[a.employeeId]) employeeScores[a.employeeId] = { total: 0, count: 0 };
          employeeScores[a.employeeId].total += (a.score / a.maxScore) * 100;
          employeeScores[a.employeeId].count += 1;
        });
        const topScorer = Object.entries(employeeScores)
          .map(([employeeId, data]) => ({ employeeId, pct: data.total / data.count, employee: employees.find((e) => e.id === employeeId) }))
          .filter((x) => x.employee)
          .sort((a, b) => b.pct - a.pct)[0];
        return createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setEditingEotPPeriodId(null)}
            aria-modal="true"
            role="dialog"
            aria-label="Set Employee of the Period"
          >
            <div
              className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Trophy size={20} weight="duotone" className="text-amber-500" />
                  <h2 className="text-lg font-semibold text-foreground">Employee of the Period</h2>
                </div>
                <button type="button" onClick={() => setEditingEotPPeriodId(null)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Close">
                  <X size={20} weight="duotone" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Choose who was awarded for <span className="font-medium text-foreground">{period?.name ?? 'this period'}</span>.
                </p>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">Awarded to</label>
                  <Select value={eotPDraftEmployeeId} onChange={(e) => setEotPDraftEmployeeId(e.target.value)} className="w-full text-sm">
                    <option value="">{topScorer?.employee ? `Same as top scorer (${topScorer.employee.name})` : 'Not set'}</option>
                    {[...employees].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })).map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-muted/30">
                <Button type="button" variant="ghost" onClick={() => setEditingEotPPeriodId(null)}>Cancel</Button>
                <Button
                  type="button"
                  onClick={async () => {
                    const next = { ...overrides };
                    if (eotPDraftEmployeeId) next[editingEotPPeriodId] = eotPDraftEmployeeId;
                    else delete next[editingEotPPeriodId];
                    const displayName = eotPDraftEmployeeId ? employees.find((e) => e.id === eotPDraftEmployeeId)?.name : (topScorer?.employee?.name ?? 'Same as top scorer');
                    try {
                      await saveEmployeeOfPeriodOverrides(next);
                      setEditingEotPPeriodId(null);
                      toast({ title: 'Saved', description: `Employee of the Period for ${period?.name ?? 'period'} set to ${displayName}.`, variant: 'success' });
                      refresh();
                    } catch {
                      toast({ title: 'Error', description: 'Could not save. Please try again.', variant: 'error' });
                    }
                  }}
                >
                  <Check size={18} weight="duotone" className="mr-1.5" />
                  Confirm
                </Button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Completed forms list modal */}
      {periodFormsPeriodId != null && (() => {
        const period = periods.find((p) => p.id === periodFormsPeriodId);
        const list = appraisals.filter((a) => a.reviewPeriodId === periodFormsPeriodId && a.completedAt);
        const nameById = Object.fromEntries(employees.map((e) => [e.id, e.name]));
        const templateById = Object.fromEntries(templates.map((t) => [t.id, t]));
        return createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setPeriodFormsPeriodId(null)}
            aria-modal="true"
            role="dialog"
            aria-label="Completed forms for period"
          >
            <div
              className="bg-card border border-border rounded-xl shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border shrink-0">
                <h2 className="text-lg font-semibold text-foreground truncate flex items-center gap-2">
                  <FileText size={20} weight="duotone" className="text-muted-foreground shrink-0" />
                  {period?.name ?? 'Period'} – completed forms
                </h2>
                <button type="button" onClick={() => setPeriodFormsPeriodId(null)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Close">
                  <X size={20} weight="duotone" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 min-h-0">
                {list.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No completed forms for this period.</p>
                ) : (
                  <ul className="space-y-2">
                    {list.map((a) => {
                      const formName = templateById[a.templateId]?.name ?? a.templateId;
                      const appraiserName = nameById[a.appraiserId] ?? a.appraiserId;
                      const employeeName = nameById[a.employeeId] ?? a.employeeId;
                      return (
                        <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground truncate">{formName}</p>
                            <p className="text-xs text-muted-foreground truncate">{appraiserName} → {employeeName} · {a.score}/{a.maxScore}</p>
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => { setPeriodFormsPeriodId(null); setViewAppraisalId(a.id); }}
                          >
                            <Eye size={16} weight="duotone" className="mr-1" />
                            View
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      <CompletedFormViewModal open={viewAppraisalId != null} onClose={() => setViewAppraisalId(null)} appraisalId={viewAppraisalId} />
    </div>
  );
}
