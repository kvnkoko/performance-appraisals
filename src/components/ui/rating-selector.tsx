import { cn } from '@/lib/utils';
import { RATING_LABELS } from '@/types';

interface RatingSelectorProps {
  value?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  required?: boolean;
  /** When true, show "Required field" only after submit attempt (e.g. pass formState.submitCount > 0) */
  showRequiredError?: boolean;
}

export function RatingSelector({ value, onChange, disabled, required, showRequiredError = false }: RatingSelectorProps) {
  const ratings = [1, 2, 3, 4, 5] as const;

  const getColorClasses = (_rating: number, isSelected: boolean) => {
    if (isSelected) {
      return 'bg-primary text-primary-foreground border-primary shadow-md ring-1 ring-primary/20';
    }
    return 'bg-background border-border text-muted-foreground hover:bg-muted hover:border-border/80 hover:text-foreground';
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-stretch justify-center gap-2 sm:gap-3">
        {ratings.map((rating) => {
          const isSelected = value === rating;
          const label = RATING_LABELS[rating];
          return (
            <button
              key={rating}
              type="button"
              onClick={() => !disabled && onChange(rating)}
              disabled={disabled}
              className={cn(
                'relative flex flex-col items-center justify-center min-w-[4rem] max-w-[5rem] py-3 px-2 border rounded-lg transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50',
                disabled && 'opacity-50 cursor-not-allowed',
                !disabled && 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
                getColorClasses(rating, isSelected),
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
