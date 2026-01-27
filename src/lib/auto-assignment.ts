/**
 * Auto-assignment logic: preview and generate appraisal assignments from org structure (reportsTo).
 * Complements manual link creation; both coexist.
 */
import type { Employee, AppraisalAssignment, AssignmentRelationshipType } from '@/types';
import { generateId } from '@/lib/utils';

export interface AutoAssignmentPreview {
  leaderToMember: { appraiserId: string; appraiserName: string; employeeId: string; employeeName: string }[];
  memberToLeader: { appraiserId: string; appraiserName: string; employeeId: string; employeeName: string }[];
  leaderToLeader: { appraiserId: string; appraiserName: string; employeeId: string; employeeName: string }[];
  execToLeader: { appraiserId: string; appraiserName: string; employeeId: string; employeeName: string }[];
  warnings: string[];
}

export interface AutoAssignmentOptions {
  includeLeaderToMember: boolean;
  includeMemberToLeader: boolean;
  includeLeaderToLeader: boolean;
  includeExecToLeader: boolean;
}

const DEFAULT_OPTIONS: AutoAssignmentOptions = {
  includeLeaderToMember: true,
  includeMemberToLeader: true,
  includeLeaderToLeader: false,
  includeExecToLeader: false,
};

/** Build preview of what auto-assignments would be created from current employees and reportsTo. */
export function previewAutoAssignments(
  employees: Employee[],
  _reviewPeriodId: string,
  options: Partial<AutoAssignmentOptions> = {}
): AutoAssignmentPreview {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const byId = new Map(employees.map((e) => [e.id, e]));
  const warnings: string[] = [];
  const leaderToMember: AutoAssignmentPreview['leaderToMember'] = [];
  const memberToLeader: AutoAssignmentPreview['memberToLeader'] = [];
  const leaderToLeader: AutoAssignmentPreview['leaderToLeader'] = [];
  const execToLeader: AutoAssignmentPreview['execToLeader'] = [];

  // "Managers" = anyone who can have direct reports (leaders + executives who can lead departments)
  const isManager = (e: Employee) => e.hierarchy === 'leader' || e.hierarchy === 'executive';

  const membersWithoutReportsTo = employees.filter((e) => e.hierarchy === 'member' && !e.reportsTo);
  if (membersWithoutReportsTo.length > 0) {
    warnings.push(`${membersWithoutReportsTo.length} member(s) have no "Reports To" set – skipped for Leader→Member and Member→Leader.`);
  }

  const managersWithNoReports = employees.filter((e) => isManager(e) && !employees.some((m) => m.reportsTo === e.id));
  if (managersWithNoReports.length > 0) {
    warnings.push(`${managersWithNoReports.length} manager(s) (leaders/executives) have no direct reports.`);
  }

  // RULE 1: Leader → Member (manager appraises direct report; manager = leader OR executive)
  if (opts.includeLeaderToMember) {
    for (const member of employees) {
      if (member.hierarchy !== 'member' || !member.reportsTo) continue;
      const manager = byId.get(member.reportsTo);
      if (!manager || !isManager(manager)) continue;
      leaderToMember.push({
        appraiserId: manager.id,
        appraiserName: manager.name,
        employeeId: member.id,
        employeeName: member.name,
      });
    }
  }

  // RULE 2: Member → Leader (upward feedback; manager = leader OR executive)
  if (opts.includeMemberToLeader) {
    for (const member of employees) {
      if (member.hierarchy !== 'member' || !member.reportsTo) continue;
      const manager = byId.get(member.reportsTo);
      if (!manager) continue;
      memberToLeader.push({
        appraiserId: member.id,
        appraiserName: member.name,
        employeeId: manager.id,
        employeeName: manager.name,
      });
    }
  }

  // RULE 3: Leader → Leader (peer review in same department; includes executives who lead that department)
  if (opts.includeLeaderToLeader) {
    const departmentLeaders = employees.filter((e) => isManager(e) && e.teamId);
    const sameTeam = (a: Employee, b: Employee) => (a.teamId && b.teamId && a.teamId === b.teamId) || (!a.teamId && !b.teamId);
    for (const appraiser of departmentLeaders) {
      for (const target of departmentLeaders) {
        if (appraiser.id === target.id) continue;
        if (!sameTeam(appraiser, target)) continue;
        leaderToLeader.push({
          appraiserId: appraiser.id,
          appraiserName: appraiser.name,
          employeeId: target.id,
          employeeName: target.name,
        });
      }
    }
  }

  // RULE 4: Executive → Leader (exec appraises leaders in same department; execs who lead a dept are in leader peer pool above)
  if (opts.includeExecToLeader) {
    const execs = employees.filter((e) => e.hierarchy === 'executive' && e.teamId);
    const leaders = employees.filter((e) => e.hierarchy === 'leader');
    for (const exec of execs) {
      for (const leader of leaders) {
        if (!exec.teamId || !leader.teamId || exec.teamId !== leader.teamId) continue;
        execToLeader.push({
          appraiserId: exec.id,
          appraiserName: exec.name,
          employeeId: leader.id,
          employeeName: leader.name,
        });
      }
    }
  }

  return {
    leaderToMember,
    memberToLeader,
    leaderToLeader,
    execToLeader,
    warnings,
  };
}

