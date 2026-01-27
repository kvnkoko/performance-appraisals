import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { PeriodBadge } from '@/components/periods/period-badge';
import { getReviewPeriods } from '@/lib/storage';
import { formatDateRange, getDaysRemaining } from '@/lib/period-utils';
import type { ReviewPeriod } from '@/types';
import { Trophy } from 'phosphor-react';

export function HistoricalReviewsPage() {
  const { appraisals, employees } = useApp();
  const [periods, setPeriods] = useState<ReviewPeriod[]>([]);
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

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
    const totalAppraisals = appraisals.filter((a) => a.reviewPeriodId === period.id).length;
    const completedCount = periodAppraisals.length;
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

    return {
      totalAppraisals,
      completedCount,
      completionRate: totalAppraisals > 0 ? (completedCount / totalAppraisals) * 100 : 0,
      avgScore: Math.round(avgScore),
      topPerformers,
    };
  };

  const years = [...new Set(periods.map((p) => p.year))].sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title text-foreground">Historical Reviews</h1>
          <p className="text-muted-foreground mt-2">View performance data across all review periods</p>
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
                      <div className="text-2xl font-bold">{stats.completedCount}/{stats.totalAppraisals}</div>
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
