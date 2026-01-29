import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { Employee } from '@/types';

const sizeClasses = {
  xs: 'w-8 h-8 text-xs',
  sm: 'w-10 h-10 text-sm',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base',
  xl: 'w-20 h-20 text-lg',
  '2xl': 'w-28 h-28 text-xl',
};

const ringByHierarchy: Record<Employee['hierarchy'], string> = {
  chairman: 'ring-2 ring-amber-500/90 dark:ring-amber-400/90',
  executive: 'ring-2 ring-amber-400/80 dark:ring-amber-500/80',
  leader: 'ring-2 ring-blue-400/80 dark:ring-blue-500/80',
  'department-leader': 'ring-2 ring-blue-400/80 dark:ring-blue-500/80',
  member: 'ring-2 ring-gray-300 dark:ring-gray-500',
  hr: 'ring-2 ring-violet-400/80 dark:ring-violet-500/80',
};

export function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function hashToHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h) % 360;
}

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: keyof typeof sizeClasses;
  hierarchy?: Employee['hierarchy'];
  className?: string;
  showRing?: boolean;
}

export function Avatar({ src, name, size = 'md', hierarchy, className, showRing = true }: AvatarProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const initials = getInitials(name);
  const hue = hashToHue(name);
  const bgGradient = `linear-gradient(135deg, hsl(${hue}, 65%, 55%), hsl(${hue}, 65%, 40%))`;

  const useFallback = !src || error;

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full overflow-hidden transition-transform duration-200 hover:scale-105',
        sizeClasses[size],
        showRing && hierarchy && ringByHierarchy[hierarchy],
        !useFallback && 'bg-muted',
        className
      )}
      style={useFallback ? { background: bgGradient } : undefined}
      aria-label={name}
    >
      {!useFallback ? (
        <>
          <img
            src={src}
            alt=""
            className={cn(
              'h-full w-full object-cover object-center transition-opacity duration-300',
              loaded ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            loading="lazy"
          />
          {!loaded && (
            <span className="absolute text-white font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {initials}
            </span>
          )}
        </>
      ) : (
        <span className="font-semibold text-white select-none">{initials}</span>
      )}
    </div>
  );
}
