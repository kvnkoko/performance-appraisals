/**
 * Auto-assignment logic: preview and generate appraisal assignments from org structure.
 * Uses Reports To first; falls back to same-team (member's team = leader's department) when Reports To is missing.
 * Executives and chairman are never appraised by anyone. Exec/leads only do Exec→Leader.
 * Only pure leaders (hierarchy='leader') do Leader→Member, Leader→Leader, and are targets of Member→Leader and Exec→Leader.
 */
import type { Employee, AppraisalAssignment, AssignmentRelationshipType } from '@/types';
import { generateId } from '@/lib/utils';

const isChairman = (e: Employee): boolean => e.hierarchy === 'chairman';
const isExecutive = (e: Employee): boolean => e.hierarchy === 'executive';
const isPureLeader = (e: Employee): boolean => e.hierarchy === 'leader' || e.hierarchy === 'department-leader';

export interface AutoAssignmentPreview {
  leaderToMember: { appraiserId: string; appraiserName: string; employeeId: string; employeeName: string }[];
  memberToLeader: { appraiserId: string; appraiserName: string; employeeId: string; employeeName: string }[];
  leaderToLeader: { appraiserId: string; appraiserName: string; employeeId: string; employeeName: string }[];
  execToLeader: { appraiserId: string; appraiserName: string; employeeId: string; employeeName: string }[];
  hrToAll: { appraiserId: string; appraiserName: string; employeeId: string; employeeName: string }[];
  warnings: string[];
}

export interface AutoAssignmentOptions {
  includeLeaderToMember: boolean;
  includeMemberToLeader: boolean;
  includeLeaderToLeader: boolean;
  includeExecToLeader: boolean;
  includeHrToAll: boolean;
}

