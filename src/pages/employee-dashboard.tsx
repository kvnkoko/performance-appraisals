import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ClipboardText, 
  CheckCircle, 
  Clock, 
  ArrowRight,
  ChartLineUp,
  Calendar,
  Buildings
} from 'phosphor-react';
import { formatDate } from '@/lib/utils';
import type { AppraisalLink, Employee } from '@/types';

export function EmployeeDashboardPage() {
  const { links, employees, appraisals, reviewPeriods, assignments, loading } = useApp();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    // Get employee ID from localStorage (set during login)
    const storedEmployeeId = localStorage.getItem('employeeId');
    if (storedEmployeeId) {
      setEmployeeId(storedEmployeeId);
      const emp = employees.find(e => e.id === storedEmployeeId);
      if (emp) {
        setEmployee(emp);
      }
    }
  }, [employees]);

  // Get appraisal links assigned to this employee (as appraiser)
  const myPendingLinks = links.filter(link => {
    if (!employeeId) return false;
    const isMyLink = link.appraiserId === employeeId;
    const isNotUsed = !link.used;
    const isNotExpired = !link.expiresAt || new Date(link.expiresAt) > new Date();
    return isMyLink && isNotUsed && isNotExpired;
  });

  const myCompletedLinks = links.filter(link => {
    if (!employeeId) return false;
    return link.appraiserId === employeeId && link.used;
  });

  // Assignments where I am the appraiser (pending/in-progress count toward "pending", completed count toward "completed")
  const myAssignments = employeeId ? assignments.filter(a => a.appraiserId === employeeId) : [];
  const myPendingAssignments = myAssignments.filter(a => a.status === 'pending' || a.status === 'in-progress');
  const myCompletedAssignments = myAssignments.filter(a => a.status === 'completed');
  const myHRAssignments = myAssignments.filter(a => a.relationshipType === 'hr-to-all');
  const myHRComplete = myHRAssignments.filter(a => a.status === 'completed').length;
  const myHRTotal = myHRAssignments.length;
  const isHR = employee?.hierarchy === 'hr';

  // Get active review periods
  const activePeriods = reviewPeriods.filter(p => p.status === 'active');

  // Get my performance appraisals (where I was appraised)
  const myAppraisals = appraisals.filter(a => a.employeeId === employeeId && a.completedAt);

  const userName = localStorage.getItem('userName') || 'User';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header – award-worthy hierarchy */}
      <div className="space-y-1">
        <h1 className="page-title text-foreground">Welcome back, {userName}!</h1>
        <p className="page-subtitle">
          {employee ? `${employee.role} · ${employee.hierarchy.charAt(0).toUpperCase() + employee.hierarchy.slice(1)}` : 'Your personal appraisal dashboard'}
        </p>
      </div>

      {/* Stats Cards – Proxel/Finvero style */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="overflow-hidden border-border/50 hover:shadow-dropdown transition-shadow duration-200">
          <CardHeader className="pb-2 pt-5 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Clock size={16} weight="duotone" className="text-chart-4" />
                Pending Reviews
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0">
            <div className="text-3xl font-bold tracking-tight text-foreground">{myPendingLinks.length + myPendingAssignments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{(myPendingLinks.length + myPendingAssignments.length) === 1 ? 'appraisal' : 'appraisals'} waiting for you</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/50 hover:shadow-dropdown transition-shadow duration-200">
          <CardHeader className="pb-2 pt-5 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <CheckCircle size={16} weight="duotone" className="text-chart-2" />
                Completed
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0">
            <div className="text-3xl font-bold tracking-tight text-foreground">{myCompletedLinks.length + myCompletedAssignments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">reviews you've submitted</p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/50 hover:shadow-dropdown transition-shadow duration-200">
          <CardHeader className="pb-2 pt-5 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <ChartLineUp size={16} weight="duotone" className="text-chart-1" />
                Your Reviews
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0">
            <div className="text-3xl font-bold tracking-tight text-foreground">{myAppraisals.length}</div>
            <p className="text-xs text-muted-foreground mt-1">performance reviews received</p>
          </CardContent>
        </Card>

        {isHR && myHRTotal > 0 && (
          <Card className="overflow-hidden border-teal-500/30 hover:shadow-dropdown transition-shadow duration-200 bg-teal-500/5 md:col-span-3">
            <CardHeader className="pb-2 pt-5 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-teal-700 dark:text-teal-300 uppercase tracking-wider flex items-center gap-2">
                  <Buildings size={16} weight="duotone" />
                  My HR Review Progress
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-3xl font-bold tracking-tight text-teal-700 dark:text-teal-300">{myHRComplete} / {myHRTotal}</div>
                <div className="flex-1 min-w-[120px]">
                  <div className="h-2 rounded-full bg-teal-200 dark:bg-teal-800 overflow-hidden">
                    <div 
                      className="h-full bg-teal-600 dark:bg-teal-400 transition-all" 
                      style={{ width: `${myHRTotal ? Math.round((myHRComplete / myHRTotal) * 100) : 0}%` }} 
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {myHRTotal ? Math.round((myHRComplete / myHRTotal) * 100) : 0}% complete · {myHRTotal - myHRComplete} employees remaining
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Active Review Period */}
      {activePeriods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar size={20} weight="duotone" className="text-primary" />
              Active Review Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {activePeriods.map(period => (
                <div 
                  key={period.id}
                  className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/20"
                >
                  <div className="font-semibold">{period.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(period.startDate)} - {formatDate(period.endDate)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Appraisals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Pending Appraisals</CardTitle>
            <CardDescription>Reviews waiting for your completion</CardDescription>
          </div>
          {myPendingLinks.length > 0 && (
            <Link to="/my-appraisals">
              <Button variant="ghost" size="sm">
                View All <ArrowRight size={16} className="ml-1" />
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {myPendingLinks.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle size={48} weight="duotone" className="mx-auto mb-3 text-green-500/50" />
              <p className="text-muted-foreground">You're all caught up! No pending appraisals.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myPendingLinks.slice(0, 5).map(link => {
                const targetEmployee = employees.find(e => e.id === link.employeeId);
                return (
                  <Link 
                    key={link.id}
                    to={`/appraisal/${link.token}`}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/10">
                        <ClipboardText size={20} weight="duotone" className="text-amber-500" />
                      </div>
                      <div>
                        <div className="font-medium group-hover:text-primary transition-colors">
                          Review for {targetEmployee?.name || 'Unknown'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {link.reviewPeriodName || 'No period'} • 
                          {link.expiresAt ? ` Due ${formatDate(link.expiresAt)}` : ' No deadline'}
                        </div>
                      </div>
                    </div>
                    <ArrowRight size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link to="/my-appraisals">
          <Card className="hover:shadow-lg transition-all cursor-pointer group h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <ClipboardText size={24} weight="duotone" className="text-primary" />
                </div>
                <div>
                  <div className="font-semibold group-hover:text-primary transition-colors">
                    My Appraisals
                  </div>
                  <p className="text-sm text-muted-foreground">
                    View and complete your assigned reviews
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/my-performance">
          <Card className="hover:shadow-lg transition-all cursor-pointer group h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                  <ChartLineUp size={24} weight="duotone" className="text-green-500" />
                </div>
                <div>
                  <div className="font-semibold group-hover:text-green-600 transition-colors">
                    My Performance
                  </div>
                  <p className="text-sm text-muted-foreground">
                    View your performance summary and feedback
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
