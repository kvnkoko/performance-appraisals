import type { ReviewPeriod } from '@/types';

export function getCurrentQuarter(): 'Q1' | 'Q2' | 'Q3' | 'Q4' {
  const month = new Date().getMonth();
  if (month < 3) return 'Q1';
  if (month < 6) return 'Q2';
  if (month < 9) return 'Q3';
  return 'Q4';
}

export function getCurrentHalf(): 'H1' | 'H2' {
  const month = new Date().getMonth();
  return month < 6 ? 'H1' : 'H2';
}

export function getQuarterDates(quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4', year: number): { start: Date; end: Date } {
  const quarters = {
    Q1: { start: 0, end: 2 },
    Q2: { start: 3, end: 5 },
    Q3: { start: 6, end: 8 },
    Q4: { start: 9, end: 11 },
  };
  const q = quarters[quarter];
  return {
    start: new Date(year, q.start, 1),
    end: new Date(year, q.end + 1, 0, 23, 59, 59),
  };
}

export function getHalfDates(half: 'H1' | 'H2', year: number): { start: Date; end: Date } {
  if (half === 'H1') {
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 5, 30, 23, 59, 59),
    };
  } else {
    return {
      start: new Date(year, 6, 1),
      end: new Date(year, 11, 31, 23, 59, 59),
    };
  }
}

export function generatePeriodName(type: ReviewPeriod['type'], year: number): string {
  if (type === 'Annual') {
    return `Annual ${year}`;
  }
  if (type === 'Custom') {
    return `Custom ${year}`;
  }
  return `${type} ${year}`;
}

export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function getDaysRemaining(endDate: string): number {
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function isPeriodActive(period: ReviewPeriod): boolean {
  if (period.status !== 'active') return false;
  const now = new Date();
  const start = new Date(period.startDate);
  const end = new Date(period.endDate);
  return now >= start && now <= end;
}
