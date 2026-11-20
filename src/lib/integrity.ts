import type { Appraisal, AppraisalAssignment, AppraisalLink } from '@/types';
import {
  getAppraisalAssignments,
  getAppraisals,
  getEmployees,
  getLinks,
  getReviewPeriods,
  getTemplates,
  saveAppraisalAssignment,
  saveLink,
  deleteAppraisalAssignments,
} from '@/lib/storage';
import { assignmentKey, buildSubmittedPairSet, effectiveAssignments, pairKey } from '@/lib/appraisal-status';

export type IntegrityIssueKind =
  | 'pending-but-submitted'
  | 'duplicate-form'
  | 'link-not-marked-used'
  | 'duplicate-submission'
  | 'missing-reference';

export interface IntegrityIssue {
  kind: IntegrityIssueKind;
  /** Fixed automatically by "Fix" (otherwise report only). */
  autoFix: boolean;
  period: string;
  reviewer: string;
  employee: string;
  detail: string;
  recordId: string;
}

export interface IntegrityScan {
  scannedAt: string;
  issues: IntegrityIssue[];
  toMarkCompleted: AppraisalAssignment[];
  toDelete: AppraisalAssignment[];
  linksToMarkUsed: AppraisalLink[];
}

export const ISSUE_LABELS: Record<IntegrityIssueKind, string> = {
  'pending-but-submitted': 'Form shows pending but the review was already submitted',
  'duplicate-form': 'Duplicate form (same reviewer, person, period and type)',
  'link-not-marked-used': 'Link still open but the review was already submitted',
  'duplicate-submission': 'Same reviewer submitted more than once for the same person and period',
  'missing-reference': 'Submitted appraisal points to a deleted employee, template or period',
};

/** Read-only scan of forms, links and submitted appraisals. Nothing is changed. */
export async function scanIntegrity(): Promise<IntegrityScan> {
  const [assignments, appraisals, links, employees, templates, periods] = await Promise.all([
    getAppraisalAssignments(),
    getAppraisals(),
    getLinks(),
    getEmployees(),
    getTemplates(),
    getReviewPeriods(),
  ]);

  const employeeName = new Map(employees.map((e) => [e.id, e.name]));
  const periodName = new Map(periods.map((p) => [p.id, p.name]));
  const templateIds = new Set(templates.map((t) => t.id));
  const nameOf = (id: string, fallback?: string) => employeeName.get(id) ?? fallback ?? `(deleted: ${id})`;
  const periodOf = (id: string, fallback?: string) => periodName.get(id) ?? fallback ?? `(deleted: ${id})`;

  const issues: IntegrityIssue[] = [];
  const submitted = buildSubmittedPairSet(appraisals);

  // Duplicate forms: keep the one effectiveAssignments keeps, delete the rest.
  const kept = new Set(effectiveAssignments(assignments, appraisals).map((a) => a.id));
  const toDelete = assignments.filter((a) => !kept.has(a.id));
  for (const a of toDelete) {
    issues.push({
      kind: 'duplicate-form',
      autoFix: true,
      period: periodOf(a.reviewPeriodId),
      reviewer: nameOf(a.appraiserId, a.appraiserName),
      employee: nameOf(a.employeeId, a.employeeName),
      detail: `Extra ${a.relationshipType} form created ${a.createdAt}; will be removed (one copy is kept).`,
      recordId: a.id,
    });
  }

  const toMarkCompleted = assignments.filter(
    (a) =>
      kept.has(a.id) &&
      a.status !== 'completed' &&
      submitted.has(pairKey(a.reviewPeriodId, a.appraiserId, a.employeeId))
  );
  for (const a of toMarkCompleted) {
    issues.push({
      kind: 'pending-but-submitted',
      autoFix: true,
      period: periodOf(a.reviewPeriodId),
      reviewer: nameOf(a.appraiserId, a.appraiserName),
      employee: nameOf(a.employeeId, a.employeeName),
      detail: `Status "${a.status}" will be set to completed.`,
      recordId: a.id,
    });
  }

  const linksToMarkUsed = links.filter(
    (l) => !l.used && submitted.has(pairKey(l.reviewPeriodId, l.appraiserId, l.employeeId))
  );
  for (const l of linksToMarkUsed) {
    issues.push({
      kind: 'link-not-marked-used',
      autoFix: true,
      period: periodOf(l.reviewPeriodId, l.reviewPeriodName),
      reviewer: nameOf(l.appraiserId),
      employee: nameOf(l.employeeId),
      detail: 'Link will be closed so it cannot be submitted again.',
      recordId: l.id,
    });
  }

  const byPair = new Map<string, Appraisal[]>();
  for (const a of appraisals) {
    if (!a.completedAt) continue;
    const key = pairKey(a.reviewPeriodId, a.appraiserId, a.employeeId);
    byPair.set(key, [...(byPair.get(key) ?? []), a]);
  }
  for (const group of byPair.values()) {
    if (group.length < 2) continue;
    const first = group[0];
    const scores = group.map((a) => `${a.score}/${a.maxScore} on ${a.completedAt}`).join('; ');
    issues.push({
      kind: 'duplicate-submission',
      autoFix: false,
      period: periodOf(first.reviewPeriodId, first.reviewPeriodName),
      reviewer: nameOf(first.appraiserId),
      employee: nameOf(first.employeeId),
      detail: `${group.length} submissions (${scores}). Both count toward rankings; review and delete the wrong one from the Submission Tracker.`,
      recordId: group.map((a) => a.id).join(' | '),
    });
  }

  for (const a of appraisals) {
    const missing: string[] = [];
    if (!employeeName.has(a.employeeId)) missing.push('employee');
    if (!employeeName.has(a.appraiserId)) missing.push('reviewer');
    if (!templateIds.has(a.templateId)) missing.push('template');
    if (!periodName.has(a.reviewPeriodId)) missing.push('review period');
    if (missing.length === 0) continue;
    issues.push({
      kind: 'missing-reference',
      autoFix: false,
      period: periodOf(a.reviewPeriodId, a.reviewPeriodName),
      reviewer: nameOf(a.appraiserId),
      employee: nameOf(a.employeeId),
      detail: `Missing ${missing.join(', ')}.`,
      recordId: a.id,
    });
  }

  return { scannedAt: new Date().toISOString(), issues, toMarkCompleted, toDelete, linksToMarkUsed };
}

/** Apply the automatic fixes from a scan. Submitted appraisals are never modified or deleted. */
export async function applyIntegrityFixes(scan: IntegrityScan): Promise<{ completed: number; removed: number; linksClosed: number }> {
  for (const a of scan.toMarkCompleted) await saveAppraisalAssignment({ ...a, status: 'completed' });
  for (const l of scan.linksToMarkUsed) await saveLink({ ...l, used: true });
  await deleteAppraisalAssignments(scan.toDelete.map((a) => a.id));
  return { completed: scan.toMarkCompleted.length, removed: scan.toDelete.length, linksClosed: scan.linksToMarkUsed.length };
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function integrityReportCsv(scan: IntegrityScan, fixedAt?: string): string {
  const header = ['Issue', 'Action', 'Review period', 'Reviewer', 'Employee', 'Details', 'Record ID'];
  const rows = scan.issues.map((i) => [
    ISSUE_LABELS[i.kind],
    i.autoFix ? (fixedAt ? `Fixed ${fixedAt}` : 'Will be fixed') : 'Needs manual review',
    i.period,
    i.reviewer,
    i.employee,
    i.detail,
    i.recordId,
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
}
