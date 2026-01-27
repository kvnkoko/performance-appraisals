import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { TrendUp, Trophy, Target, Lightning, TrendDown, Users, ChartBar } from 'phosphor-react';
import { generatePerformanceSummary } from '@/lib/ai-summary';
import { getAppraisals } from '@/lib/storage';
import { getPeriod } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { PerformanceInsight } from '@/lib/ai-summary';

export function ReviewsPage() {
  const { employees, appraisals } = useApp();
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [summary, setSummary] = useState<PerformanceInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period] = useState(getPeriod());

  useEffect(() => {
    if (selectedEmployee) {
      loadSummary();
    } else {
      setSummary(null);
    }
  }, [selectedEmployee, period, appraisals]);

  const loadSummary = async () => {
    if (!selectedEmployee) return;
    setLoading(true);
    setError(null);
    try {
      const allAppraisals = await getAppraisals();
      const employeeAppraisals = allAppraisals.filter((a) => a.employeeId === selectedEmployee && a.completedAt);
      
      if (employeeAppraisals.length === 0) {
        setError('No completed appraisals found for this employee.');
        setSummary(null);
        return;
      }
      
      const insight = await generatePerformanceSummary(selectedEmployee, employeeAppraisals);
      setSummary(insight);
    } catch (error) {
      console.error('Failed to generate summary:', error);
      setError('Failed to generate performance summary. Please try again.');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  // Calculate leaderboard
  const employeeScores = employees.map((employee) => {
    const employeeAppraisals = appraisals.filter(
      (a) => a.employeeId === employee.id && a.completedAt
    );
    const totalScore = employeeAppraisals.reduce((sum, a) => sum + a.score, 0);
    const totalMaxScore = employeeAppraisals.reduce((sum, a) => sum + a.maxScore, 0);
    const percentage = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
    return { employee, percentage, totalScore, totalMaxScore };
  });

  const sortedScores = [...employeeScores]
    .filter((e) => e.totalMaxScore > 0)
    .sort((a, b) => b.percentage - a.percentage);

  const topPerformer = sortedScores[0];

  // Chart data with better truncation
  const chartData = sortedScores.slice(0, 10).map((item) => ({
    name: item.employee.name.length > 12
      ? item.employee.name.substring(0, 12) + '...'
      : item.employee.name,
    fullName: item.employee.name,
    score: Math.round(item.percentage),
    role: item.employee.role,
  }));

  const performanceDistribution = [
    { name: 'Excellent', range: '90-100%', value: sortedScores.filter((e) => e.percentage >= 90).length, color: '#10b981' },
    { name: 'Good', range: '75-89%', value: sortedScores.filter((e) => e.percentage >= 75 && e.percentage < 90).length, color: '#3b82f6' },
    { name: 'Satisfactory', range: '60-74%', value: sortedScores.filter((e) => e.percentage >= 60 && e.percentage < 75).length, color: '#f59e0b' },
    { name: 'Needs Improvement', range: '<60%', value: sortedScores.filter((e) => e.percentage < 60).length, color: '#ef4444' },
  ].filter((item) => item.value > 0);

  // Calculate additional stats
  const avgScore = sortedScores.length > 0
    ? sortedScores.reduce((sum, e) => sum + e.percentage, 0) / sortedScores.length
    : 0;
  const excellentCount = sortedScores.filter((e) => e.percentage >= 90).length;
  const needsImprovementCount = sortedScores.filter((e) => e.percentage < 60).length;

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
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="page-title text-foreground">
          Performance Reviews
        </h1>
        <p className="page-subtitle">Comprehensive analytics and performance insights</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-2 glass-subtle bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 dark:from-emerald-950/10 dark:to-emerald-900/5 border-emerald-200/50 dark:border-emerald-800/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-emerald-700/90 dark:text-emerald-400/90">Average Score</CardTitle>
              <ChartBar size={20} weight="duotone" className="text-emerald-600/80 dark:text-emerald-400/80" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{Math.round(avgScore)}%</div>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1.5">Across all employees</p>
          </CardContent>
        </Card>

        <Card className="border-2 glass-subtle bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/10 dark:to-blue-900/5 border-blue-200/50 dark:border-blue-800/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-blue-700/90 dark:text-blue-400/90">Top Performers</CardTitle>
              <Trophy size={20} weight="duotone" className="text-blue-600/80 dark:text-blue-400/80" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{excellentCount}</div>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1.5">90%+ performance</p>
          </CardContent>
        </Card>

        <Card className="border-2 glass-subtle bg-gradient-to-br from-amber-50/50 to-amber-100/30 dark:from-amber-950/10 dark:to-amber-900/5 border-amber-200/50 dark:border-amber-800/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-amber-700/90 dark:text-amber-400/90">Total Evaluated</CardTitle>
              <Users size={20} weight="duotone" className="text-amber-600/80 dark:text-amber-400/80" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">{sortedScores.length}</div>
            <p className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1.5">Employees reviewed</p>
          </CardContent>
        </Card>

        <Card className="border-2 glass-subtle bg-gradient-to-br from-red-50/50 to-red-100/30 dark:from-red-950/10 dark:to-red-900/5 border-red-200/50 dark:border-red-800/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-red-700/90 dark:text-red-400/90">Needs Attention</CardTitle>
              <TrendDown size={20} weight="duotone" className="text-red-600/80 dark:text-red-400/80" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-700 dark:text-red-300">{needsImprovementCount}</div>
            <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1.5">Below 60%</p>
          </CardContent>
        </Card>
      </div>

      {/* Employee Selection */}
      <Card className="border-2">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">View Employee Review</CardTitle>
          <CardDescription className="text-sm">Select an employee to view their detailed performance summary</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="w-full"
          >
            <option value="">Select employee...</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.role})
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {/* Employee Summary */}
      {selectedEmployee && summary && (
        <div className="space-y-6">
          <Card className="border-2 bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="text-2xl font-bold">Performance Summary</CardTitle>
                  <CardDescription className="text-base mt-1">
                    AI-generated insights for <span className="font-semibold text-foreground">{employees.find((e) => e.id === selectedEmployee)?.name || 'Employee'}</span>
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">
                    {summary.percentage}%
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">Overall Score</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-0">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4 p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-emerald-100/50 dark:bg-emerald-900/30">
                      <TrendUp size={20} weight="duotone" className="text-emerald-600/80 dark:text-emerald-400/80" />
                    </div>
                    <h3 className="font-bold text-lg text-emerald-900 dark:text-emerald-100">Key Strengths</h3>
                  </div>
                  {summary.strengths && summary.strengths.length > 0 ? (
                    <ul className="space-y-3">
                      {summary.strengths.map((strength, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 flex-shrink-0" />
                          <span className="text-sm leading-relaxed text-emerald-900 dark:text-emerald-100">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-emerald-700/70 dark:text-emerald-300/70 italic">No significant strengths identified at this time.</p>
                  )}
                </div>

                <div className="space-y-4 p-5 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-amber-100/50 dark:bg-amber-900/30">
                      <Target size={20} weight="duotone" className="text-amber-600/80 dark:text-amber-400/80" />
                    </div>
                    <h3 className="font-bold text-lg text-amber-900 dark:text-amber-100">Areas for Improvement</h3>
                  </div>
                  {summary.improvements && summary.improvements.length > 0 ? (
                    <ul className="space-y-3">
                      {summary.improvements.map((improvement, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                          <span className="text-sm leading-relaxed text-amber-900 dark:text-amber-100">{improvement}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-amber-700/70 dark:text-amber-300/70 italic">No specific improvement areas identified at this time.</p>
                  )}
                </div>
              </div>

              {summary.narrative && (
                <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-blue-100/50 dark:bg-blue-900/30">
                      <Lightning size={20} weight="duotone" className="text-blue-600/80 dark:text-blue-400/80" />
                    </div>
                    <h3 className="font-bold text-lg text-blue-900 dark:text-blue-100">Narrative Summary</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-blue-900 dark:text-blue-100 whitespace-pre-line">{summary.narrative}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {loading && (
        <Card className="border-2">
          <CardContent className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mb-4"></div>
            <p className="text-muted-foreground font-medium">Generating performance summary...</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-2 border-destructive/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-destructive">
              <TrendDown size={24} weight="duotone" />
              <div>
                <p className="font-semibold">Error</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Performer Spotlight */}
      {topPerformer && (
        <Card className="border-2 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-yellow-950/20 border-amber-300 dark:border-amber-700 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                  <div className="relative">
                  <div className="absolute inset-0 bg-amber-400/20 blur-2xl rounded-full"></div>
                  <div className="relative bg-gradient-to-br from-amber-400 to-orange-500 p-4 rounded-2xl shadow-lg">
                    <Trophy size={40} weight="duotone" className="text-white" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy size={18} weight="duotone" className="text-amber-600/90 dark:text-amber-400/90" />
                    <span className="text-xs font-semibold text-amber-700/90 dark:text-amber-400/90 uppercase tracking-wide">Employee of the Month</span>
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-1">{topPerformer.employee.name}</h3>
                  <p className="text-sm text-muted-foreground">{topPerformer.employee.role}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-5xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">
                  {Math.round(topPerformer.percentage)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {topPerformer.totalScore}/{topPerformer.totalMaxScore} points
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analytics Grid */}
      {sortedScores.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Performers Leaderboard */}
          <Card className="border-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Trophy size={20} weight="duotone" className="text-amber-600/80" />
                Top Performers
              </CardTitle>
              <CardDescription className="text-sm">Performance leaderboard ranking</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                {sortedScores.slice(0, 10).map((item, idx) => {
                  const isTopThree = idx < 3;
                  return (
                    <div
                      key={item.employee.id}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                        isTopThree
                          ? 'bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800'
                          : 'bg-muted/30 hover:bg-muted/50 border-border'
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                          idx === 0
                            ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg'
                            : idx === 1
                            ? 'bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 text-white'
                            : idx === 2
                            ? 'bg-gradient-to-br from-amber-300 to-amber-400 text-white'
                            : 'bg-muted text-foreground'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-base truncate">{item.employee.name}</div>
                          <div className="text-sm text-muted-foreground truncate">{item.employee.role}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <div className={`text-lg font-bold ${
                          item.percentage >= 90
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : item.percentage >= 75
                            ? 'text-blue-600 dark:text-blue-400'
                            : item.percentage >= 60
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {Math.round(item.percentage)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.totalScore}/{item.totalMaxScore}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Performance Distribution */}
          <Card className="border-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Target size={20} weight="duotone" className="text-blue-600/80" />
                Performance Distribution
              </CardTitle>
              <CardDescription className="text-sm">Distribution across performance levels</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              {performanceDistribution.length > 0 ? (
                <div className="space-y-6">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={performanceDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                        outerRadius={100}
                        innerRadius={40}
                        fill="#8884d8"
                        dataKey="value"
                        stroke="none"
                      >
                        {performanceDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-background border rounded-lg shadow-xl p-3">
                                <p className="font-semibold text-sm">{data.name}</p>
                                <p className="text-xs text-muted-foreground">{data.range}</p>
                                <p className="text-sm font-medium mt-1">
                                  <span style={{ color: data.color }}>{data.value}</span> employees
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-3">
                    {performanceDistribution.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border"
                      >
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{item.name}</div>
                          <div className="text-xs text-muted-foreground">{item.range}</div>
                        </div>
                        <div className="text-lg font-bold flex-shrink-0">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                  <ChartBar size={48} weight="duotone" className="mx-auto mb-3 opacity-30" />
                  <p className="text-muted-foreground">No data available</p>
                </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance Scores Chart */}
      {chartData.length > 0 && (
        <Card className="border-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <ChartBar size={20} weight="duotone" className="text-purple-600/80" />
                Performance Scores
              </CardTitle>
            <CardDescription className="text-sm">Top 10 performers visualization</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.9} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 12 }}
                  interval={0}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Score (%)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="score"
                  fill="url(#colorScore)"
                  radius={[8, 8, 0, 0]}
                  stroke="#6366f1"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
