import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { PeriodBadge } from '@/components/periods/period-badge';
import { getReviewPeriods, saveEmployeeOfPeriodOverrides } from '@/lib/storage';
import { formatDateRange, getDaysRemaining } from '@/lib/period-utils';
import type { ReviewPeriod } from '@/types';
import { Trophy, FileText, Eye, X, PencilSimple, Check } from 'phosphor-react';
import { CompletedFormViewModal } from '@/components/shared/completed-form-view-modal';
import { useToast } from '@/contexts/toast-context';

export function HistoricalReviewsPage() {
  const { appraisals, assignments, employees, templates, settings, refresh } = useApp();
  const { toast } = useToast();
  const overrides = settings.employeeOfPeriodOverrides ?? {};
  const [periods, setPeriods] = useState<ReviewPeriod[]>([]);
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
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
      setPeriods(data.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        const typeOrder = ['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'Annual', 'Custom'];
        return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
      }));
    } catch (error) {
      console.error('Failed to load periods:', error);
    }
  };

  const filteredPeriods = periods.filter((period) => {
    if (filterYear !== 'all' && period.year !== Number(filterYear)) return false;
    if (filterType !== 'all' && period.type !== filterType) return false;
    if (filterStatus !== 'all' && period.status !== filterStatus) return false;
    return true;
  });

  const getPeriodStats = (period: ReviewPeriod) => {
    const periodAppraisals = appraisals.filter(
      (a) => a.reviewPeriodId === period.id && a.completedAt
    );
    const periodAssignments = assignments.filter((a) => a.reviewPeriodId === period.id);
    const totalAssignments = periodAssignments.length;
    // Count assignments that have a matching completed appraisal (same employee, appraiser, template)
    const assignmentsWithCompletedAppraisal = periodAssignments.filter((a) =>
      periodAppraisals.some(
        (p) =>
          p.employeeId === a.employeeId &&
          p.appraiserId === a.appraiserId &&
          p.templateId === a.templateId
      )
    ).length;
    // Actual completion: assignments that have a matching completed appraisal / total assignments
    const totalToComplete = totalAssignments || periodAppraisals.length || 1;
    const completedCount = totalAssignments > 0 ? assignmentsWithCompletedAppraisal : periodAppraisals.length;
    const completionRate = totalToComplete > 0 ? (completedCount / totalToComplete) * 100 : 0;
    const avgScore = periodAppraisals.length > 0
      ? periodAppraisals.reduce((sum, a) => sum + (a.score / a.maxScore) * 100, 0) / periodAppraisals.length
      : 0;

    // Get top performers
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
    <div className="space-y-6 pb-8 sm:pb-10 lg:pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title text-foreground">Historical Reviews</h1>
          <p className="page-subtitle text-muted-foreground">View performance data across all review periods</p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="text-sm font-medium mb-2 block">Filter by Year</label>
          <Select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
            <option value="all">All Years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">Filter by Type</label>
          <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
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
        <div>
          <label className="text-sm font-medium mb-2 block">Filter by Status</label>
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
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
            <p className="text-muted-foreground">No periods found matching your filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredPeriods.map((period) => {
            const stats = getPeriodStats(period);
            const daysRemaining = period.status === 'active' ? getDaysRemaining(period.endDate) : null;
            
            return (
              <Card key={period.id} className="hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
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
                          <span className="ml-2 text-amber-600 font-medium">
                            • {daysRemaining} days remaining
                          </span>
                        )}
                      </CardDescription>
                      {period.description && (
                        <p className="text-sm text-muted-foreground mt-2">{period.description}</p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Appraisals</div>
                      <div className="text-2xl font-bold">{stats.completedCount}/{stats.totalToComplete}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {Math.round(stats.completionRate)}% complete
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Average Score</div>
                      <div className="text-2xl font-bold">{stats.avgScore}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Completion Rate</div>
                      <div className="text-2xl font-bold">{Math.round(stats.completionRate)}%</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Top Performers</div>
                      {stats.topPerformers.length > 0 ? (
                        <div className="space-y-1">
                          {stats.topPerformers.map((performer, idx) => (
                            <div key={performer.employeeId} className="flex items-center gap-2 text-sm">
                              <Trophy size={16} weight="duotone" className={idx === 0 ? 'text-amber-500/80' : idx === 1 ? 'text-gray-400/80' : 'text-amber-700/80'} />
                              <span className="font-medium">{performer.employee?.name}</span>
                              <span className="text-muted-foreground">({Math.round(performer.percentage)}%)</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No data yet</div>
                      )}
                    </div>
                  </div>
                  {/* Employee of the Period – display + Edit beside name */}
                  <div className="mt-4 pt-4 border-t border-border rounded-lg bg-muted/20 dark:bg-muted/10 p-3 -mx-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Trophy size={16} weight="duotone" className="text-amber-500/80 flex-shrink-0" />
                      <span className="text-sm font-semibold text-foreground">Employee of the Period</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Who was awarded for this period (override if different from top scorer).
                    </p>
                    <div className="flex items-center gap-2 flex-wrap rounded-md border border-border bg-background/80 px-3 py-2">
                      <span className="text-sm font-medium text-foreground min-w-0 truncate">
                        {stats.employeeOfPeriod
                          ? `${stats.employeeOfPeriod.name} (${stats.employeeOfPeriod.role})`
                          : '—'}
                      </span>
                      {stats.employeeOfPeriodIsOverride && (
                        <span className="inline-flex items-center rounded bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200 flex-shrink-0">
                          Override
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEotPPeriodId(period.id);
                          setEotPDraftEmployeeId(overrides[period.id] ?? '');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground bg-muted hover:bg-muted/80 border border-border transition-colors flex-shrink-0"
                      >
                        <PencilSimple size={14} weight="duotone" />
                        Edit
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Employee of the Period – choose and confirm modal */}
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
              <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Trophy size={20} weight="duotone" className="text-amber-500/80" />
                  <h2 className="text-lg font-semibold text-foreground">Employee of the Period</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingEotPPeriodId(null)}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X size={20} weight="duotone" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Choose who was awarded for <span className="font-medium text-foreground">{period?.name ?? 'this period'}</span>. This will be saved and shown in Reviews and Historical Reviews.
                </p>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-2">Awarded to</label>
                  <Select
                    value={eotPDraftEmployeeId}
                    onChange={(e) => setEotPDraftEmployeeId(e.target.value)}
                    className="w-full text-sm"
                  >
                    <option value="">
                      {topScorer?.employee ? `Same as top scorer (${topScorer.employee.name})` : 'Not set'}
                    </option>
                    {[...employees]
                      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
                      .map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.role})
                        </option>
                      ))}
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-muted/30">
                <button
                  type="button"
                  onClick={() => setEditingEotPPeriodId(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
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
                    } catch (err) {
                      toast({ title: 'Error', description: 'Could not save. Please try again.', variant: 'error' });
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90"
                >
                  <Check size={18} weight="duotone" />
                  Confirm
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* List of completed forms for a period (portal) */}
      {periodFormsPeriodId != null && (() => {
        const period = periods.find((p) => p.id === periodFormsPeriodId);
        const list = appraisals.filter(
          (a) => a.reviewPeriodId === periodFormsPeriodId && a.completedAt
        );
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
              <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border flex-shrink-0">
                <h2 className="text-lg font-semibold text-foreground truncate">
                  <FileText size={20} weight="duotone" className="inline-block mr-2 align-middle text-muted-foreground" />
                  {period?.name ?? 'Period'} – completed forms
                </h2>
                <button
                  type="button"
                  onClick={() => setPeriodFormsPeriodId(null)}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X size={20} weight="duotone" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {list.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No completed forms for this period.</p>
                ) : (
                  <ul className="space-y-2">
                    {list.map((a) => {
                      const formName = templateById[a.templateId]?.name ?? a.templateId;
                      const appraiserName = nameById[a.appraiserId] ?? a.appraiserId;
                      const employeeName = nameById[a.employeeId] ?? a.employeeId;
                      return (
                        <li
                          key={a.id}
                          className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground truncate">{formName}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {appraiserName} → {employeeName} · {a.score}/{a.maxScore}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPeriodFormsPeriodId(null);
                              setViewAppraisalId(a.id);
                            }}
                            className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-foreground bg-muted hover:bg-muted/80"
                            title="View form"
                          >
                            <Eye size={16} weight="duotone" />
                            View
                          </button>
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

      <CompletedFormViewModal
        open={viewAppraisalId != null}
        onClose={() => setViewAppraisalId(null)}
        appraisalId={viewAppraisalId}
      />
    </div>
  );
}
