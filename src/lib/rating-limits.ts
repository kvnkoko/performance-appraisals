import { RATING_LABELS } from '@/types';

export const RATING_LIMITS = {
  1: 2,
  2: 4,
  3: null,
  4: 4,
  5: 2,
} as const;

export const RATING_VALUES = [1, 2, 3, 4, 5] as const;

export type RatingValue = (typeof RATING_VALUES)[number];
export type RatingCounts = Record<RatingValue, number>;

type RatingLimit = (typeof RATING_LIMITS)[RatingValue];

export type RatingLimitOptions = {
  limitsEnabled?: boolean;
};

export function isHrAppraisal(params: {
  templateType?: string | null;
  relationshipType?: string | null;
  appraiserHierarchy?: string | null;
}): boolean {
  return (
    params.templateType === 'hr-to-all' ||
    params.relationshipType === 'hr-to-all' ||
    params.appraiserHierarchy === 'hr'
  );
}

export function getRatingLimitOptionsForAppraisal(params: {
  templateType?: string | null;
  relationshipType?: string | null;
  appraiserHierarchy?: string | null;
}): RatingLimitOptions {
  return { limitsEnabled: !isHrAppraisal(params) };
}

function limitsAreEnabled(options?: RatingLimitOptions): boolean {
  return options?.limitsEnabled !== false;
}

export function createEmptyRatingCounts(): RatingCounts {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

export function getRatingLimit(rating: RatingValue, options?: RatingLimitOptions): RatingLimit {
  if (!limitsAreEnabled(options)) return null;
  return RATING_LIMITS[rating];
}

export function getRatingUsageTone(rating: RatingValue, count: number, options?: RatingLimitOptions) {
  const limit = getRatingLimit(rating, options);
  if (limit === null) return 'open';
  if (count >= limit) return 'full';
  if (limit - count === 1) return 'near';
  return 'available';
}

export function canSelectRating(
  rating: RatingValue,
  counts: RatingCounts,
  currentValue?: number,
  options?: RatingLimitOptions
) {
  const limit = getRatingLimit(rating, options);
  return limit === null || currentValue === rating || counts[rating] < limit;
}

export function getRatingLimitMessage(rating: RatingValue, options?: RatingLimitOptions) {
  const label = RATING_LABELS[rating].label;
  const limit = getRatingLimit(rating, options);
  return limit === null ? `${label} has no limit.` : `${label} is limited to ${limit} selections.`;
}
