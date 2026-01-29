import { OrgChartNode } from './OrgChartNode';
import type { OrgChartNode as OrgChartNodeType, Employee } from '@/types';

interface OrgChartTreeProps {
  levels: OrgChartNodeType[][];
  showDepartmentLabels?: boolean;
  onSelectEmployee?: (employee: Employee) => void;
  highlightEmployeeId?: string;
  searchMatchIds?: Set<string>;
}

function groupRowByDepartment(row: OrgChartNodeType[]): { teamId: string | null; teamName: string; nodes: OrgChartNodeType[] }[] {
  const groups: { teamId: string | null; teamName: string; nodes: OrgChartNodeType[] }[] = [];
  let current: { teamId: string | null; teamName: string; nodes: OrgChartNodeType[] } | null = null;
  for (const node of row) {
    const id = node.team?.id ?? null;
    const name = node.team?.name ?? 'No department';
    if (!current || current.teamId !== id || current.teamName !== name) {
      current = { teamId: id, teamName: name, nodes: [] };
      groups.push(current);
    }
    current.nodes.push(node);
  }
  return groups;
}

export function OrgChartTree({ levels, showDepartmentLabels, onSelectEmployee, highlightEmployeeId, searchMatchIds }: OrgChartTreeProps) {
  return (
    <div className="flex flex-col items-center gap-y-6 pt-1 pb-2">
      {levels.map((row, levelIndex) => {
        if (row.length === 0) return null;
        if (showDepartmentLabels) {
          const groups = groupRowByDepartment(row);
          return (
            <div key={levelIndex} className="flex flex-wrap justify-center items-start gap-x-8 gap-y-4">
              {groups.map((g, gi) => (
                <div key={gi} className="flex flex-wrap items-center gap-x-4 gap-y-4">
                  <span className="text-xs font-medium text-muted-foreground bg-muted/80 rounded-full px-2.5 py-1 shrink-0">
                    {g.teamName}
                  </span>
                  {g.nodes.map((node) => (
                    <OrgChartNode
                      key={node.employee.id}
                      node={node}
                      depth={levelIndex}
                      onSelect={onSelectEmployee}
                      highlightEmployeeId={highlightEmployeeId}
                      searchMatchIds={searchMatchIds}
                    />
                  ))}
                </div>
              ))}
            </div>
          );
        }
        return (
          <div key={levelIndex} className="flex flex-wrap justify-center items-start gap-x-12 gap-y-4">
            {row.map((node) => (
              <OrgChartNode
                key={node.employee.id}
                node={node}
                depth={levelIndex}
                onSelect={onSelectEmployee}
                highlightEmployeeId={highlightEmployeeId}
                searchMatchIds={searchMatchIds}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
