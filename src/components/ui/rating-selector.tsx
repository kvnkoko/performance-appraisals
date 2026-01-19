import { cn } from '@/lib/utils';
import { RATING_LABELS } from '@/types';

interface RatingSelectorProps {
  value?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  required?: boolean;
}

export function RatingSelector({ value, onChange, disabled, required }: RatingSelectorProps) {
  const ratings = [1, 2, 3, 4, 5] as const;

  const getColorClasses = (_rating: number, isSelected: boolean) => {
    if (isSelected) {
      return 'bg-primary text-primary-foreground border-primary shadow-md ring-1 ring-primary/20';
    }
    return 'bg-background border-border text-muted-foreground hover:bg-muted hover:border-border/80 hover:text-foreground';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 justify-center">
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
                'relative flex flex-col items-center justify-center w-14 h-16 sm:w-16 sm:h-20 border rounded-lg transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50',
                disabled && 'opacity-50 cursor-not-allowed',
                !disabled && 'cursor-pointer hover:scale-105 active:scale-95',
                getColorClasses(rating, isSelected),
                isSelected && 'scale-105'
              )}
            >
              <span className={`text-xl sm:text-2xl font-semibold mb-1 ${isSelected ? 'text-primary-foreground' : ''}`}>
                {rating}
              </span>
              <span className={`text-[9px] sm:text-[10px] font-medium text-center leading-tight px-1 ${
                isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
              }`}>
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
      {required && !value && (
        <p className="text-xs text-destructive text-center">Required field</p>
      )}
    </div>
  );
}
