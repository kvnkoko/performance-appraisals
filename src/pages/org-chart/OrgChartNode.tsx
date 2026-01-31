import { useState } from 'react';
import { CaretDown, CaretRight, Buildings } from 'phosphor-react';
import { useApp } from '@/contexts/app-context';
import type { OrgChartNode as OrgChartNodeType, Employee } from '@/types';
import { getInitials, hashToHue } from '@/components/ui/avatar';
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

  const zoom = profile?.profilePictureZoom ?? 1;
  const objectPosition =
    profile?.profilePicture && (profile.profilePicturePositionX != null || profile.profilePicturePositionY != null)
      ? `${profile.profilePicturePositionX ?? 50}% ${profile.profilePicturePositionY ?? 50}%`
      : '50% 50%';

  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          'flex flex-col rounded-xl border-2 overflow-hidden min-w-[160px] max-w-[200px] aspect-[4/5]',
          'transition-all duration-200 hover:shadow-xl cursor-pointer',
          employee.hierarchy === 'chairman' && 'border-amber-500/60 dark:border-amber-400/60 shadow-lg shadow-amber-500/10',
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
        <div className="relative w-full h-full flex flex-col">
          {/* Photo fills card */}
          <div className="absolute inset-0 rounded-t-xl overflow-hidden bg-muted">
            {profile?.profilePicture ? (
              <img
                src={profile.profilePicture}
                alt=""
                className="w-full h-full object-cover"
                style={{
                  objectPosition,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center center',
                }}
                loading="lazy"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, hsl(${hashToHue(employee.name)}, 65%, 55%), hsl(${hashToHue(employee.name)}, 65%, 40%))`,
                }}
              >
                <span className="text-4xl font-semibold text-white select-none">
                  {getInitials(employee.name)}
                </span>
              </div>
            )}
          </div>
          {/* Gradient overlay + name, role, team on top */}
          <div
            className="absolute inset-x-0 bottom-0 z-[1] pt-8 pb-2.5 px-3 rounded-b-xl"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)',
            }}
          >
            <p className="font-semibold text-white text-sm leading-tight drop-shadow-sm truncate">
              {employee.name}
            </p>
            <p className="text-white/95 text-xs mt-0.5 truncate">{employee.role}</p>
            {team && (
              <p className="text-white/80 text-[11px] mt-0.5 flex items-center gap-1 truncate">
                <Buildings size={10} weight="duotone" className="shrink-0" /> {team.name}
              </p>
            )}
            {hasChildren && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }}
                className="mt-2 flex items-center gap-1 text-white/90 text-[11px] font-medium hover:text-white transition-colors"
                aria-label={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded ? <CaretDown size={12} weight="bold" /> : <CaretRight size={12} weight="bold" />}
                <span>{children.length} report{children.length !== 1 ? 's' : ''}</span>
              </button>
            )}
          </div>
        </div>
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
