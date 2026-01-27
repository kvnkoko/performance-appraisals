import { useEffect, useState, useMemo } from 'react';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ChartLineUp, 
  TrendUp, 
  TrendDown,
  Star,
  Target,
  Calendar,
  Info,
  Lightning
} from 'phosphor-react';
import { generatePerformanceSummary } from '@/lib/ai-summary';
import type { PerformanceInsight } from '@/lib/ai-summary';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import type { Appraisal, Template, Category } from '@/types';

interface CategoryScore {
  name: string;
  score: number;
  maxScore: number;
  percentage: number;
}

export function MyPerformancePage() {
  const { appraisals, templates, reviewPeriods, employees, loading } = useApp();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [narrativeSummary, setNarrativeSummary] = useState<PerformanceInsight | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  useEffect(() => {
    const storedEmployeeId = localStorage.getItem('employeeId');
    if (storedEmployeeId) {
      setEmployeeId(storedEmployeeId);
    }
  }, []);

  // Get all completed appraisals for this employee (where they were appraised)
  const myAppraisals = useMemo(() => {
    if (!employeeId) return [];
    return appraisals.filter(a => a.employeeId === employeeId && a.completedAt);
  }, [appraisals, employeeId]);

  // Get unique review periods that have appraisals for this employee
  const availablePeriods = useMemo(() => {
    const periodIds = [...new Set(myAppraisals.map(a => a.reviewPeriodId))];
    return reviewPeriods.filter(p => periodIds.includes(p.id));
  }, [myAppraisals, reviewPeriods]);

  // Auto-select the most recent period
  useEffect(() => {
    if (availablePeriods.length > 0 && !selectedPeriodId) {
      // Sort by end date descending and pick the most recent
      const sorted = [...availablePeriods].sort(
        (a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
      );
      setSelectedPeriodId(sorted[0].id);
    }
  }, [availablePeriods, selectedPeriodId]);

  // Filter appraisals by selected period
  const periodAppraisals = useMemo(() => {
    if (!selectedPeriodId) return myAppraisals;
    return myAppraisals.filter(a => a.reviewPeriodId === selectedPeriodId);
  }, [myAppraisals, selectedPeriodId]);

  // Load AI narrative summary when period or appraisals change
  useEffect(() => {
    if (!employeeId || periodAppraisals.length === 0) {
      setNarrativeSummary(null);
      return;
    }
    let cancelled = false;
    setNarrativeLoading(true);
    generatePerformanceSummary(employeeId, periodAppraisals)
      .then((insight) => {
        if (!cancelled) setNarrativeSummary(insight);
      })
      .catch(() => {
        if (!cancelled) setNarrativeSummary(null);
      })
      .finally(() => {
        if (!cancelled) setNarrativeLoading(false);
      });
    return () => { cancelled = true; };
  }, [employeeId, periodAppraisals]);

  // Calculate overall score
  const overallStats = useMemo(() => {
    if (periodAppraisals.length === 0) {
      return { totalScore: 0, maxScore: 0, percentage: 0, count: 0 };
    }
    
    const totalScore = periodAppraisals.reduce((sum, a) => sum + a.score, 0);
    const maxScore = periodAppraisals.reduce((sum, a) => sum + a.maxScore, 0);
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    
    return { totalScore, maxScore, percentage, count: periodAppraisals.length };
  }, [periodAppraisals]);

  // Calculate category breakdown (aggregate across all appraisals, not showing individual reviewers)
  const categoryScores = useMemo((): CategoryScore[] => {
    const categoryMap = new Map<string, { score: number; maxScore: number }>();
    
    periodAppraisals.forEach(appraisal => {
      const template = templates.find(t => t.id === appraisal.templateId);
      if (!template || !template.categories) return;
      
      template.categories.forEach(category => {
        const existing = categoryMap.get(category.categoryName) || { score: 0, maxScore: 0 };
        
        // Calculate score for this category from responses
        category.items.forEach(item => {
          const response = appraisal.responses.find(r => r.questionId === item.id);
          if (response && item.type === 'rating-1-5') {
            const rating = Number(response.value);
            if (rating >= 1 && rating <= 5) {
              existing.score += rating * item.weight;
              existing.maxScore += 5 * item.weight;
            }
          }
        });
        
        categoryMap.set(category.categoryName, existing);
      });
    });
    
    return Array.from(categoryMap.entries())
      .map(([name, { score, maxScore }]) => ({
        name,
        score: Math.round(score * 10) / 10,
        maxScore: Math.round(maxScore * 10) / 10,
        percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
      }))
      .sort((a, b) => b.percentage - a.percentage);
  }, [periodAppraisals, templates]);

  // Identify strengths and areas for improvement
  const insights = useMemo(() => {
    if (categoryScores.length === 0) return { strengths: [], improvements: [] };
    
    const strengths = categoryScores.filter(c => c.percentage >= 80).slice(0, 3);
    const improvements = categoryScores.filter(c => c.percentage < 70).slice(-3).reverse();
    
    return { strengths, improvements };
  }, [categoryScores]);

  // Get performance rating label
  const getPerformanceLabel = (percentage: number) => {
    if (percentage >= 90) return { label: 'Outstanding', color: 'text-purple-500' };
    if (percentage >= 80) return { label: 'Excellent', color: 'text-blue-500' };
    if (percentage >= 70) return { label: 'Good', color: 'text-green-500' };
    if (percentage >= 60) return { label: 'Satisfactory', color: 'text-amber-500' };
    return { label: 'Needs Improvement', color: 'text-red-500' };
  };

  const performanceLabel = getPerformanceLabel(overallStats.percentage);
  const selectedPeriod = availablePeriods.find(p => p.id === selectedPeriodId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!employeeId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="p-6 text-center">
          <Info size={48} weight="duotone" className="mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Not linked to an employee</h3>
          <p className="text-muted-foreground">
            Your account is not linked to an employee profile.
          </p>
        </Card>
      </div>
    );
  }

  if (myAppraisals.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Performance</h1>
          <p className="text-muted-foreground mt-2">Your performance review summary</p>
        </div>
        
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ChartLineUp size={48} weight="duotone" className="text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No performance reviews yet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Once your colleagues complete their reviews for you, your performance summary will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const chartColors = ['#8B5CF6', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Performance</h1>
          <p className="text-muted-foreground mt-2">Your aggregated performance review summary</p>
        </div>
        
        {/* Period Selector */}
        {availablePeriods.length > 1 && (
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-muted-foreground" />
            <select
              value={selectedPeriodId || ''}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="border rounded-lg px-3 py-2 bg-background"
            >
              {availablePeriods.map(period => (
                <option key={period.id} value={period.id}>
                  {period.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Privacy Notice */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <Info size={20} weight="duotone" className="text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800 dark:text-blue-200">
          <p className="font-medium">About your performance summary</p>
          <p className="mt-1">
            This summary shows aggregated scores from {overallStats.count} review{overallStats.count !== 1 ? 's' : ''}.
            Individual reviewer feedback is kept confidential to encourage honest feedback.
          </p>
        </div>
      </div>

      {/* Overall Score */}
      <Card className="overflow-hidden">
        <div className={`h-2 ${
          overallStats.percentage >= 80 ? 'bg-gradient-to-r from-green-500 to-blue-500' :
          overallStats.percentage >= 60 ? 'bg-gradient-to-r from-amber-500 to-green-500' :
          'bg-gradient-to-r from-red-500 to-amber-500'
        }`} style={{ width: `${overallStats.percentage}%` }} />
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Overall Performance Score</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-5xl font-bold">{overallStats.percentage}%</span>
                <span className={`text-lg font-semibold ${performanceLabel.color}`}>
                  {performanceLabel.label}
                </span>
              </div>
              {selectedPeriod && (
                <p className="text-sm text-muted-foreground mt-2">
                  {selectedPeriod.name} • Based on {overallStats.count} review{overallStats.count !== 1 ? 's' : ''}
                </p>
              )}
            </div>
            <div className="hidden sm:block">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie
                    data={[
                      { value: overallStats.percentage },
                      { value: 100 - overallStats.percentage }
                    ]}
                    innerRadius={35}
                    outerRadius={55}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                  >
                    <Cell fill="hsl(var(--primary))" />
                    <Cell fill="hsl(var(--muted))" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Narrative Summary */}
      {(narrativeLoading || narrativeSummary?.narrative) && (
        <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-blue-100/50 dark:bg-blue-900/30">
              <Lightning size={20} weight="duotone" className="text-blue-600/80 dark:text-blue-400/80" />
            </div>
            <h3 className="font-bold text-lg text-blue-900 dark:text-blue-100">Narrative Summary</h3>
          </div>
          {narrativeLoading ? (
            <p className="text-sm text-blue-700/70 dark:text-blue-300/70 italic">Generating summary...</p>
          ) : narrativeSummary?.narrative ? (
            <p className="text-sm leading-relaxed text-blue-900 dark:text-blue-100 whitespace-pre-line">{narrativeSummary.narrative}</p>
          ) : null}
        </div>
      )}

      {/* Strengths and Improvements */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendUp size={20} weight="duotone" className="text-green-500" />
              Key Strengths
            </CardTitle>
            <CardDescription>Areas where you excel</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.strengths.length > 0 ? (
              <div className="space-y-3">
                {insights.strengths.map((cat, idx) => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10">
                      <Star size={16} weight="fill" className="text-green-500" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{cat.name}</div>
                      <div className="text-sm text-muted-foreground">{cat.percentage}% score</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Not enough data to identify strengths yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target size={20} weight="duotone" className="text-amber-500" />
              Areas for Growth
            </CardTitle>
            <CardDescription>Focus areas for development</CardDescription>
          </CardHeader>
          <CardContent>
            {insights.improvements.length > 0 ? (
              <div className="space-y-3">
                {insights.improvements.map((cat, idx) => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10">
                      <TrendDown size={16} weight="duotone" className="text-amber-500" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{cat.name}</div>
                      <div className="text-sm text-muted-foreground">{cat.percentage}% score</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Great job! No significant areas for improvement identified.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      {categoryScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance by Category</CardTitle>
            <CardDescription>Breakdown of scores across different evaluation areas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryScores.map((cat, idx) => (
                <div key={cat.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{cat.name}</span>
                    <span className={`text-sm font-semibold ${
                      cat.percentage >= 80 ? 'text-green-500' :
                      cat.percentage >= 60 ? 'text-amber-500' :
                      'text-red-500'
                    }`}>
                      {cat.percentage}%
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        cat.percentage >= 80 ? 'bg-green-500' :
                        cat.percentage >= 60 ? 'bg-amber-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
