import { cn } from '@/lib/utils';

interface SkillBadgeProps {
  label: string;
  className?: string;
}

export function SkillBadge({ label, className }: SkillBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground',
        'border border-border/60',
        className
      )}
    >
      {label}
    </span>
  );
}
