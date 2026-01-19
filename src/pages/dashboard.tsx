import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Users, Link as LinkIcon, CheckCircle, Clock, TrendUp, ChartBar, Activity } from 'phosphor-react';
import { formatDate } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export function Dashboard() {
  const { templates, employees, appraisals, links, loading } = useApp();
  const [stats, setStats] = useState({
    totalTemplates: 0,
    totalEmployees: 0,
    pendingAppraisals: 0,
    completedAppraisals: 0,
    activeLinks: 0,
  });

  useEffect(() => {
    if (!loading) {
      // Only count appraisals where the employee still exists
      const validAppraisals = appraisals.filter((a) => {
        const employee = employees.find((e) => e.id === a.employeeId);
        return employee;
      });
      const completed = validAppraisals.filter((a) => a.completedAt).length;
      const pending = validAppraisals.filter((a) => !a.completedAt).length;
      const activeLinks = links.filter((l) => !l.used && (!l.expiresAt || new Date(l.expiresAt) > new Date())).length;

      setStats({
        totalTemplates: templates.length,
        totalEmployees: employees.length,
        pendingAppraisals: pending,
        completedAppraisals: completed,
        activeLinks,
      });
    }
  }, [templates, employees, appraisals, links, loading]);

  const recentCompletions = appraisals
    .filter((a) => {
      // Only include appraisals where the employee still exists
      const employee = employees.find((e) => e.id === a.employeeId);
      return a.completedAt && employee;
    })
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
    .slice(0, 5);

  const chartData = templates.map((template) => {
    // Only include appraisals where the employee still exists
    const templateAppraisals = appraisals.filter((a) => {
      const employee = employees.find((e) => e.id === a.employeeId);
      return a.templateId === template.id && a.completedAt && employee;
    });
    const avgScore = templateAppraisals.length > 0
      ? templateAppraisals.reduce((sum, a) => sum + (a.score / a.maxScore) * 100, 0) / templateAppraisals.length
      : 0;
    return {
      name: template.name.length > 12 ? template.name.substring(0, 12) + '...' : template.name,
      fullName: template.name,
      score: Math.round(avgScore),
      count: templateAppraisals.length,
    };
  });

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-semibold text-sm">{data.fullName || data.name}</p>
          <p className="text-sm font-medium mt-1">
            <span className="text-accent">{payload[0].value}%</span>
          </p>
          {data.count !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">{data.count} appraisals</p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-muted-foreground text-base">Comprehensive overview of your performance appraisal system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500/20 via-blue-600/10 to-indigo-500/20 dark:from-blue-500/15 dark:via-blue-600/8 dark:to-indigo-500/15 hover:from-blue-500/25 hover:to-indigo-500/25 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/5 to-transparent" />
          <CardHeader className="pb-3 relative z-10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-blue-400 dark:text-blue-300">Templates</CardTitle>
              <div className="p-2 rounded-xl bg-blue-500/20 dark:bg-blue-500/30">
                <FileText size={20} weight="duotone" className="text-blue-400 dark:text-blue-300" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-blue-300 dark:text-blue-200 mb-1">{stats.totalTemplates}</div>
            <p className="text-xs text-blue-400/70 dark:text-blue-300/70 font-medium">Active templates</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/20 via-purple-600/10 to-pink-500/20 dark:from-purple-500/15 dark:via-purple-600/8 dark:to-pink-500/15 hover:from-purple-500/25 hover:to-pink-500/25 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-400/5 to-transparent" />
          <CardHeader className="pb-3 relative z-10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-purple-400 dark:text-purple-300">Employees</CardTitle>
              <div className="p-2 rounded-xl bg-purple-500/20 dark:bg-purple-500/30">
                <Users size={20} weight="duotone" className="text-purple-400 dark:text-purple-300" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-purple-300 dark:text-purple-200 mb-1">{stats.totalEmployees}</div>
            <p className="text-xs text-purple-400/70 dark:text-purple-300/70 font-medium">Total employees</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/20 via-emerald-600/10 to-teal-500/20 dark:from-emerald-500/15 dark:via-emerald-600/8 dark:to-teal-500/15 hover:from-emerald-500/25 hover:to-teal-500/25 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/5 to-transparent" />
          <CardHeader className="pb-3 relative z-10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-emerald-400 dark:text-emerald-300">Completed</CardTitle>
              <div className="p-2 rounded-xl bg-emerald-500/20 dark:bg-emerald-500/30">
                <CheckCircle size={20} weight="duotone" className="text-emerald-400 dark:text-emerald-300" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-emerald-300 dark:text-emerald-200 mb-1">{stats.completedAppraisals}</div>
            <p className="text-xs text-emerald-400/70 dark:text-emerald-300/70 font-medium">Appraisals completed</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-orange-500/20 dark:from-amber-500/15 dark:via-amber-600/8 dark:to-orange-500/15 hover:from-amber-500/25 hover:to-orange-500/25 transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-400/5 to-transparent" />
          <CardHeader className="pb-3 relative z-10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-amber-400 dark:text-amber-300">Pending</CardTitle>
              <div className="p-2 rounded-xl bg-amber-500/20 dark:bg-amber-500/30">
                <Clock size={20} weight="duotone" className="text-amber-400 dark:text-amber-300" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-amber-300 dark:text-amber-200 mb-1">{stats.pendingAppraisals}</div>
            <p className="text-xs text-amber-400/70 dark:text-amber-300/70 font-medium">Awaiting completion</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
                <ChartBar size={20} weight="duotone" className="text-indigo-400" />
              </div>
              Average Scores by Template
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground/80">Performance across different appraisal types</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <defs>
                    <linearGradient id="colorTemplate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.7} />
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
                    fill="url(#colorTemplate)"
                    radius={[8, 8, 0, 0]}
                    stroke="#6366f1"
                    strokeWidth={1}
                  />
                </BarChart>
              </ResponsiveContainer>
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

        <Card className="border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                <Activity size={20} weight="duotone" className="text-emerald-400" />
              </div>
              Recent Completions
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground/80">Latest completed appraisals</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {recentCompletions.length > 0 ? (
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2 scrollbar-thin">
                {recentCompletions.map((appraisal) => {
                  const employee = employees.find((e) => e.id === appraisal.employeeId);
                  const percentage = Math.round((appraisal.score / appraisal.maxScore) * 100);
                  const getColorClass = (pct: number) => {
                    if (pct >= 90) return 'from-emerald-500 to-green-500';
                    if (pct >= 75) return 'from-blue-500 to-indigo-500';
                    if (pct >= 60) return 'from-amber-500 to-orange-500';
                    return 'from-red-500 to-pink-500';
                  };
                  return (
                    <div
                      key={appraisal.id}
                      className="flex items-center justify-between p-4 rounded-xl border-0 glass-subtle hover:glass-card transition-all duration-300 hover:scale-[1.02]"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-base truncate">{employee?.name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {formatDate(appraisal.completedAt!)}
                        </p>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <div className={`text-xl font-bold bg-gradient-to-r ${getColorClass(percentage)} bg-clip-text text-transparent`}>
                          {percentage}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {appraisal.score}/{appraisal.maxScore}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <CheckCircle size={48} weight="duotone" className="mx-auto mb-3 opacity-30" />
                <p className="text-muted-foreground">No completions yet</p>
              </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold text-foreground">Quick Actions</CardTitle>
          <CardDescription className="text-sm text-muted-foreground/80">Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Link to="/templates">
              <div className="group relative overflow-hidden rounded-xl border-0 glass-subtle hover:glass-card transition-all duration-300 hover:scale-[1.02] cursor-pointer p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/30 group-hover:from-blue-500/30 group-hover:to-blue-600/40 transition-all">
                    <FileText size={20} weight="duotone" className="text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-foreground mb-1">Create Template</div>
                    <div className="text-xs text-muted-foreground">Build new appraisal forms</div>
                  </div>
                </div>
              </div>
            </Link>
            <Link to="/links">
              <div className="group relative overflow-hidden rounded-xl border-0 glass-subtle hover:glass-card transition-all duration-300 hover:scale-[1.02] cursor-pointer p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/30 group-hover:from-purple-500/30 group-hover:to-purple-600/40 transition-all">
                    <LinkIcon size={20} weight="duotone" className="text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-foreground mb-1">Generate Links</div>
                    <div className="text-xs text-muted-foreground">Create appraisal links</div>
                  </div>
                </div>
              </div>
            </Link>
            <Link to="/reviews">
              <div className="group relative overflow-hidden rounded-xl border-0 glass-subtle hover:glass-card transition-all duration-300 hover:scale-[1.02] cursor-pointer p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/30 group-hover:from-emerald-500/30 group-hover:to-emerald-600/40 transition-all">
                    <TrendUp size={20} weight="duotone" className="text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-foreground mb-1">View Reviews</div>
                    <div className="text-xs text-muted-foreground">Analytics & insights</div>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
