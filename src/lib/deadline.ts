/**
 * Submission deadlines, mirroring submission_window() in the database (which is what enforces them).
 * A form is due at the end of its review period, or on the day an administrator reopened it, and is
 * accepted for 7 more days after that, marked late. Dates are calendar days in Myanmar time.
 */
export const GRACE_DAYS = 7;
const TIME_ZONE = 'Asia/Yangon';

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD for an instant, in Myanmar time. */
function localDay(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

/** Period end dates are plain dates; timestamps (a reopen) are converted to the Myanmar calendar day. */
function toDay(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : localDay(d);
}

function dayNumber(day: string): number {
  return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / DAY_MS;
}

function addDays(day: string, days: number): string {
  return new Date((dayNumber(day) + days) * DAY_MS).toISOString().slice(0, 10);
}

export interface SubmissionWindow {
  /** The original deadline (end of the review period). */
  dueDay: string | null;
  /** Last day a submission is accepted. */
  cutoffDay: string | null;
  /** How late a submission made today would be. */
  lateDays: number;
  isLate: boolean;
  isClosed: boolean;
}

export function submissionWindow(periodEnd: string | null | undefined, reopenedAt?: string | null, now = new Date()): SubmissionWindow {
  const end = toDay(periodEnd);
  const reopened = toDay(reopenedAt);
  const base = end && reopened ? (end > reopened ? end : reopened) : end ?? reopened;
  const today = localDay(now);
  const due = end ?? reopened;
  const lateDays = due ? Math.max(0, dayNumber(today) - dayNumber(due)) : 0;
  const cutoffDay = base ? addDays(base, GRACE_DAYS) : null;
  return {
    dueDay: due,
    cutoffDay,
    lateDays,
    isLate: lateDays > 0,
    isClosed: !!cutoffDay && today > cutoffDay,
  };
}

/** "3 days late", "1 day late" */
export function describeLate(days: number): string {
  return `${days} day${days === 1 ? '' : 's'} late`;
}

export function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** One-line status for a pending form: due, overdue but still accepted, or closed. */
export function deadlineText(w: SubmissionWindow, closedHint = 'ask an administrator to reopen it'): string {
  if (!w.dueDay) return 'No deadline';
  if (w.isClosed) return `Closed on ${formatDay(w.cutoffDay!)}; ${closedHint}`;
  if (w.isLate) return `Overdue (${describeLate(w.lateDays)}); accepted until ${formatDay(w.cutoffDay!)}`;
  return `Due ${formatDay(w.dueDay)}`;
}
