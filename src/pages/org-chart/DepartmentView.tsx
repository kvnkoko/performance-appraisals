import { useApp } from '@/contexts/app-context';
import { OrgChartTree } from './OrgChartTree';
import { useOrgChartData } from '@/hooks/use-org-chart-data';
import { treeToLevels } from '@/lib/org-chart-utils';
import type { Employee } from '@/types';
import { cn } from '@/lib/utils';

interface DepartmentViewProps {
  onSelectEmployee?: (employee: Employee) => void;
  className?: string;
}

export function DepartmentView({ onSelectEmployee, className }: DepartmentViewProps) {
  const { teams, employees } = useApp();
  const { getDepartmentTree, employees: activeEmployees } = useOrgChartData();

  return (
    <div className={cn('space-y-6', className)}>
      {teams.map((team) => {
        const root = getDepartmentTree(team.id);
        if (!root) return null;
        const teamMembers = activeEmployees.filter((e) => e.teamId === team.id);
        return (
          <section key={team.id} className="rounded-xl border border-border bg-card/50 p-5">
            <h3 className="text-lg font-semibold text-foreground mb-2">{team.name}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
            </p>
            <OrgChartTree levels={treeToLevels(root)} onSelectEmployee={onSelectEmployee} />
          </section>
        );
      })}
    </div>
  );
}