const DEFAULT_OPTIONS: AutoAssignmentOptions = {
  includeLeaderToMember: true,
  includeMemberToLeader: true,
  includeLeaderToLeader: true,
  includeExecToLeader: true,
  includeHrToAll: false,
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
  const hrToAll: AutoAssignmentPreview['hrToAll'] = [];

  // Only pure leaders do Leader→Member; executives (including exec/leads) do not.
  const managersWithNoReports = employees.filter(
    (e) => isPureLeader(e) && countDirectReports(e.id, e.teamId, employees) === 0
  );
  if (managersWithNoReports.length > 0) {
    warnings.push(`${managersWithNoReports.length} leader(s) have no direct reports (set "Reports To" on members, or put members in the same team).`);
  }

  // Members with neither Reports To nor team get skipped
  const membersNoReportNoTeam = employees.filter((e) => e.hierarchy === 'member' && !e.reportsTo && !e.teamId);
  if (membersNoReportNoTeam.length > 0) {
    warnings.push(`${membersNoReportNoTeam.length} member(s) have no "Reports To" and no team – set one on the Employees tab to include them.`);
  }

  const seenL2M = new Set<string>();
  const seenM2L = new Set<string>();

  // RULE 1: Leader → Member — only pure leaders (hierarchy='leader') do this; exec/leads do NOT.
  // (a) From Reports To or same-team; (b) ensure every pure-leader department head gets every member in that team.
  if (opts.includeLeaderToMember) {
    for (const member of employees) {
      if (member.hierarchy !== 'member') continue;
      let managers: Employee[] = [];
      if (member.reportsTo) {
        const m = byId.get(member.reportsTo);
        if (m && isPureLeader(m)) managers = [m];
      }
      if (member.teamId) {
        const teamManagers = employees.filter((e) => isPureLeader(e) && e.teamId === member.teamId);
        managers = [...new Map([...managers, ...teamManagers].map((e) => [e.id, e])).values()];
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
    // Ensure every pure-leader department head gets all members in their department
    for (const manager of employees) {
      if (!isPureLeader(manager) || !manager.teamId) continue;
      const deptMembers = employees.filter((e) => e.hierarchy === 'member' && e.teamId === manager.teamId);
      for (const member of deptMembers) {
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

  // RULE 2: Member → Leader — members only appraise pure leaders (never executives).
  // Same pairs as Leader→Member reversed; target (employeeId) is always pure leader after RULE 1.
  if (opts.includeMemberToLeader) {
    for (const pair of leaderToMember) {
      const leader = byId.get(pair.appraiserId);
      if (!leader || !isPureLeader(leader)) continue; // defensive: never target executives
      const key = `${pair.employeeId}:${pair.appraiserId}`;
      if (seenM2L.has(key)) continue;
      seenM2L.add(key);
      memberToLeader.push({
        appraiserId: pair.employeeId,
        appraiserName: pair.employeeName,
        employeeId: pair.appraiserId,
        employeeName: pair.appraiserName,
      });
    }
  }

  // RULE 3: Leader → Leader — only pure leaders; executives (including exec/leads) do NOT participate.
  if (opts.includeLeaderToLeader) {
    const leaders = employees.filter(isPureLeader);
    for (const appraiser of leaders) {
      for (const target of leaders) {
        if (appraiser.id === target.id) continue;
        leaderToLeader.push({
          appraiserId: appraiser.id,
          appraiserName: appraiser.name,
          employeeId: target.id,
          employeeName: target.name,
        });
      }
    }
    if (leaders.length > 0 && leaderToLeader.length === 0) {
      warnings.push('Leader→Leader needs at least 2 leaders in the company.');
    }
  }

  // RULE 4: Executive → Leader — executives appraise only pure leaders; executives are never targets.
  if (opts.includeExecToLeader) {
    const execs = employees.filter(isExecutive);
    const leadersForExec = employees.filter(isPureLeader);
    for (const exec of execs) {
      for (const leader of leadersForExec) {
        execToLeader.push({
          appraiserId: exec.id,
          appraiserName: exec.name,
          employeeId: leader.id,
          employeeName: leader.name,
        });
      }
    }
    if (execs.length > 0 && leadersForExec.length === 0) {
      warnings.push('Executive→Leader: No pure leaders in the company. Executives have no one to appraise.');
    }
    if (execs.length > 0 && leadersForExec.length > 0 && execToLeader.length === 0) {
      warnings.push('No Executive→Leader pairs: add at least one Leader and one Executive.');
    }
  }

  // RULE 5: HR → All — HR appraises non-HR employees; executives and chairman are never targets.
  if (opts.includeHrToAll) {
    const hrStaff = employees.filter((e) => e.hierarchy === 'hr');
    const allOthers = employees.filter((e) => e.hierarchy !== 'hr' && !isExecutive(e) && !isChairman(e));
    for (const hrPerson of hrStaff) {
      for (const employee of allOthers) {
        hrToAll.push({
          appraiserId: hrPerson.id,
          appraiserName: hrPerson.name,
          employeeId: employee.id,
          employeeName: employee.name,
        });
      }
    }
    if (hrStaff.length > 0 && allOthers.length === 0) {
      warnings.push('HR→All: No appraisable employees (only HR and executives). Add members or leaders.');
    }
    if (hrStaff.length === 0 && opts.includeHrToAll) {
      warnings.push('HR→All: No HR employees in the system. Add employees with hierarchy "HR" to include HR reviews.');
    }
  }

  return {
    leaderToMember,
    memberToLeader,
    leaderToLeader,
    execToLeader,
    hrToAll,
    warnings,
  };
}

/** Map relationship type to template-type hint. */
export function relationshipToTemplateType(
  rel: 'leader-to-member' | 'member-to-leader' | 'leader-to-leader' | 'exec-to-leader' | 'hr-to-all' | 'custom'
): AssignmentRelationshipType {
  const map: Record<string, AssignmentRelationshipType> = {
    'leader-to-member': 'leader-to-member',
    'member-to-leader': 'member-to-leader',
    'leader-to-leader': 'leader-to-leader',
    'exec-to-leader': 'exec-to-leader',
    'hr-to-all': 'hr-to-all',
    custom: 'custom',
  };
  return map[rel] ?? 'custom';
}

export interface TemplateMapping {
  leaderToMember: string;
  memberToLeader: string;
  leaderToLeader: string;
  execToLeader: string;
  hrToAll: string;
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
  for (const row of preview.hrToAll) {
    push('hr-to-all', 'auto', row.appraiserId, row.appraiserName, row.employeeId, row.employeeName, templateMapping.hrToAll);
  }

  return out;
}
