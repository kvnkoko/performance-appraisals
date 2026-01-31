import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { PeriodSelector } from '@/components/periods/period-selector';
import { Button } from '@/components/ui/button';
import { TrendUp, Trophy, Target, Lightning, TrendDown, Users, ChartBar, Calendar, FileText, Eye, ListBullets, X } from 'phosphor-react';
import { generatePerformanceSummary } from '@/lib/ai-summary';
import { getAppraisals } from '@/lib/storage';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { PerformanceInsight } from '@/lib/ai-summary';
import { CompletedFormViewModal } from '@/components/shared/completed-form-view-modal';
import { RATING_LABELS } from '@/types';

/** Map overall score percentage to a 1–5 band for bar chart color. */
function percentageToRatingBand(pct: number): 1 | 2 | 3 | 4 | 5 {
  if (pct >= 80) return 5;
  if (pct >= 60) return 4;
  if (pct >= 40) return 3;
  if (pct >= 20) return 2;
  return 1;
}

const RATING_BAND_COLORS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: '#ef4444',
  2: '#f59e0b',
  3: '#22c55e',
  4: '#3b82f6',
  5: '#8b5cf6',
};

export function ReviewsPage() {
  const { employees, appraisals, templates, reviewPeriods, settings } = useApp();
  const [viewAppraisalId, setViewAppraisalId] = useState<string | null>(null);
  const [showAllRankings, setShowAllRankings] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [summary, setSummary] = useState<PerformanceInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNeedsAttentionPopup, setShowNeedsAttentionPopup] = useState(false);
  const summarySectionRef = useRef<HTMLDivElement>(null);

  const selectedPeriod = useMemo(
    () => (selectedPeriodId ? reviewPeriods.find((p) => p.id === selectedPeriodId) : null),
    [selectedPeriodId, reviewPeriods]
  );
  const periodLabel = selectedPeriod ? selectedPeriod.name : 'Select period';

  useEffect(() => {
    if (reviewPeriods.length > 0 && !selectedPeriodId) {
      const sorted = [...reviewPeriods].sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        const order = ['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'Annual', 'Custom'];
        return order.indexOf(a.type) - order.indexOf(b.type);
      });
      setSelectedPeriodId(sorted[0].id);
    }
  }, [reviewPeriods, selectedPeriodId]);

  useEffect(() => {
    if (selectedEmployee && selectedPeriodId) {
      loadSummary();
    } else {
      setSummary(null);
      if (!selectedPeriodId) setError(null);
    }
  }, [selectedEmployee, selectedPeriodId, appraisals]);

  const loadSummary = async () => {
    if (!selectedEmployee || !selectedPeriodId) return;
    setLoading(true);
    setError(null);
    try {
      const allAppraisals = await getAppraisals();
      const employeeAppraisals = allAppraisals.filter(
        (a) =>
          a.employeeId === selectedEmployee &&
          a.reviewPeriodId === selectedPeriodId &&
          a.completedAt
      );
      if (employeeAppraisals.length === 0) {
        setError(`No completed appraisals for this employee in ${periodLabel}.`);
        setSummary(null);
        return;
      }
      const insight = await generatePerformanceSummary(selectedEmployee, employeeAppraisals);
      setSummary(insight);
    } catch (err) {
      console.error('Failed to generate summary:', err);
      setError('Failed to generate performance summary. Please try again.');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const employeeIds = new Set(employees.map((e) => e.id));
  const validAppraisals = useMemo(
    () =>
      appraisals.filter(
        (a) =>
          a.completedAt &&
          employeeIds.has(a.employeeId) &&
          employeeIds.has(a.appraiserId) &&
          (!selectedPeriodId || a.reviewPeriodId === selectedPeriodId)
      ),
    [appraisals, employeeIds, selectedPeriodId]
  );

  const employeeScores = employees.map((employee) => {
    const employeeAppraisals = validAppraisals.filter((a) => a.employeeId === employee.id);
    const totalScore = employeeAppraisals.reduce((sum, a) => sum + a.score, 0);
    const totalMaxScore = employeeAppraisals.reduce((sum, a) => sum + a.maxScore, 0);
    const percentage = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
    return { employee, percentage, totalScore, totalMaxScore };
  });

  const sortedScores = [...employeeScores]
    .filter((e) => e.totalMaxScore > 0)
    .sort((a, b) => b.percentage - a.percentage);

  const topPerformer = sortedScores[0];
  const overrideEmployeeId = selectedPeriodId ? (settings.employeeOfPeriodOverrides ?? {})[selectedPeriodId] : undefined;
  const effectiveEmployeeOfPeriod = useMemo(() => {
    if (overrideEmployeeId) {
      const emp = employees.find((e) => e.id === overrideEmployeeId);
      const scoreEntry = sortedScores.find((s) => s.employee.id === overrideEmployeeId);
      if (emp) return { employee: emp, percentage: scoreEntry?.percentage ?? 0, totalScore: scoreEntry?.totalScore ?? 0, totalMaxScore: scoreEntry?.totalMaxScore ?? 0, isOverride: true };
    }
    return topPerformer ? { ...topPerformer, isOverride: false } : null;
  }, [overrideEmployeeId, employees, sortedScores, topPerformer]);

  // Chart data: full names for horizontal bar, color by 1–5 band
  const chartData = sortedScores.slice(0, 10).map((item) => {
    const band = percentageToRatingBand(item.percentage);
    return {
      name: item.employee.name,
      fullName: item.employee.name,
      score: Math.round(item.percentage),
      role: item.employee.role,
      band,
      fill: RATING_BAND_COLORS[band],
    };
  });

  // 1–5 rating distribution from actual question responses (how many times each rating was selected)
  const ratingCountsFromResponses = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    validAppraisals.forEach((a) => {
      (a.responses ?? []).forEach((r) => {
        const v = typeof r.value === 'number' ? r.value : Number(r.value);
        if (Number.isInteger(v) && v >= 1 && v <= 5) counts[v as 1 | 2 | 3 | 4 | 5]++;
      });
    });
    return counts;
  }, [validAppraisals]);

  const performanceDistribution = [1, 2, 3, 4, 5].map((band) => ({
    band,
    name: `Rating ${band}: ${RATING_LABELS[band as 1].label}`,
    range: 'Selected in forms',
    value: ratingCountsFromResponses[band as 1],
    color: RATING_BAND_COLORS[band as 1],
  }));

  // Calculate additional stats
  const avgScore = sortedScores.length > 0
    ? sortedScores.reduce((sum, e) => sum + e.percentage, 0) / sortedScores.length
    : 0;
  const excellentCount = sortedScores.filter((e) => e.percentage >= 90).length;
  const needsImprovementCount = sortedScores.filter((e) => e.percentage < 60).length;
  const needsAttentionScores = useMemo(
    () =>
      [...sortedScores]
        .filter((e) => e.percentage < 60)
        .sort((a, b) => a.percentage - b.percentage),
    [sortedScores]
  );

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-semibold text-sm">{data.fullName || data.name}</p>
          {data.role && <p className="text-xs text-muted-foreground">{data.role}</p>}
          <p className="text-sm font-medium mt-1">
            <span className="text-accent">{payload[0].value}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 pb-8 sm:pb-10 lg:pb-12 min-w-0 max-w-full">
      {/* Header + Period selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title text-foreground">Performance Reviews</h1>
          <p className="page-subtitle text-muted-foreground">Rankings and analytics by review period</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={18} weight="duotone" className="text-muted-foreground/70" />
          <PeriodSelector
            value={selectedPeriodId ?? undefined}
            onChange={setSelectedPeriodId}
            showActiveOnly={false}
            showCreateOption={false}
            className="min-w-[200px]"
          />
        </div>
      </div>

      {!selectedPeriodId ? (
        <Card className="border-2 border-dashed">
          <CardContent className="py-10 px-4 text-center">
            <Calendar size={40} weight="duotone" className="mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-medium text-foreground">Select a review period</p>
            <p className="text-sm text-muted-foreground mt-1">Choose a period above to see Employee of the Period rankings, metrics, and distribution for that period.</p>
          </CardContent>
        </Card>
      ) : (
        <>
      {/* Key metrics – compact, period-scoped */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border glass-subtle bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 dark:from-emerald-950/10 dark:to-emerald-900/5 border-emerald-200/50 dark:border-emerald-800/30">
          <CardHeader className="p-3 pb-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-emerald-700/90 dark:text-emerald-400/90">Average Score</CardTitle>
              <ChartBar size={16} weight="duotone" className="text-emerald-600/80 dark:text-emerald-400/80" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{Math.round(avgScore)}%</div>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">{periodLabel}</p>
          </CardContent>
        </Card>
        <Card className="border glass-subtle bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/10 dark:to-blue-900/5 border-blue-200/50 dark:border-blue-800/30">
          <CardHeader className="p-3 pb-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-blue-700/90 dark:text-blue-400/90">Top Performers</CardTitle>
              <Trophy size={16} weight="duotone" className="text-blue-600/80 dark:text-blue-400/80" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{excellentCount}</div>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-0.5">90%+ in {periodLabel}</p>
          </CardContent>
        </Card>
        <Card className="border glass-subtle bg-gradient-to-br from-amber-50/50 to-amber-100/30 dark:from-amber-950/10 dark:to-amber-900/5 border-amber-200/50 dark:border-amber-800/30">
          <CardHeader className="p-3 pb-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-amber-700/90 dark:text-amber-400/90">Total Evaluated</CardTitle>
              <Users size={16} weight="duotone" className="text-amber-600/80 dark:text-amber-400/80" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{sortedScores.length}</div>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-0.5">In {periodLabel}</p>
          </CardContent>
        </Card>
        <Card className="border glass-subtle bg-gradient-to-br from-red-50/50 to-red-100/30 dark:from-red-950/10 dark:to-red-900/5 border-red-200/50 dark:border-red-800/30">
          <CardHeader className="p-3 pb-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold text-red-700/90 dark:text-red-400/90">Needs Attention</CardTitle>
              <TrendDown size={16} weight="duotone" className="text-red-600/80 dark:text-red-400/80" />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">{needsImprovementCount}</div>
            <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-0.5">Below 60% in {periodLabel}</p>
            {needsImprovementCount > 0 && (
              <button
                type="button"
                onClick={() => setShowNeedsAttentionPopup(true)}
                className="mt-2 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 underline underline-offset-2"
              >
                See who →
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Who needs attention – popup */}
      {showNeedsAttentionPopup && needsAttentionScores.length > 0 && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowNeedsAttentionPopup(false)}
          aria-modal="true"
          role="dialog"
          aria-label="Who needs attention"
        >
          <div
            className="bg-card border border-red-200/60 dark:border-red-800/40 rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-border flex-shrink-0 bg-gradient-to-br from-red-50/50 to-transparent dark:from-red-950/20">
              <div className="flex items-center gap-2">
                <TrendDown size={20} weight="duotone" className="text-red-600/80 dark:text-red-400/80" />
                <div>
                  <h2 className="text-base font-semibold text-foreground">Who needs attention</h2>
                  <p className="text-xs text-muted-foreground">Below 60% in {periodLabel}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNeedsAttentionPopup(false)}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X size={20} weight="duotone" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {needsAttentionScores.map(({ employee, percentage }) => (
                <div
                  key={employee.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-red-200/50 dark:border-red-800/50 bg-background/80 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{employee.name}</p>
                    <p className="text-xs text-muted-foreground">{employee.role}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">{Math.round(percentage)}%</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/50"
                      onClick={() => {
                        setSelectedEmployee(employee.id);
                        setShowNeedsAttentionPopup(false);
                        setTimeout(() => summarySectionRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
                      }}
                    >
                      <Eye size={14} weight="duotone" />
                      View review
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Employee detail – compact */}
      <div ref={summarySectionRef}>
      <Card className="border">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-base font-semibold">View employee review</CardTitle>
          <CardDescription className="text-xs">Performance summary for {periodLabel}</CardDescription>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <Select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="w-full max-w-md"
          >
            <option value="">Select employee...</option>
            {[...employees]
              .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
              .map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.role})
                </option>
              ))}
          </Select>
        </CardContent>
      </Card>

      {/* Employee Summary – compact */}
      {selectedEmployee && summary && (
        <div className="space-y-3">
          <Card className="border bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="p-3 pb-2">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="text-lg font-bold">Performance Summary</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {employees.find((e) => e.id === selectedEmployee)?.name} · {periodLabel}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">
                    {summary.percentage}%
                  </div>
                  <div className="text-xs text-muted-foreground font-medium">Overall score</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 p-3 rounded-lg bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-2">
                    <TrendUp size={16} weight="duotone" className="text-emerald-600/80 dark:text-emerald-400/80" />
                    <h3 className="font-semibold text-sm text-emerald-900 dark:text-emerald-100">Key Strengths</h3>
                  </div>
                  {summary.strengths?.length ? (
                    <ul className="space-y-1.5 text-sm text-emerald-900 dark:text-emerald-100">
                      {summary.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-emerald-700/70 italic">No significant strengths identified.</p>
                  )}
                </div>
                <div className="space-y-2 p-3 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2">
                    <Target size={16} weight="duotone" className="text-amber-600/80 dark:text-amber-400/80" />
                    <h3 className="font-semibold text-sm text-amber-900 dark:text-amber-100">Areas for Improvement</h3>
                  </div>
                  {summary.improvements?.length ? (
                    <ul className="space-y-1.5 text-sm text-amber-900 dark:text-amber-100">
                      {summary.improvements.map((imp, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                          <span>{imp}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-amber-700/70 italic">No specific improvement areas identified.</p>
                  )}
                </div>
              </div>
              {summary.narrative && (
                <div className="p-3 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightning size={16} weight="duotone" className="text-blue-600/80 dark:text-blue-400/80" />
                    <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-100">Narrative Summary</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-blue-900 dark:text-blue-100 whitespace-pre-line">{summary.narrative}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      </div>

      {/* Individual completed forms for selected employee in selected period */}
      {selectedEmployee && selectedPeriodId && (() => {
        const employeeForms = validAppraisals.filter((a) => a.employeeId === selectedEmployee);
        if (employeeForms.length === 0) return null;
        const nameById = Object.fromEntries(employees.map((e) => [e.id, e.name]));
        const templateById = Object.fromEntries(templates.map((t) => [t.id, t]));
        return (
          <Card className="border">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText size={18} weight="duotone" className="text-muted-foreground" />
                Individual forms
              </CardTitle>
              <CardDescription className="text-xs">
                {employeeForms.length} completed form{employeeForms.length !== 1 ? 's' : ''} for {employees.find((e) => e.id === selectedEmployee)?.name} in {periodLabel}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <ul className="space-y-2">
                {employeeForms.map((a) => {
                  const formName = templateById[a.templateId]?.name ?? a.templateId;
                  const appraiserName = nameById[a.appraiserId] ?? a.appraiserId;
                  return (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-foreground truncate">{formName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          By {appraiserName} · {a.score}/{a.maxScore}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewAppraisalId(a.id)}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-foreground bg-muted hover:bg-muted/80 transition-colors"
                        title="View form"
                      >
                        <Eye size={16} weight="duotone" />
                        View
                      </button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        );
      })()}

      {loading && (
        <Card className="border">
          <CardContent className="py-8 px-4 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mb-2" />
            <p className="text-sm text-muted-foreground">Generating performance summary...</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border border-destructive/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-destructive">
              <TrendDown size={20} weight="duotone" />
              <div>
                <p className="font-semibold text-sm">Error</p>
                <p className="text-xs text-muted-foreground">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recognition: Top performer (data) + Who was awarded for this period */}
      {(topPerformer || effectiveEmployeeOfPeriod) && (
        <Card className="border overflow-hidden bg-gradient-to-br from-muted/30 via-background to-muted/20 dark:from-muted/20 dark:to-muted/10">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy size={16} weight="duotone" className="text-amber-500/80" />
              Recognition · {periodLabel}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Left: Top performer from data */}
              {topPerformer && (
                <div className="rounded-xl border bg-card p-4 shadow-sm border-blue-200/50 dark:border-blue-800/40 bg-gradient-to-br from-blue-50/40 to-transparent dark:from-blue-950/20 dark:to-transparent">
                  <div className="flex items-center gap-2 mb-2">
                    <ChartBar size={18} weight="duotone" className="text-blue-600/90 dark:text-blue-400/90" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-blue-700/90 dark:text-blue-300/90">
                      Highest score (data)
                    </span>
                  </div>
                  <p className="font-semibold text-foreground">{topPerformer.employee.name}</p>
                  <p className="text-xs text-muted-foreground mb-2">{topPerformer.employee.role}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {Math.round(topPerformer.percentage)}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {topPerformer.totalScore}/{topPerformer.totalMaxScore} pts
                    </span>
                  </div>
                </div>
              )}
              {/* Right: Employee of the Period (awarded for this period) */}
              {effectiveEmployeeOfPeriod && (
                <div className="rounded-xl border bg-card p-4 shadow-sm border-amber-200/60 dark:border-amber-700/40 bg-gradient-to-br from-amber-50/50 to-transparent dark:from-amber-950/30 dark:to-transparent">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy size={18} weight="duotone" className="text-amber-600/90 dark:text-amber-400/90" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-amber-700/90 dark:text-amber-300/90">
                      Awarded for this period
                    </span>
                  </div>
                  <p className="font-semibold text-foreground">{effectiveEmployeeOfPeriod.employee.name}</p>
                  <p className="text-xs text-muted-foreground mb-2">{effectiveEmployeeOfPeriod.employee.role}</p>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {Math.round(effectiveEmployeeOfPeriod.percentage)}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {effectiveEmployeeOfPeriod.totalScore}/{effectiveEmployeeOfPeriod.totalMaxScore} pts
                    </span>
                    {effectiveEmployeeOfPeriod.isOverride ? (
                      <span className="inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                        Override
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                        Same as top scorer
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analytics grid – compact */}
      {sortedScores.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="border">
            <CardHeader className="p-3 pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Trophy size={18} weight="duotone" className="text-amber-600/80" />
                    Top Performers
                  </CardTitle>
                  <CardDescription className="text-xs">Ranking for {periodLabel}</CardDescription>
                </div>
                {sortedScores.length > 10 && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="flex items-center gap-1.5"
                    onClick={() => setShowAllRankings(true)}
                  >
                    <ListBullets size={16} weight="duotone" />
                    View all ({sortedScores.length})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
                {sortedScores.slice(0, 10).map((item, idx) => {
                  const isTopThree = idx < 3;
                  return (
                    <div
                      key={item.employee.id}
                      className={`flex items-center justify-between py-2.5 px-3 rounded-lg border transition-colors ${
                        isTopThree
                          ? 'bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200/70 dark:border-amber-800/50'
                          : 'bg-muted/30 hover:bg-muted/50 border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                            idx === 0
                              ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow'
                              : idx === 1
                              ? 'bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 text-white'
                              : idx === 2
                              ? 'bg-gradient-to-br from-amber-300 to-amber-400 text-white'
                              : 'bg-muted text-foreground'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{item.employee.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{item.employee.role}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div
                          className={`text-base font-bold ${
                            item.percentage >= 90
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : item.percentage >= 75
                              ? 'text-blue-600 dark:text-blue-400'
                              : item.percentage >= 60
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {Math.round(item.percentage)}%
                        </div>
                        <div className="text-xs text-muted-foreground">{item.totalScore}/{item.totalMaxScore}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {sortedScores.length > 0 && sortedScores.length <= 10 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAllRankings(true)}
                >
                  <ListBullets size={16} weight="duotone" />
                  View full rankings ({sortedScores.length})
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Target size={18} weight="duotone" className="text-blue-600/80" />
                Performance Distribution (1–5 ratings)
              </CardTitle>
              <CardDescription className="text-xs">How many times each rating was selected across all completed forms · {periodLabel}</CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {performanceDistribution.some((d) => d.value > 0) ? (
                <div className="space-y-3">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={performanceDistribution.filter((d) => d.value > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => (percent > 0.05 ? `${name.split(':')[0]} ${(percent * 100).toFixed(0)}%` : '')}
                        outerRadius={80}
                        innerRadius={32}
                        fill="#8884d8"
                        dataKey="value"
                        stroke="none"
                      >
                        {performanceDistribution.filter((d) => d.value > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload?.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-background border rounded-lg shadow-lg p-2.5 text-sm">
                                <p className="font-semibold">{data.name}</p>
                                <p className="text-xs text-muted-foreground">{data.range}</p>
                                <p className="font-medium mt-0.5" style={{ color: data.color }}>{data.value} response{data.value !== 1 ? 's' : ''}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-2">
                    {performanceDistribution.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-xs truncate">{item.name}</div>
                          <div className="text-xs text-muted-foreground">responses</div>
                        </div>
                        <div className="text-sm font-bold flex-shrink-0">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-52 text-muted-foreground">
                  <div className="text-center">
                    <ChartBar size={36} weight="duotone" className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm text-muted-foreground">No data for this period</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {chartData.length > 0 && (
        <Card className="border">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ChartBar size={18} weight="duotone" className="text-purple-600/80" />
              Performance Scores (Top 10)
            </CardTitle>
            <CardDescription className="text-xs">Horizontal bar by score; color = 1–5 rating band · {periodLabel}</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20} minPointSize={8}>
                  {chartData.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
        </>
      )}

      {/* Full rankings modal – portal so overlay covers viewport */}
      {showAllRankings &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
            role="dialog"
            aria-modal="true"
            aria-labelledby="all-rankings-title"
            onClick={() => setShowAllRankings(false)}
          >
            <div
              className="bg-card border rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b shrink-0">
                <h2 id="all-rankings-title" className="text-lg font-semibold flex items-center gap-2">
                  <Trophy size={20} weight="duotone" className="text-amber-600/80" />
                  Full rankings · {periodLabel}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowAllRankings(false)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Close"
                >
                  <X size={20} weight="bold" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-1.5 min-h-0">
                {sortedScores.map((item, idx) => {
                  const isTopThree = idx < 3;
                  return (
                    <div
                      key={item.employee.id}
                      className={`flex items-center justify-between py-2.5 px-3 rounded-lg border transition-colors ${
                        isTopThree
                          ? 'bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200/70 dark:border-amber-800/50'
                          : 'bg-muted/30 border-border'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                            idx === 0
                              ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow'
                              : idx === 1
                              ? 'bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 text-white'
                              : idx === 2
                              ? 'bg-gradient-to-br from-amber-300 to-amber-400 text-white'
                              : 'bg-muted text-foreground'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{item.employee.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{item.employee.role}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div
                          className={`text-base font-bold ${
                            item.percentage >= 90
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : item.percentage >= 75
                              ? 'text-blue-600 dark:text-blue-400'
                              : item.percentage >= 60
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {Math.round(item.percentage)}%
                        </div>
                        <div className="text-xs text-muted-foreground">{item.totalScore}/{item.totalMaxScore}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}

      <CompletedFormViewModal
        open={viewAppraisalId != null}
        onClose={() => setViewAppraisalId(null)}
        appraisalId={viewAppraisalId}
      />
    </div>
  );
}
