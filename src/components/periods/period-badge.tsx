import { cn } from '@/lib/utils';
import type { ReviewPeriod } from '@/types';

interface PeriodBadgeProps {
  period: ReviewPeriod;
  showStatus?: boolean;
  className?: string;
}

export function PeriodBadge({ period, showStatus = true, className }: PeriodBadgeProps) {
  const getPeriodColor = (type: ReviewPeriod['type']) => {
    const colors = {
      Monthly: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
      Q1: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
      Q2: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
      Q3: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
      Q4: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
      H1: 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800',
      H2: 'bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800',
      Annual: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
      Custom: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    };
    return colors[type] || colors.Custom;
  };

  const getStatusColor = (status: ReviewPeriod['status']) => {
    const colors = {
      planning: 'bg-gray-100 text-gray-700 border-gray-300',
      active: 'bg-green-100 text-green-700 border-green-300 ring-2 ring-green-500/20',
      completed: 'bg-blue-100 text-blue-700 border-blue-300',
      archived: 'bg-gray-50 text-gray-500 border-gray-200',
    };
    return colors[status];
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className={cn('px-2 py-1 rounded-md text-xs font-medium border', getPeriodColor(period.type))}>
        {period.name}
      </span>
      {showStatus && (
        <span className={cn('px-2 py-1 rounded-md text-xs font-medium border capitalize', getStatusColor(period.status))}>
          {period.status}
        </span>
      )}
    </div>
  );
}
