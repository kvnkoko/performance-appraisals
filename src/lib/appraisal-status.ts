import type { Appraisal, AppraisalAssignment, AppraisalLink } from '@/types';

/** One reviewer reviewing one person in one review period. */
export function pairKey(reviewPeriodId: string, appraiserId: string, employeeId: string): string {
  return `${reviewPeriodId}|${appraiserId}|${employeeId}`;
}

export function assignmentKey(a: Pick<AppraisalAssignment, 'reviewPeriodId' | 'appraiserId' | 'employeeId' | 'relationshipType'>): string {
  return `${pairKey(a.reviewPeriodId, a.appraiserId, a.employeeId)}|${a.relationshipType}`;
}

/** Appraisal id for a submitted assignment. Deterministic so a second submission collides instead of duplicating. */
export function appraisalIdForAssignment(assignmentId: string): string {
  return `asg_${assignmentId}`;
}

/** Appraisal id for a submitted one-off link. */
export function appraisalIdForLink(linkId: string): string {
  return `lnk_${linkId}`;
}

/** Pairs that already have a submitted appraisal. */
export function buildSubmittedPairSet(appraisals: Appraisal[]): Set<string> {
  const set = new Set<string>();
  for (const a of appraisals) {
    if (a.completedAt) set.add(pairKey(a.reviewPeriodId, a.appraiserId, a.employeeId));
  }
  return set;
}

/**
 * A form counts as done when its status says so OR when the same reviewer already submitted an
 * appraisal of the same person in the same period. The second check catches duplicate forms and
 * forms whose status update never reached the server.
 */
export function isAssignmentDone(assignment: AppraisalAssignment, submittedPairs: Set<string>): boolean {
  return (
    assignment.status === 'completed' ||
    submittedPairs.has(pairKey(assignment.reviewPeriodId, assignment.appraiserId, assignment.employeeId))
  );
}

export function isLinkDone(link: AppraisalLink, appraisalIds: Set<string>): boolean {
  return link.used || appraisalIds.has(appraisalIdForLink(link.id));
}

/** Assignments with their effective status, keeping only one form per reviewer/person/period/relationship. */
export function effectiveAssignments(assignments: AppraisalAssignment[], appraisals: Appraisal[]): AppraisalAssignment[] {
  const submitted = buildSubmittedPairSet(appraisals);
  const byKey = new Map<string, AppraisalAssignment>();
  for (const a of assignments) {
    const effective: AppraisalAssignment = isAssignmentDone(a, submitted) ? { ...a, status: 'completed' } : a;
    const key = assignmentKey(a);
    const existing = byKey.get(key);
    if (!existing || preferAssignment(effective, existing)) byKey.set(key, effective);
  }
  return [...byKey.values()];
}

/** Keep the completed copy, otherwise the oldest. */
function preferAssignment(candidate: AppraisalAssignment, current: AppraisalAssignment): boolean {
  const candidateDone = candidate.status === 'completed';
  const currentDone = current.status === 'completed';
  if (candidateDone !== currentDone) return candidateDone;
  return new Date(candidate.createdAt).getTime() < new Date(current.createdAt).getTime();
}
