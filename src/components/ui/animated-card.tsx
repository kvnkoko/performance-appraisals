import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function AnimatedCard({ children, className, delay = 0 }: AnimatedCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-5 shadow-card',
        'animate-fade-in-up transition-colors duration-200 hover:border-primary/30',
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
