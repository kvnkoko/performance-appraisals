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

  // RULE 1: Leader → Member — leaders (and execs leading a dept) see forms for all members of their department
  // (a) From Reports To or same-team when member has no reportsTo; (b) then ensure every manager with teamId gets every member in that team
  if (opts.includeLeaderToMember) {
    for (const member of employees) {
      if (member.hierarchy !== 'member') continue;
      let managers: Employee[] = [];
      if (member.reportsTo) {
        const m = byId.get(member.reportsTo);
        if (m && isManager(m)) managers = [m];
      }
      if (member.teamId) {
        const teamManagers = employees.filter((e) => isManager(e) && e.teamId === member.teamId);
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
    // Ensure every department head gets all members in their department (even if reportsTo points elsewhere)
    for (const manager of employees) {
      if (!isManager(manager) || !manager.teamId) continue;
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

  // RULE 2: Member → Leader — each member sees form(s) for their leader(s) / department head(s) (upward feedback)
  // Same pairs as Leader→Member reversed: member gives feedback to each manager who appraises them.
  if (opts.includeMemberToLeader) {
    for (const pair of leaderToMember) {
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

  // RULE 3: Leader → Leader — every leader appraises every other leader (company-wide peer review)
  // All leaders in the company see a form for each other leader.
  if (opts.includeLeaderToLeader) {
    const leaders = employees.filter((e) => e.hierarchy === 'leader');
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

  // RULE 4: Executive → Leader — every executive appraises every leader (org-wide)
  // Each exec sees one appraisal form per leader in the company (N execs × M leaders = N×M assignments).
  if (opts.includeExecToLeader) {
    const execs = employees.filter((e) => e.hierarchy === 'executive');
    const leadersForExec = employees.filter((e) => e.hierarchy === 'leader');
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
    if (execs.length > 0 && leadersForExec.length > 0 && execToLeader.length === 0) {
      warnings.push('No Executive→Leader pairs: add at least one Leader and one Executive.');
    }
  }

  // RULE 5: HR → All — each HR employee appraises ALL non-HR employees (no HR→HR)
  if (opts.includeHrToAll) {
    const hrStaff = employees.filter((e) => e.hierarchy === 'hr');
    const allOthers = employees.filter((e) => e.hierarchy !== 'hr');
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
      warnings.push('HR→All: No non-HR employees to appraise. Add members, leaders, or executives.');
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
