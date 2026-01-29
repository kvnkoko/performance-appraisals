import { useMemo } from 'react';
import { ChartBar, Users, UsersThree, Warning, Buildings, TrendUp, Download } from 'phosphor-react';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { isDepartmentLeader } from '@/types';
import { HIERARCHY_LABELS } from '@/types';
import { getDirectReports } from '@/lib/org-chart-utils';
import { useToast } from '@/contexts/toast-context';

export function OrganizationAnalyticsPage() {
  const { employees, teams } = useApp();
  const { toast } = useToast();

  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Role', 'Hierarchy', 'Executive Type', 'Department', 'Reports To'];
    const rows = employees.map((e) => {
      const team = teams.find((t) => t.id === e.teamId);
      return [
        e.name,
        e.email ?? '',
        e.role,
        e.hierarchy,
        e.executiveType ?? '',
        team?.name ?? '',
        e.reportsTo ?? '',
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `organization-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export complete', description: 'Organization data exported as CSV.', variant: 'success' });
  };

  const structure = useMemo(() => {
    const chairman = employees.filter((e) => e.hierarchy === 'chairman');
    const executives = employees.filter((e) => e.hierarchy === 'executive');
    const leaders = employees.filter((e) => isDepartmentLeader(e.hierarchy));
    const members = employees.filter((e) => e.hierarchy === 'member');
    const hr = employees.filter((e) => e.hierarchy === 'hr');
    return {
      chairman: chairman.length,
      executives: executives.length,
      operationalExecs: executives.filter((e) => e.executiveType === 'operational').length,
      advisoryExecs: executives.filter((e) => e.executiveType === 'advisory').length,
      leaders: leaders.length,
      members: members.length,
      hr: hr.length,
      total: employees.length,
    };
  }, [employees]);

  const reportingHealth = useMemo(() => {
    const missingReportsTo = employees.filter(
      (e) => e.hierarchy !== 'chairman' && e.hierarchy !== 'hr' && !e.reportsTo
    );
    const departmentsWithoutLeaders = teams.filter((team) => {
      const hasLeader = employees.some(
        (e) => (e.teamId === team.id && isDepartmentLeader(e.hierarchy)) || (e.teamId === team.id && e.hierarchy === 'executive')
      );
      return !hasLeader;
    });
    const notInDepartment = employees.filter(
      (e) => e.hierarchy !== 'chairman' && e.hierarchy !== 'executive' && !e.teamId
    );
    return {
      missingReportsTo: missingReportsTo.length,
      missingReportsToList: missingReportsTo,
      departmentsWithoutLeaders: departmentsWithoutLeaders.length,
      departmentsWithoutLeadersList: departmentsWithoutLeaders,
      notInDepartment: notInDepartment.length,
      notInDepartmentList: notInDepartment,
    };
  }, [employees, teams]);

  const departmentStats = useMemo(() => {
    return teams.map((team) => {
      const inTeam = employees.filter((e) => e.teamId === team.id);
      const leadersCount = inTeam.filter((e) => isDepartmentLeader(e.hierarchy) || e.hierarchy === 'executive').length;
      const membersCount = inTeam.filter((e) => e.hierarchy === 'member').length;
      return {
        team,
        total: inTeam.length,
        leaders: leadersCount,
        members: membersCount,
      };
    });
  }, [employees, teams]);

  const spanOfControl = useMemo(() => {
    const leadersAndExecs = employees.filter(
      (e) => isDepartmentLeader(e.hierarchy) || e.hierarchy === 'executive'
    );
    const counts = leadersAndExecs.map((e) => getDirectReports(e.id, employees).length);
    const avg = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    const max = counts.length ? Math.max(...counts) : 0;
    const min = counts.length ? Math.min(...counts) : 0;
    return { avg: Math.round(avg * 10) / 10, max, min, counts };
  }, [employees]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Organization analytics</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Structure overview and reporting health</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
          <Download size={18} weight="duotone" />
          Export CSV
        </Button>
      </header>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <ChartBar size={20} weight="duotone" />
          Structure overview
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users size={18} weight="duotone" />
                Total employees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{structure.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">By level</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="flex justify-between">
                <span className="text-muted-foreground">{HIERARCHY_LABELS.chairman}</span>
                <span className="font-medium">{structure.chairman}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground">{HIERARCHY_LABELS.executive}</span>
                <span className="font-medium">{structure.executives}</span>
              </p>
              {structure.executives > 0 && (
                <p className="pl-4 text-xs text-muted-foreground">
                  Operational: {structure.operationalExecs}, Advisory: {structure.advisoryExecs}
                </p>
              )}
              <p className="flex justify-between">
                <span className="text-muted-foreground">{HIERARCHY_LABELS['department-leader']}</span>
                <span className="font-medium">{structure.leaders}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground">{HIERARCHY_LABELS.member}</span>
                <span className="font-medium">{structure.members}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground">{HIERARCHY_LABELS.hr}</span>
                <span className="font-medium">{structure.hr}</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Buildings size={18} weight="duotone" />
                Departments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-foreground">{teams.length}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendUp size={20} weight="duotone" />
          Span of control
        </h2>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Average direct reports</p>
                <p className="text-2xl font-bold text-foreground">{spanOfControl.avg}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Max</p>
                <p className="text-2xl font-bold text-foreground">{spanOfControl.max}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Min</p>
                <p className="text-2xl font-bold text-foreground">{spanOfControl.min}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Optimal span is often 5–9 direct reports. Leaders/executives with 0 reports are excluded from average.
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Warning size={20} weight="duotone" className="text-amber-500" />
          Reporting structure health
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className={reportingHealth.missingReportsTo > 0 ? 'border-amber-500/50' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Missing &quot;Reports To&quot;</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{reportingHealth.missingReportsTo}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Employees (non-chairman, non-HR) without a direct manager
              </p>
              {reportingHealth.missingReportsToList.length > 0 && (
                <ul className="mt-2 text-xs text-muted-foreground list-disc list-inside">
                  {reportingHealth.missingReportsToList.slice(0, 5).map((e) => (
                    <li key={e.id}>{e.name}</li>
                  ))}
                  {reportingHealth.missingReportsToList.length > 5 && (
                    <li>+{reportingHealth.missingReportsToList.length - 5} more</li>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card className={reportingHealth.departmentsWithoutLeaders > 0 ? 'border-amber-500/50' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Departments without leaders</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{reportingHealth.departmentsWithoutLeaders}</p>
              {reportingHealth.departmentsWithoutLeadersList.length > 0 && (
                <ul className="mt-2 text-xs text-muted-foreground list-disc list-inside">
                  {reportingHealth.departmentsWithoutLeadersList.map((t) => (
                    <li key={t.id}>{t.name}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card className={reportingHealth.notInDepartment > 0 ? 'border-amber-500/50' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Not in any department</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{reportingHealth.notInDepartment}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Leaders/members without team assignment
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <UsersThree size={20} weight="duotone" />
          Department comparison
        </h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-medium text-foreground">Department</th>
                    <th className="text-right p-3 font-medium text-foreground">Total</th>
                    <th className="text-right p-3 font-medium text-foreground">Leaders</th>
                    <th className="text-right p-3 font-medium text-foreground">Members</th>
                  </tr>
                </thead>
                <tbody>
                  {departmentStats.map(({ team, total, leaders, members }) => (
                    <tr key={team.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3 font-medium text-foreground">{team.name}</td>
                      <td className="p-3 text-right text-muted-foreground">{total}</td>
                      <td className="p-3 text-right text-muted-foreground">{leaders}</td>
                      <td className="p-3 text-right text-muted-foreground">{members}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {departmentStats.length === 0 && (
              <p className="p-6 text-muted-foreground text-sm">No departments yet. Add teams to see comparison.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
