import { cn } from '@/lib/utils';
import { RATING_LABELS } from '@/types';
import {
  RATING_VALUES,
  canSelectRating,
  getRatingLimit,
  getRatingUsageTone,
  type RatingCounts,
  type RatingValue,
} from '@/lib/rating-limits';

interface RatingSelectorProps {
  value?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  required?: boolean;
  /** When true, show "Required field" only after submit attempt (e.g. pass formState.submitCount > 0) */
  showRequiredError?: boolean;
  ratingCounts?: RatingCounts;
  onLimitReached?: (rating: RatingValue) => void;
}

interface RatingLimitSummaryProps {
  ratingCounts: RatingCounts;
  className?: string;
}

const toneClasses = {
  open: 'border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300',
  available: 'border-border/60 bg-background/70 text-muted-foreground',
  near: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-amber-500/10',
  full: 'border-destructive/30 bg-destructive/10 text-destructive shadow-destructive/10',
} as const;

export function RatingLimitSummary({ ratingCounts, className }: RatingLimitSummaryProps) {
  return (
    <div className={cn(
      'rounded-2xl border border-border/60 bg-card/70 p-3 shadow-sm backdrop-blur',
      className
    )}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Rating balance</p>
          <p className="text-sm font-medium text-foreground">Live limits update as you score each item.</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        {RATING_VALUES.map((rating) => {
          const count = ratingCounts[rating];
          const limit = getRatingLimit(rating);
          const tone = getRatingUsageTone(rating, count);
          const label = RATING_LABELS[rating].label;
          const status = limit === null
            ? `${count} used`
            : `${count}/${limit} used`;
          const helper = limit === null
            ? 'No cap'
            : count >= limit
              ? 'Limit reached'
              : limit - count === 1
                ? 'Last one left'
                : `${limit - count} left`;

          return (
            <div
              key={rating}
              className={cn(
                'rounded-xl border px-3 py-2.5 shadow-sm transition-all duration-200',
                toneClasses[tone]
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-bold leading-none">{rating}</span>
                <span className="text-[10px] font-bold uppercase tracking-wide">{status}</span>
              </div>
              <p className="mt-1 truncate text-[11px] font-semibold">{label}</p>
              <p className="text-[10px] opacity-80">{helper}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RatingSelector({
  value,
  onChange,
  disabled,
  required,
  showRequiredError = false,
  ratingCounts,
  onLimitReached,
}: RatingSelectorProps) {
  const getColorClasses = (rating: RatingValue, isSelected: boolean, isBlocked: boolean) => {
    if (isSelected) {
      return 'bg-primary text-primary-foreground border-primary shadow-md ring-1 ring-primary/20';
    }
    if (isBlocked) {
      return 'bg-muted/50 border-border/60 text-muted-foreground/50 cursor-not-allowed';
    }
    return 'bg-background border-border text-muted-foreground hover:bg-muted hover:border-border/80 hover:text-foreground';
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-stretch justify-center gap-2 sm:gap-3">
        {RATING_VALUES.map((rating) => {
          const isSelected = value === rating;
          const label = RATING_LABELS[rating];
          const limit = getRatingLimit(rating);
          const count = ratingCounts?.[rating] ?? 0;
          const isBlocked = ratingCounts ? !canSelectRating(rating, ratingCounts, value) : false;
          const tone = getRatingUsageTone(rating, count);
          const remaining = limit === null ? null : Math.max(limit - count, 0);
          const statusText = limit === null
            ? 'Open'
            : isSelected
              ? 'Selected'
              : remaining === 0
                ? 'Full'
                : `${remaining} left`;

          return (
            <button
              key={rating}
              type="button"
              onClick={() => {
                if (disabled) return;
                if (isBlocked) {
                  onLimitReached?.(rating);
                  return;
                }
                onChange(rating);
              }}
              disabled={disabled}
              aria-disabled={disabled || isBlocked}
              title={isBlocked ? `${label.label} limit reached` : label.label}
              className={cn(
                'relative flex flex-col items-center justify-center min-w-[4rem] max-w-[5rem] py-3 px-2 border rounded-lg transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50',
                disabled && 'opacity-50 cursor-not-allowed',
                !disabled && !isBlocked && 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
                getColorClasses(rating, isSelected, isBlocked),
                isSelected && 'scale-[1.02]'
              )}
            >
              <span className={cn(
                'text-lg sm:text-xl font-semibold mb-1.5',
                isSelected ? 'text-primary-foreground' : ''
              )}>
                {rating}
              </span>
              <span className={cn(
                'text-[9px] sm:text-[10px] font-medium text-center leading-tight break-words w-full px-0.5',
                isSelected ? 'text-primary-foreground/90' : 'text-muted-foreground'
              )}>
                {label.label.split(' ').map((word, i) => (
                  <span key={i}>
                    {word}
                    {i < label.label.split(' ').length - 1 && <br />}
                  </span>
                ))}
              </span>
              {ratingCounts && (
                <span className={cn(
                  'mt-2 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                  isSelected
                    ? 'bg-primary-foreground/20 text-primary-foreground/90'
                    : tone === 'full'
                      ? 'bg-destructive/10 text-destructive'
                      : tone === 'near'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300'
                        : 'bg-muted text-muted-foreground'
                )}>
                  {statusText}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {required && !value && showRequiredError && (
        <p className="text-xs text-destructive text-center pt-0.5">Required field</p>
      )}
    </div>
  );
}
