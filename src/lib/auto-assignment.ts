/**
 * Auto-assignment logic: preview and generate appraisal assignments from org structure.
 * Uses Reports To first; falls back to same-team (member's team = leader/exec's department) when Reports To is missing.
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
  includeExecToLeader: true,
};

/** Direct reports = has reportsTo→this id, or (member in same team when manager has teamId). */
function countDirectReports(managerId: string, managerTeamId: string | undefined, employees: Employee[]): number {
  const byReportsTo = employees.filter((m) => m.reportsTo === managerId).length;
  if (byReportsTo > 0) return byReportsTo;
  if (!managerTeamId) return 0;
  return employees.filter((m) => m.hierarchy === 'member' && m.teamId === managerTeamId).length;
}

/** Build preview of what auto-assignments would be created from current employees. */
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

  const isManager = (e: Employee) => e.hierarchy === 'leader' || e.hierarchy === 'executive';

  // Members with neither Reports To nor team get skipped
  const membersNoReportNoTeam = employees.filter((e) => e.hierarchy === 'member' && !e.reportsTo && !e.teamId);
  if (membersNoReportNoTeam.length > 0) {
    warnings.push(`${membersNoReportNoTeam.length} member(s) have no "Reports To" and no team – set one on the Employees tab to include them.`);
  }

  const managersWithNoReports = employees.filter((e) => isManager(e) && countDirectReports(e.id, e.teamId, employees) === 0);
  if (managersWithNoReports.length > 0) {
    warnings.push(`${managersWithNoReports.length} manager(s) have no direct reports (set "Reports To" on members, or put members in the same team).`);
  }

  const seenL2M = new Set<string>();
  const seenM2L = new Set<string>();

  // RULE 1: Leader → Member — from Reports To, or same-team fallback when member has no reportsTo
  if (opts.includeLeaderToMember) {
    for (const member of employees) {
      if (member.hierarchy !== 'member') continue;
      let managers: Employee[] = [];
      if (member.reportsTo) {
        const m = byId.get(member.reportsTo);
        if (m && isManager(m)) managers = [m];
      } else if (member.teamId) {
        managers = employees.filter((e) => isManager(e) && e.teamId === member.teamId);
      }
      for (const manager of managers) {
        const key = `${manager.id}:${member.id}`;
        if (seenL2M.has(key)) continue;
        seenL2M.add(key);
        leaderToMember.push({
          appraiserId: manager.id,
          appraiserName: manager.name,
          employeeId: member.id,
          employeeName: member.name,
        });
      }
    }
  }

  // RULE 2: Member → Leader — same pairs as above, reversed
  if (opts.includeMemberToLeader) {
    for (const member of employees) {
      if (member.hierarchy !== 'member') continue;
      let managers: Employee[] = [];
      if (member.reportsTo) {
        const m = byId.get(member.reportsTo);
        if (m && isManager(m)) managers = [m];
      } else if (member.teamId) {
        managers = employees.filter((e) => isManager(e) && e.teamId === member.teamId);
      }
      for (const manager of managers) {
        const key = `${member.id}:${manager.id}`;
        if (seenM2L.has(key)) continue;
        seenM2L.add(key);
        memberToLeader.push({
          appraiserId: member.id,
          appraiserName: member.name,
          employeeId: manager.id,
          employeeName: manager.name,
        });
      }
    }
  }

  // RULE 3: Leader → Leader — peer review among department heads (any manager with a team)
  // Includes same-team peers AND cross-department: e.g. Stephanie (A&R) and Min Khant (YouTube) appraise each other
  if (opts.includeLeaderToLeader) {
    const departmentHeads = employees.filter((e) => isManager(e) && e.teamId);
    for (const appraiser of departmentHeads) {
      for (const target of departmentHeads) {
        if (appraiser.id === target.id) continue;
        leaderToLeader.push({
          appraiserId: appraiser.id,
          appraiserName: appraiser.name,
          employeeId: target.id,
          employeeName: target.name,
        });
      }
    }
    if (departmentHeads.length > 0 && leaderToLeader.length === 0) {
      warnings.push('Leader→Leader needs at least 2 people who lead a department (Leader or Executive with team set).');
    }
  }

  // RULE 4: Executive → Leader — every executive appraises every leader (org-wide)
  // So Stephanie (Executive, A&R) appraises Min Khant (Leader, YouTube), and vice-type pairs
  if (opts.includeExecToLeader) {
    const execs = employees.filter((e) => e.hierarchy === 'executive');
    const leaders = employees.filter((e) => e.hierarchy === 'leader');
    for (const exec of execs) {
      for (const leader of leaders) {
        execToLeader.push({
          appraiserId: exec.id,
          appraiserName: exec.name,
          employeeId: leader.id,
          employeeName: leader.name,
        });
      }
    }
    if (execs.length > 0 && leaders.length > 0 && execToLeader.length === 0) {
      warnings.push('No Executive→Leader pairs: add at least one Leader and one Executive.');
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
