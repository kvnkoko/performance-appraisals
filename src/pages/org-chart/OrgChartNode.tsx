import { useState } from 'react';
import { CaretDown, CaretRight } from 'phosphor-react';
import { Avatar } from '@/components/ui/avatar';
import { useApp } from '@/contexts/app-context';
import type { OrgChartNode as OrgChartNodeType, Employee } from '@/types';
import { cn } from '@/lib/utils';

interface OrgChartNodeProps {
  node: OrgChartNodeType;
  depth: number;
  onSelect?: (employee: Employee) => void;
  highlightEmployeeId?: string;
  searchMatchIds?: Set<string>;
}

export function OrgChartNode({ node, depth, onSelect, highlightEmployeeId, searchMatchIds }: OrgChartNodeProps) {
  const { teams } = useApp();
  const { employee, profile, children } = node;
  const team = employee.teamId ? teams.find((t) => t.id === employee.teamId) : undefined;
  const hasChildren = children.length > 0;
  const [expanded, setExpanded] = useState(node.isExpanded ?? depth < 2);
  const isHighlighted = highlightEmployeeId === employee.id;
  const isSearchMatch = searchMatchIds?.has(employee.id);

  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          'flex flex-col items-center p-4 rounded-2xl border-2 bg-card min-w-[168px] max-w-[208px]',
          'transition-all duration-200 hover:shadow-lg hover:scale-[1.02] cursor-pointer',
          employee.hierarchy === 'chairman' && 'border-amber-500/60 dark:border-amber-400/60',
          employee.hierarchy === 'executive' && 'border-amber-400/50 dark:border-amber-500/50',
          (employee.hierarchy === 'leader' || employee.hierarchy === 'department-leader') && 'border-blue-400/50 dark:border-blue-500/50',
          employee.hierarchy === 'hr' && 'border-violet-400/50 dark:border-violet-500/50',
          employee.hierarchy === 'member' && 'border-border',
          isHighlighted && 'ring-2 ring-accent ring-offset-2 ring-offset-background',
          isSearchMatch && !isHighlighted && 'ring-2 ring-green-400/60 ring-offset-2 ring-offset-background'
        )}
        onClick={() => onSelect?.(employee)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect?.(employee);
          }
        }}
        aria-label={`${employee.name}, ${employee.role}. ${hasChildren ? `${children.length} direct report(s).` : ''} Click to view profile.`}
      >
        <Avatar
          src={profile?.profilePicture}
          name={employee.name}
          size={depth === 0 ? '2xl' : 'xl'}
          hierarchy={employee.hierarchy}
          showRing={depth === 0}
        />
        <p className={cn('mt-3 font-semibold text-foreground truncate w-full text-center', depth === 0 ? 'text-base' : 'text-sm')}>
          {employee.name}
        </p>
        <p className="text-xs text-muted-foreground truncate w-full text-center mt-0.5">{employee.role}</p>
        {team && (
          <span className="mt-2 rounded-full px-2 py-0.5 text-xs bg-muted/80 text-muted-foreground truncate max-w-full">
            {team.name}
          </span>
        )}
        {hasChildren && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }}
            className="mt-2 p-1 rounded hover:bg-muted text-muted-foreground flex items-center gap-1 text-xs"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />}
            <span>{children.length} report{children.length !== 1 ? 's' : ''}</span>
          </button>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="mt-4 flex flex-col items-center gap-4">
          <div className="w-0.5 h-4 bg-border rounded-full" />
          <div className="flex flex-wrap justify-center gap-8">
            {children.map((child) => (
              <OrgChartNode
                key={child.employee.id}
                node={child}
                depth={depth + 1}
                onSelect={onSelect}
                highlightEmployeeId={highlightEmployeeId}
                searchMatchIds={searchMatchIds}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
