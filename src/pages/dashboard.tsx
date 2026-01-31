import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Users, Link as LinkIcon, CheckCircle, Clock, TrendUp, ChartBar, Activity, Buildings } from 'phosphor-react';
import { formatDate } from '@/lib/utils';
import { BrandLogo } from '@/components/shared/brand-logo';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export function Dashboard() {
  const { templates, employees, appraisals, links, assignments, loading } = useApp();
  const [stats, setStats] = useState({
    totalTemplates: 0,
    totalEmployees: 0,
    pendingAppraisals: 0,
    completedAppraisals: 0,
    activeLinks: 0,
    hrTotal: 0,
    hrComplete: 0,
  });

  useEffect(() => {
    if (!loading) {
      // Completed = submitted appraisal forms (appraisals with completedAt)
      const validAppraisals = appraisals.filter((a) => {
        const employee = employees.find((e) => e.id === a.employeeId);
        return employee;
      });
      const completed = validAppraisals.filter((a) => a.completedAt).length;

      // Pending = appraisal assignments not yet completed (from Auto-Generate / Links)
      const pending = assignments.filter(
        (a) => a.status === 'pending' || a.status === 'in-progress'
      ).length;

      const activeLinks = links.filter((l) => !l.used && (!l.expiresAt || new Date(l.expiresAt) > new Date())).length;

      const hrAssignments = assignments.filter((a) => a.relationshipType === 'hr-to-all');
      const hrTotal = hrAssignments.length;
      const hrComplete = hrAssignments.filter((a) => a.status === 'completed').length;

      setStats({
        totalTemplates: templates.length,
        totalEmployees: employees.length,
        pendingAppraisals: pending,
        completedAppraisals: completed,
        activeLinks,
        hrTotal,
        hrComplete,
      });
    }
  }, [templates, employees, appraisals, links, assignments, loading]);

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
        <div className="bg-card border border-border rounded-lg shadow-dropdown p-3">
          <p className="font-semibold text-sm text-foreground">{data.fullName || data.name}</p>
          <p className="text-sm font-medium mt-1 text-chart-1">{payload[0].value}%</p>
          {data.count !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">{data.count} appraisals</p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="text-muted-foreground text-sm font-medium">Loading…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 sm:pb-10 lg:pb-12 min-w-0 max-w-full">
      {/* Header – award-worthy hierarchy */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="page-title text-foreground">Dashboard</h1>
          <p className="page-subtitle">Comprehensive overview of your performance appraisal system</p>
        </div>
        <div className="flex-shrink-0">
          <BrandLogo className="max-h-8 opacity-90" />
        </div>
      </div>

      {/* Stats Grid – Proxel/Finvero: clean cards, chart colors */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 min-w-0">
        <Card className="overflow-hidden border-border/50 hover:shadow-dropdown transition-shadow duration-200">
          <CardHeader className="pb-2 pt-5 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Templates</CardTitle>
              <div className="p-2 rounded-lg bg-chart-1/12">
                <FileText size={18} weight="duotone" className="text-chart-1" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0">
            <div className="text-3xl font-bold tracking-tight text-foreground">{stats.totalTemplates}</div>
            <p className="text-xs text-muted-foreground mt-1">Active templates</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/50 hover:shadow-dropdown transition-shadow duration-200">
          <CardHeader className="pb-2 pt-5 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Employees</CardTitle>
              <div className="p-2 rounded-lg bg-chart-3/12">
                <Users size={18} weight="duotone" className="text-chart-3" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0">
            <div className="text-3xl font-bold tracking-tight text-foreground">{stats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground mt-1">Total employees</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/50 hover:shadow-dropdown transition-shadow duration-200">
          <CardHeader className="pb-2 pt-5 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Completed</CardTitle>
              <div className="p-2 rounded-lg bg-chart-2/12">
                <CheckCircle size={18} weight="duotone" className="text-chart-2" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0">
            <div className="text-3xl font-bold tracking-tight text-foreground">{stats.completedAppraisals}</div>
            <p className="text-xs text-muted-foreground mt-1">Appraisals completed</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/50 hover:shadow-dropdown transition-shadow duration-200">
          <CardHeader className="pb-2 pt-5 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pending</CardTitle>
              <div className="p-2 rounded-lg bg-chart-4/12">
                <Clock size={18} weight="duotone" className="text-chart-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0">
            <div className="text-3xl font-bold tracking-tight text-foreground">{stats.pendingAppraisals}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting completion</p>
          </CardContent>
        </Card>

        {stats.hrTotal > 0 && (
          <Card className="overflow-hidden border-teal-500/30 hover:shadow-dropdown transition-shadow duration-200 bg-teal-500/5">
            <CardHeader className="pb-2 pt-5 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-teal-700 dark:text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Buildings size={16} weight="duotone" />
                  HR Reviews
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <div className="text-3xl font-bold tracking-tight text-teal-700 dark:text-teal-300">{stats.hrComplete} / {stats.hrTotal}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.hrTotal ? Math.round((stats.hrComplete / stats.hrTotal) * 100) : 0}% complete
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {employees.filter((e) => e.hierarchy === 'hr').length} HR reviewer(s)
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts and Recent Activity – Proxel/Finvero style */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-chart-1/12">
                <ChartBar size={18} weight="duotone" className="text-chart-1" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground">Average Scores by Template</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">Performance across appraisal types</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={chartData}
                  margin={{ top: 16, right: 24, left: 16, bottom: 56 }}
                >
                  <defs>
                    <linearGradient id="colorTemplate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.75} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                  <XAxis
                    dataKey="name"
                    angle={-40}
                    textAnchor="end"
                    height={72}
                    tick={{ fontSize: 11 }}
                    interval={0}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="score" fill="url(#colorTemplate)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                  <ChartBar size={40} weight="duotone" className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No data available</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-chart-2/12">
                <Activity size={18} weight="duotone" className="text-chart-2" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground">Recent Completions</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">Latest completed appraisals</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {recentCompletions.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                {recentCompletions.map((appraisal) => {
                  const employee = employees.find((e) => e.id === appraisal.employeeId);
                  const percentage = Math.round((appraisal.score / appraisal.maxScore) * 100);
                  const scoreColor = percentage >= 90 ? 'text-chart-2' : percentage >= 75 ? 'text-chart-1' : percentage >= 60 ? 'text-chart-4' : 'text-chart-5';
                  return (
                    <div
                      key={appraisal.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-surface/80 border border-border/40 hover:border-border/60 transition-colors duration-200"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{employee?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(appraisal.completedAt!)}</p>
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <span className={`text-lg font-bold tabular-nums ${scoreColor}`}>{percentage}%</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{appraisal.score}/{appraisal.maxScore}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                  <CheckCircle size={40} weight="duotone" className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No completions yet</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions – minimal, striking */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground">Quick Actions</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <Link to="/templates" className="block">
              <div className="group flex items-center gap-3 p-3 rounded-lg bg-surface/80 border border-border/40 hover:border-border/60 hover:shadow-card transition-all duration-200 cursor-pointer">
                <div className="p-2 rounded-lg bg-chart-1/12 group-hover:bg-chart-1/20 transition-colors">
                  <FileText size={18} weight="duotone" className="text-chart-1" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground">Create Template</div>
                  <div className="text-xs text-muted-foreground truncate">Build new appraisal forms</div>
                </div>
              </div>
            </Link>
            <Link to="/links" className="block">
              <div className="group flex items-center gap-3 p-3 rounded-lg bg-surface/80 border border-border/40 hover:border-border/60 hover:shadow-card transition-all duration-200 cursor-pointer">
                <div className="p-2 rounded-lg bg-chart-3/12 group-hover:bg-chart-3/20 transition-colors">
                  <LinkIcon size={18} weight="duotone" className="text-chart-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground">Generate Links</div>
                  <div className="text-xs text-muted-foreground truncate">Create appraisal links</div>
                </div>
              </div>
            </Link>
            <Link to="/reviews" className="block">
              <div className="group flex items-center gap-3 p-3 rounded-lg bg-surface/80 border border-border/40 hover:border-border/60 hover:shadow-card transition-all duration-200 cursor-pointer">
                <div className="p-2 rounded-lg bg-chart-2/12 group-hover:bg-chart-2/20 transition-colors">
                  <TrendUp size={18} weight="duotone" className="text-chart-2" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground">View Reviews</div>
                  <div className="text-xs text-muted-foreground truncate">Analytics & insights</div>
                </div>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
