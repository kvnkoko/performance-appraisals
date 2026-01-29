import { cn } from '@/lib/utils';
import { Crown, UsersThree, User, Briefcase, Medal } from 'phosphor-react';
import type { Employee } from '@/types';
import { HIERARCHY_LABELS } from '@/types';

const hierarchyConfig: Record<Employee['hierarchy'], { icon: typeof Crown; className: string }> = {
  chairman: {
    icon: Medal,
    className: 'bg-amber-600/20 text-amber-800 dark:text-amber-300 border-amber-500/40',
  },
  executive: {
    icon: Crown,
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-400/30',
  },
  leader: {
    icon: UsersThree,
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-400/30',
  },
  'department-leader': {
    icon: UsersThree,
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-400/30',
  },
  member: {
    icon: User,
    className: 'bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-400/30',
  },
  hr: {
    icon: Briefcase,
    className: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-400/30',
  },
};

interface HierarchyBadgeProps {
  hierarchy: Employee['hierarchy'];
  className?: string;
  size?: 'sm' | 'md';
}

export function HierarchyBadge({ hierarchy, className, size = 'sm' }: HierarchyBadgeProps) {
  const config = hierarchyConfig[hierarchy];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border font-medium',
        size === 'sm' && 'px-1.5 py-0.5 text-xs',
        size === 'md' && 'px-2 py-1 text-sm',
        config.className,
        className
      )}
    >
      <Icon weight="duotone" size={size === 'sm' ? 12 : 14} />
      {HIERARCHY_LABELS[hierarchy]}
    </span>
  );
}