/** Map relationship type to template-type hint. */
export function relationshipToTemplateType(
  rel: 'leader-to-member' | 'member-to-leader' | 'leader-to-leader' | 'exec-to-leader' | 'custom'
): AssignmentRelationshipType {
  const map: Record<string, AssignmentRelationshipType> = {
    'leader-to-member': 'leader-to-member',
    'member-to-leader': 'member-to-leader',
    'leader-to-leader': 'leader-to-leader',
    'exec-to-leader': 'exec-to-leader',
    custom: 'custom',
  };
  return map[rel] ?? 'custom';
}

export interface TemplateMapping {
  leaderToMember: string;
  memberToLeader: string;
  leaderToLeader: string;
  execToLeader: string;
}

/** Turn preview rows into AppraisalAssignment[] with chosen templates and due date. */
export function buildAssignmentsFromPreview(
  preview: AutoAssignmentPreview,
  templateMapping: TemplateMapping,
  reviewPeriodId: string,
  reviewPeriodName: string,
  dueDate?: string
): AppraisalAssignment[] {
  const out: AppraisalAssignment[] = [];
  const now = new Date().toISOString();

  const push = (
    rel: AssignmentRelationshipType,
    type: 'auto' | 'manual',
    appraiserId: string,
    appraiserName: string,
    employeeId: string,
    employeeName: string,
    templateId: string
  ) => {
    out.push({
      id: generateId(),
      reviewPeriodId,
      appraiserId,
      appraiserName,
      employeeId,
      employeeName,
      relationshipType: rel,
      templateId,
      status: 'pending',
      assignmentType: type,
      createdAt: now,
      dueDate,
    });
  };

  for (const row of preview.leaderToMember) {
    push('leader-to-member', 'auto', row.appraiserId, row.appraiserName, row.employeeId, row.employeeName, templateMapping.leaderToMember);
  }
  for (const row of preview.memberToLeader) {
    push('member-to-leader', 'auto', row.appraiserId, row.appraiserName, row.employeeId, row.employeeName, templateMapping.memberToLeader);
  }
  for (const row of preview.leaderToLeader) {
    push('leader-to-leader', 'auto', row.appraiserId, row.appraiserName, row.employeeId, row.employeeName, templateMapping.leaderToLeader);
  }
  for (const row of preview.execToLeader) {
    push('exec-to-leader', 'auto', row.appraiserId, row.appraiserName, row.employeeId, row.employeeName, templateMapping.execToLeader);
  }

  return out;
}
