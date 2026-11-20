// Supabase data access for every entity except users (see supabase.ts).
// Every function throws on failure so callers can tell "the server failed" apart from
// "there is no data". Never return an empty list or undefined for an error: the storage
// layer treats those as authoritative and would overwrite the local cache with them.

import type {
  Template,
  Employee,
  Appraisal,
  AppraisalLink,
  AppraisalAssignment,
  CompanySettings,
  PerformanceSummary,
  ReviewPeriod,
  Team,
  User,
  EmployeeProfile,
} from '@/types';
import { isSupabaseConfigured, getSupabaseClient } from './supabase';

const VALID_HIERARCHIES: Employee['hierarchy'][] = ['chairman', 'executive', 'leader', 'department-leader', 'member', 'hr'];
function normalizeHierarchy(h: string | null | undefined): Employee['hierarchy'] {
  if (h && VALID_HIERARCHIES.includes(h as Employee['hierarchy'])) return h as Employee['hierarchy'];
  return 'member';
}

/** Value to send to Supabase. Maps 'department-leader' -> 'leader' for DBs that only allow legacy constraint. */
function hierarchyForSupabase(h: Employee['hierarchy']): string {
  return h === 'department-leader' ? 'leader' : h;
}

const TABLES = {
  TEMPLATES: 'templates',
  EMPLOYEES: 'employees',
  APPRAISALS: 'appraisals',
  APPRAISAL_LINKS: 'appraisal_links',
  APPRAISAL_ASSIGNMENTS: 'appraisal_assignments',
  SETTINGS: 'settings',
  REVIEW_PERIODS: 'review_periods',
  PERFORMANCE_SUMMARIES: 'performance_summaries',
  EMPLOYEE_PROFILES: 'employee_profiles',
  TEAMS: 'teams',
  USERS: 'users',
};

/** Thrown when an appraisal for the same form was already submitted. */
export class AlreadySubmittedError extends Error {
  constructor(message = 'This appraisal has already been submitted.') {
    super(message);
    this.name = 'AlreadySubmittedError';
  }
}

const UNIQUE_VIOLATION = '23505';

async function requireClient() {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured');
  const supabase = await getSupabaseClient();
  if (!supabase) throw new Error('Supabase client not available');
  return supabase;
}

function check(context: string, error: unknown): void {
  if (!error) return;
  console.error(`${context}:`, error);
  throw error;
}

function isMissingColumnError(err: unknown, columns: RegExp): boolean {
  const e = err as { message?: string; code?: string };
  if (e?.code === '23514' || e?.code === '23502') return false;
  if (e?.code === '42703' || e?.code === 'PGRST204') return true;
  return typeof e?.message === 'string' && columns.test(e.message);
}

function isMissingTableError(err: unknown): boolean {
  const e = err as { message?: string; code?: string };
  return e?.code === '42P01' || e?.code === 'PGRST205';
}

// ============================================
// TEMPLATES
// ============================================
function mapTemplate(t: any): Template {
  return {
    id: t.id,
    name: t.name,
    subtitle: t.subtitle || undefined,
    type: t.type,
    categories: t.categories || [],
    questions: t.questions || undefined,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    version: t.version || 1,
  };
}

export async function getTemplatesFromSupabase(): Promise<Template[]> {
  const supabase = await requireClient();
  const { data, error } = await supabase.from(TABLES.TEMPLATES).select('*').order('created_at', { ascending: false });
  check('getTemplatesFromSupabase', error);
  return (data || []).map(mapTemplate);
}

export async function getTemplateFromSupabase(id: string): Promise<Template | undefined> {
  const supabase = await requireClient();
  const { data, error } = await supabase.from(TABLES.TEMPLATES).select('*').eq('id', id).maybeSingle();
  check('getTemplateFromSupabase', error);
  return data ? mapTemplate(data) : undefined;
}

export async function saveTemplateToSupabase(template: Template): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.TEMPLATES).upsert(
    {
      id: template.id,
      name: template.name,
      subtitle: template.subtitle || null,
      type: template.type,
      categories: template.categories || [],
      questions: template.questions || null,
      created_at: template.createdAt || new Date().toISOString(),
      updated_at: template.updatedAt || new Date().toISOString(),
      version: template.version || 1,
    },
    { onConflict: 'id' }
  );
  check('saveTemplateToSupabase', error);
}

export async function deleteTemplateFromSupabase(id: string): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.TEMPLATES).delete().eq('id', id);
  check('deleteTemplateFromSupabase', error);
}

// ============================================
// EMPLOYEES
// ============================================
function mapEmployee(e: any): Employee {
  return {
    id: e.id,
    name: e.name,
    email: e.email,
    role: e.role,
    hierarchy: normalizeHierarchy(e.hierarchy),
    executiveType: e.executive_type ?? undefined,
    teamId: e.team_id,
    reportsTo: e.reports_to,
    // undefined (not 'permanent') when the column is absent, so the storage layer can tell
    // "column missing" apart from a real value.
    employmentStatus: (e.employment_status ?? undefined) as Employee['employmentStatus'],
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  };
}

export async function getEmployeesFromSupabase(): Promise<Employee[]> {
  const supabase = await requireClient();
  const { data, error } = await supabase.from(TABLES.EMPLOYEES).select('*').order('created_at', { ascending: false });
  check('getEmployeesFromSupabase', error);
  return (data || []).map(mapEmployee);
}

export async function getEmployeeFromSupabase(id: string): Promise<Employee | undefined> {
  const supabase = await requireClient();
  const { data, error } = await supabase.from(TABLES.EMPLOYEES).select('*').eq('id', id).maybeSingle();
  check('getEmployeeFromSupabase', error);
  return data ? mapEmployee(data) : undefined;
}

/** Update only team_id for an employee (assign/remove as department leader). Avoids full upsert 400s. */
export async function updateEmployeeTeamInSupabase(employeeId: string, teamId: string | null): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.EMPLOYEES).update({ team_id: teamId }).eq('id', employeeId);
  check('updateEmployeeTeamInSupabase', error);
}

const EMPLOYEE_OPTIONAL_COLUMNS = /reports_to|team_id|employment_status|executive_type|updated_at|schema cache|column.*employees/i;

export async function saveEmployeeToSupabase(employee: Employee): Promise<void> {
  const supabase = await requireClient();
  const hierarchyForDb = hierarchyForSupabase(normalizeHierarchy(employee.hierarchy as string | null | undefined));
  const fullPayload = {
    id: employee.id,
    name: String(employee.name ?? ''),
    email: employee.email ?? null,
    role: String(employee.role ?? ''),
    hierarchy: hierarchyForDb,
    executive_type: employee.executiveType ?? null,
    team_id: employee.teamId ?? null,
    reports_to: employee.reportsTo ?? null,
    employment_status: employee.employmentStatus ?? 'permanent',
    created_at: employee.createdAt || new Date().toISOString(),
    updated_at: employee.updatedAt || new Date().toISOString(),
  };

  const result = await supabase.from(TABLES.EMPLOYEES).upsert(fullPayload, { onConflict: 'id' });
  if (!result.error) return;
  if (!isMissingColumnError(result.error, EMPLOYEE_OPTIONAL_COLUMNS)) check('saveEmployeeToSupabase', result.error);

  // Older schema without some optional columns: save the base row, then set each optional column
  // individually so the ones that do exist still persist.
  const base = await supabase.from(TABLES.EMPLOYEES).upsert(
    {
      id: employee.id,
      name: fullPayload.name,
      email: fullPayload.email,
      role: fullPayload.role,
      hierarchy: hierarchyForDb,
      created_at: fullPayload.created_at,
    },
    { onConflict: 'id' }
  );
  check('saveEmployeeToSupabase (base)', base.error);
  const optional: Record<string, unknown> = {
    team_id: fullPayload.team_id,
    reports_to: fullPayload.reports_to,
    employment_status: fullPayload.employment_status,
    executive_type: fullPayload.executive_type,
  };
  for (const [column, value] of Object.entries(optional)) {
    const r = await supabase.from(TABLES.EMPLOYEES).update({ [column]: value }).eq('id', employee.id);
    if (r.error) console.warn(`Employee saved but ${column} could not be set (column missing?):`, r.error.message);
  }
}

export async function deleteEmployeeFromSupabase(id: string): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.EMPLOYEES).delete().eq('id', id);
  check('deleteEmployeeFromSupabase', error);
}

// ============================================
// APPRAISALS
// ============================================
function mapAppraisal(a: any): Appraisal {
  return {
    id: a.id,
    templateId: a.template_id,
    employeeId: a.employee_id,
    appraiserId: a.appraiser_id,
    reviewPeriodId: a.review_period_id,
    reviewPeriodName: a.review_period_name,
    responses: a.responses || [],
    score: a.score,
    maxScore: a.max_score,
    completedAt: a.completed_at,
    createdAt: a.created_at,
  };
}

function appraisalRow(appraisal: Appraisal) {
  return {
    id: appraisal.id,
    template_id: appraisal.templateId,
    employee_id: appraisal.employeeId,
    appraiser_id: appraisal.appraiserId,
    review_period_id: appraisal.reviewPeriodId,
    review_period_name: appraisal.reviewPeriodName,
    responses: appraisal.responses,
    score: appraisal.score,
    max_score: appraisal.maxScore,
    completed_at: appraisal.completedAt,
    created_at: appraisal.createdAt,
  };
}

export async function getAppraisalsFromSupabase(): Promise<Appraisal[]> {
  const supabase = await requireClient();
  const { data, error } = await supabase.from(TABLES.APPRAISALS).select('*').order('created_at', { ascending: false });
  check('getAppraisalsFromSupabase', error);
  return (data || []).map(mapAppraisal);
}

export async function getAppraisalFromSupabase(id: string): Promise<Appraisal | undefined> {
  const supabase = await requireClient();
  const { data, error } = await supabase.from(TABLES.APPRAISALS).select('*').eq('id', id).maybeSingle();
  check('getAppraisalFromSupabase', error);
  return data ? mapAppraisal(data) : undefined;
}

/** Submitted appraisals by one appraiser for one employee in one period. */
export async function getSubmittedAppraisalsForPairFromSupabase(
  reviewPeriodId: string,
  appraiserId: string,
  employeeId: string
): Promise<Appraisal[]> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from(TABLES.APPRAISALS)
    .select('*')
    .eq('review_period_id', reviewPeriodId)
    .eq('appraiser_id', appraiserId)
    .eq('employee_id', employeeId)
    .not('completed_at', 'is', null);
  check('getSubmittedAppraisalsForPairFromSupabase', error);
  return (data || []).map(mapAppraisal);
}

/** Insert-only: a second submission for the same form id fails with AlreadySubmittedError instead of overwriting. */
export async function insertAppraisalToSupabase(appraisal: Appraisal): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.APPRAISALS).insert(appraisalRow(appraisal));
  if (error && (error as { code?: string }).code === UNIQUE_VIOLATION) throw new AlreadySubmittedError();
  check('insertAppraisalToSupabase', error);
}

export async function saveAppraisalToSupabase(appraisal: Appraisal): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.APPRAISALS).upsert(appraisalRow(appraisal), { onConflict: 'id' });
  check('saveAppraisalToSupabase', error);
}

export async function deleteAppraisalFromSupabase(id: string): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.APPRAISALS).delete().eq('id', id);
  check('deleteAppraisalFromSupabase', error);
}

export async function countAppraisalsForEmployeeFromSupabase(employeeId: string): Promise<number> {
  const supabase = await requireClient();
  const { count, error } = await supabase
    .from(TABLES.APPRAISALS)
    .select('id', { count: 'exact', head: true })
    .or(`employee_id.eq.${employeeId},appraiser_id.eq.${employeeId}`);
  check('countAppraisalsForEmployeeFromSupabase', error);
  return count ?? 0;
}

export async function countAppraisalsForPeriodFromSupabase(reviewPeriodId: string): Promise<number> {
  const supabase = await requireClient();
  const { count, error } = await supabase
    .from(TABLES.APPRAISALS)
    .select('id', { count: 'exact', head: true })
    .eq('review_period_id', reviewPeriodId);
  check('countAppraisalsForPeriodFromSupabase', error);
  return count ?? 0;
}

export async function countAppraisalsForTemplateFromSupabase(templateId: string): Promise<number> {
  const supabase = await requireClient();
  const { count, error } = await supabase
    .from(TABLES.APPRAISALS)
    .select('id', { count: 'exact', head: true })
    .eq('template_id', templateId);
  check('countAppraisalsForTemplateFromSupabase', error);
  return count ?? 0;
}

/** Delete all appraisals (submissions). Used only by the explicit "clear all appraisal data" admin action. */
export async function deleteAllAppraisalsFromSupabase(): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.APPRAISALS).delete().neq('id', '');
  check('deleteAllAppraisalsFromSupabase', error);
}

// ============================================
// APPRAISAL LINKS
// ============================================
function mapLink(l: any): AppraisalLink {
  return {
    id: l.id,
    employeeId: l.employee_id,
    appraiserId: l.appraiser_id,
    templateId: l.template_id,
    reviewPeriodId: l.review_period_id,
    reviewPeriodName: l.review_period_name,
    token: l.token,
    expiresAt: l.expires_at,
    used: l.used,
    createdAt: l.created_at,
  };
}

export async function getLinksFromSupabase(): Promise<AppraisalLink[]> {
  const supabase = await requireClient();
  const { data, error } = await supabase.from(TABLES.APPRAISAL_LINKS).select('*').order('created_at', { ascending: false });
  check('getLinksFromSupabase', error);
  return (data || []).map(mapLink);
}

export async function getLinkByTokenFromSupabase(token: string): Promise<AppraisalLink | undefined> {
  const supabase = await requireClient();
  const { data, error } = await supabase.from(TABLES.APPRAISAL_LINKS).select('*').eq('token', token).maybeSingle();
  check('getLinkByTokenFromSupabase', error);
  return data ? mapLink(data) : undefined;
}

export async function saveLinkToSupabase(link: AppraisalLink): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.APPRAISAL_LINKS).upsert(
    {
      id: link.id,
      employee_id: link.employeeId,
      appraiser_id: link.appraiserId,
      template_id: link.templateId,
      review_period_id: link.reviewPeriodId || null,
      review_period_name: link.reviewPeriodName || null,
      token: link.token,
      expires_at: link.expiresAt,
      used: link.used,
      created_at: link.createdAt,
    },
    { onConflict: 'id' }
  );
  check('saveLinkToSupabase', error);
}

export async function markLinkUsedInSupabase(id: string): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.APPRAISAL_LINKS).update({ used: true }).eq('id', id);
  check('markLinkUsedInSupabase', error);
}

export async function deleteLinkFromSupabase(id: string): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.APPRAISAL_LINKS).delete().eq('id', id);
  check('deleteLinkFromSupabase', error);
}

/** Delete links where the employee is subject or appraiser and the link was never used. */
export async function deleteUnusedLinksForEmployeeFromSupabase(employeeId: string): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase
    .from(TABLES.APPRAISAL_LINKS)
    .delete()
    .eq('used', false)
    .or(`employee_id.eq.${employeeId},appraiser_id.eq.${employeeId}`);
  check('deleteUnusedLinksForEmployeeFromSupabase', error);
}

export async function deleteAllLinksFromSupabase(): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.APPRAISAL_LINKS).delete().neq('id', '');
  check('deleteAllLinksFromSupabase', error);
}

// ============================================
// APPRAISAL ASSIGNMENTS
// ============================================
function mapAssignment(a: Record<string, unknown>): AppraisalAssignment {
  return {
    id: a.id as string,
    reviewPeriodId: a.review_period_id as string,
    appraiserId: a.appraiser_id as string,
    appraiserName: a.appraiser_name as string,
    employeeId: a.employee_id as string,
    employeeName: a.employee_name as string,
    relationshipType: a.relationship_type as AppraisalAssignment['relationshipType'],
    templateId: a.template_id as string,
    status: a.status as AppraisalAssignment['status'],
    assignmentType: a.assignment_type as AppraisalAssignment['assignmentType'],
    linkToken: (a.link_token as string | null) ?? undefined,
    createdAt: a.created_at as string,
    dueDate: (a.due_date as string | null) ?? undefined,
  };
}

function assignmentRow(assignment: AppraisalAssignment) {
  return {
    id: assignment.id,
    review_period_id: assignment.reviewPeriodId,
    appraiser_id: assignment.appraiserId,
    appraiser_name: assignment.appraiserName,
    employee_id: assignment.employeeId,
    employee_name: assignment.employeeName,
    relationship_type: assignment.relationshipType,
    template_id: assignment.templateId,
    status: assignment.status,
    assignment_type: assignment.assignmentType,
    link_token: assignment.linkToken ?? null,
    created_at: assignment.createdAt,
    due_date: assignment.dueDate ?? null,
  };
}

export async function getAppraisalAssignmentsFromSupabase(): Promise<AppraisalAssignment[]> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from(TABLES.APPRAISAL_ASSIGNMENTS)
    .select('*')
    .order('created_at', { ascending: false });
  if (error && isMissingTableError(error)) {
    console.error('appraisal_assignments table is missing in Supabase; run supabase-appraisal-assignments.sql.');
  }
  check('getAppraisalAssignmentsFromSupabase', error);
  return (data || []).map(mapAssignment);
}

export async function getAppraisalAssignmentFromSupabase(id: string): Promise<AppraisalAssignment | undefined> {
  const supabase = await requireClient();
  const { data, error } = await supabase.from(TABLES.APPRAISAL_ASSIGNMENTS).select('*').eq('id', id).maybeSingle();
  check('getAppraisalAssignmentFromSupabase', error);
  return data ? mapAssignment(data) : undefined;
}

export async function getAppraisalAssignmentsForPeriodFromSupabase(reviewPeriodId: string): Promise<AppraisalAssignment[]> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from(TABLES.APPRAISAL_ASSIGNMENTS)
    .select('*')
    .eq('review_period_id', reviewPeriodId);
  check('getAppraisalAssignmentsForPeriodFromSupabase', error);
  return (data || []).map(mapAssignment);
}

export async function saveAppraisalAssignmentToSupabase(assignment: AppraisalAssignment): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.APPRAISAL_ASSIGNMENTS).upsert(assignmentRow(assignment), { onConflict: 'id' });
  check('saveAppraisalAssignmentToSupabase', error);
}

/** Batched insert-or-update; one request per chunk instead of one per row. */
export async function saveAppraisalAssignmentsToSupabase(assignments: AppraisalAssignment[]): Promise<void> {
  if (assignments.length === 0) return;
  const supabase = await requireClient();
  const CHUNK = 500;
  for (let i = 0; i < assignments.length; i += CHUNK) {
    const rows = assignments.slice(i, i + CHUNK).map(assignmentRow);
    const { error } = await supabase.from(TABLES.APPRAISAL_ASSIGNMENTS).upsert(rows, { onConflict: 'id' });
    check('saveAppraisalAssignmentsToSupabase', error);
  }
}

export async function markAssignmentCompletedInSupabase(id: string): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.APPRAISAL_ASSIGNMENTS).update({ status: 'completed' }).eq('id', id);
  check('markAssignmentCompletedInSupabase', error);
}

export async function deleteAppraisalAssignmentFromSupabase(id: string): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.APPRAISAL_ASSIGNMENTS).delete().eq('id', id);
  check('deleteAppraisalAssignmentFromSupabase', error);
}

export async function deleteAppraisalAssignmentsByIdsFromSupabase(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = await requireClient();
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { error } = await supabase.from(TABLES.APPRAISAL_ASSIGNMENTS).delete().in('id', ids.slice(i, i + CHUNK));
    check('deleteAppraisalAssignmentsByIdsFromSupabase', error);
  }
}

/** Delete pending (not completed) assignments where the employee is subject or appraiser. */
export async function deletePendingAssignmentsForEmployeeFromSupabase(employeeId: string): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase
    .from(TABLES.APPRAISAL_ASSIGNMENTS)
    .delete()
    .neq('status', 'completed')
    .or(`employee_id.eq.${employeeId},appraiser_id.eq.${employeeId}`);
  check('deletePendingAssignmentsForEmployeeFromSupabase', error);
}

export async function deleteAllAssignmentsFromSupabase(): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.APPRAISAL_ASSIGNMENTS).delete().neq('id', '');
  check('deleteAllAssignmentsFromSupabase', error);
}

// ============================================
// SETTINGS
// ============================================
export async function getSettingsFromSupabase(): Promise<CompanySettings | null> {
  const supabase = await requireClient();
  const { data, error } = await supabase.from(TABLES.SETTINGS).select('*').eq('key', 'company').maybeSingle();
  check('getSettingsFromSupabase', error);
  if (!data) return null;
  return {
    name: data.name,
    logo: data.logo || undefined,
    adminPin: data.admin_pin,
    accentColor: data.accent_color,
    theme: data.theme,
    hrScoreWeight: data.hr_score_weight ?? 30,
    requireHrForRanking: data.require_hr_for_ranking ?? false,
    employeeOfPeriodOverrides:
      data.employee_of_period_overrides && typeof data.employee_of_period_overrides === 'object'
        ? data.employee_of_period_overrides
        : undefined,
  };
}

const SETTINGS_OPTIONAL_COLUMNS = /hr_score_weight|require_hr_for_ranking|employee_of_period_overrides/i;

export async function saveSettingsToSupabase(settings: CompanySettings): Promise<void> {
  const supabase = await requireClient();
  const base = {
    key: 'company',
    name: settings.name,
    logo: settings.logo || null,
    admin_pin: settings.adminPin,
    accent_color: settings.accentColor,
    theme: settings.theme,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from(TABLES.SETTINGS).upsert(
    {
      ...base,
      hr_score_weight: settings.hrScoreWeight ?? 30,
      require_hr_for_ranking: settings.requireHrForRanking ?? false,
    },
    { onConflict: 'key' }
  );
  if (!error) return;
  if (!isMissingColumnError(error, SETTINGS_OPTIONAL_COLUMNS)) check('saveSettingsToSupabase', error);
  const fallback = await supabase.from(TABLES.SETTINGS).upsert(base, { onConflict: 'key' });
  check('saveSettingsToSupabase (base)', fallback.error);
}

/**
 * Save Employee of the Period awards so every admin sees the same result.
 * Returns false when the settings table does not have the column yet (run
 * supabase-settings-employee-of-period-overrides.sql); the caller keeps a local copy then.
 */
export async function saveEmployeeOfPeriodOverridesToSupabase(overrides: Record<string, string>): Promise<boolean> {
  const supabase = await requireClient();
  const { error } = await supabase
    .from(TABLES.SETTINGS)
    .update({ employee_of_period_overrides: overrides, updated_at: new Date().toISOString() })
    .eq('key', 'company');
  if (error && isMissingColumnError(error, /employee_of_period_overrides/i)) return false;
  check('saveEmployeeOfPeriodOverridesToSupabase', error);
  return true;
}

// ============================================
// REVIEW PERIODS
// ============================================
function mapPeriod(p: any): ReviewPeriod {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    year: p.year,
    startDate: p.start_date,
    endDate: p.end_date,
    status: p.status,
    description: p.description,
    createdAt: p.created_at,
  };
}

export async function getReviewPeriodsFromSupabase(): Promise<ReviewPeriod[]> {
  const supabase = await requireClient();
  const { data, error } = await supabase.from(TABLES.REVIEW_PERIODS).select('*').order('created_at', { ascending: false });
  check('getReviewPeriodsFromSupabase', error);
  return (data || []).map(mapPeriod);
}

export async function getReviewPeriodFromSupabase(id: string): Promise<ReviewPeriod | undefined> {
  const supabase = await requireClient();
  const { data, error } = await supabase.from(TABLES.REVIEW_PERIODS).select('*').eq('id', id).maybeSingle();
  check('getReviewPeriodFromSupabase', error);
  return data ? mapPeriod(data) : undefined;
}

export async function saveReviewPeriodToSupabase(period: ReviewPeriod): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.REVIEW_PERIODS).upsert(
    {
      id: period.id,
      name: period.name,
      type: period.type,
      year: period.year,
      start_date: period.startDate,
      end_date: period.endDate,
      status: period.status,
      description: period.description || null,
      created_at: period.createdAt,
    },
    { onConflict: 'id' }
  );
  check('saveReviewPeriodToSupabase', error);
}

/** Delete a period plus its pending forms and links. Callers must refuse when submitted appraisals exist. */
export async function deleteReviewPeriodFromSupabase(id: string): Promise<void> {
  const supabase = await requireClient();
  const assignments = await supabase.from(TABLES.APPRAISAL_ASSIGNMENTS).delete().eq('review_period_id', id);
  check('deleteReviewPeriodFromSupabase (assignments)', assignments.error);
  const links = await supabase.from(TABLES.APPRAISAL_LINKS).delete().eq('review_period_id', id);
  check('deleteReviewPeriodFromSupabase (links)', links.error);
  const { error } = await supabase.from(TABLES.REVIEW_PERIODS).delete().eq('id', id);
  check('deleteReviewPeriodFromSupabase', error);
}

// ============================================
// PERFORMANCE SUMMARIES
// ============================================
export async function getSummaryFromSupabase(employeeId: string): Promise<PerformanceSummary | undefined> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from(TABLES.PERFORMANCE_SUMMARIES)
    .select('*')
    .eq('employee_id', employeeId)
    .maybeSingle();
  check('getSummaryFromSupabase', error);
  if (!data) return undefined;
  return {
    employeeId: data.employee_id,
    period: data.period,
    totalScore: data.total_score,
    maxScore: data.max_score,
    percentage: data.percentage,
    strengths: data.insights?.strengths || [],
    improvements: data.insights?.improvements || [],
    narrative: data.summary_text,
    breakdown: data.insights?.breakdown || [],
  };
}

export async function saveSummaryToSupabase(summary: PerformanceSummary): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.PERFORMANCE_SUMMARIES).upsert(
    {
      employee_id: summary.employeeId,
      period: summary.period,
      total_score: summary.totalScore,
      max_score: summary.maxScore,
      percentage: summary.percentage,
      summary_text: summary.narrative,
      insights: {
        strengths: summary.strengths,
        improvements: summary.improvements,
        breakdown: summary.breakdown,
      },
      generated_at: new Date().toISOString(),
    },
    { onConflict: 'employee_id' }
  );
  check('saveSummaryToSupabase', error);
}

export async function deleteSummaryFromSupabase(employeeId: string): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.PERFORMANCE_SUMMARIES).delete().eq('employee_id', employeeId);
  check('deleteSummaryFromSupabase', error);
}

export async function deleteAllSummariesFromSupabase(): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.PERFORMANCE_SUMMARIES).delete().neq('employee_id', '');
  check('deleteAllSummariesFromSupabase', error);
}

// ============================================
// TEAMS
// ============================================
function mapTeam(t: any): Team {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    createdAt: t.created_at,
  };
}

export async function getTeamsFromSupabase(): Promise<Team[]> {
  const supabase = await requireClient();
  const { data, error } = await supabase.from(TABLES.TEAMS).select('*').order('created_at', { ascending: false });
  check('getTeamsFromSupabase', error);
  return (data || []).map(mapTeam);
}

export async function getTeamFromSupabase(id: string): Promise<Team | undefined> {
  const supabase = await requireClient();
  const { data, error } = await supabase.from(TABLES.TEAMS).select('*').eq('id', id).maybeSingle();
  check('getTeamFromSupabase', error);
  return data ? mapTeam(data) : undefined;
}

export async function saveTeamToSupabase(team: Team): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.TEAMS).upsert(
    {
      id: team.id,
      name: team.name,
      description: team.description || null,
      created_at: team.createdAt,
    },
    { onConflict: 'id' }
  );
  check('saveTeamToSupabase', error);
}

export async function deleteTeamFromSupabase(id: string): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.TEAMS).delete().eq('id', id);
  check('deleteTeamFromSupabase', error);
}

// ============================================
// USERS (lookup by employee)
// ============================================
export async function getUserByEmployeeIdFromSupabase(employeeId: string): Promise<User | undefined> {
  const supabase = await requireClient();
  const { data, error } = await supabase.from(TABLES.USERS).select('*').eq('employee_id', employeeId).limit(1);
  check('getUserByEmployeeIdFromSupabase', error);
  const row = data?.[0];
  if (!row) return undefined;
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active,
    employeeId: row.employee_id,
    mustChangePassword: row.must_change_password,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

// ============================================
// EMPLOYEE PROFILES
// ============================================
function mapProfileFromSupabase(data: any): EmployeeProfile {
  return {
    id: data.id,
    employeeId: data.employee_id,
    profilePicture: data.profile_picture,
    profilePicturePositionX: data.profile_picture_position_x ?? undefined,
    profilePicturePositionY: data.profile_picture_position_y ?? undefined,
    coverPhoto: data.cover_photo,
    coverPhotoPosition: data.cover_photo_position ?? undefined,
    bio: data.bio,
    headline: data.headline,
    location: data.location,
    timezone: data.timezone,
    startDate: data.start_date,
    birthday: data.birthday,
    pronouns: data.pronouns,
    skills: data.skills || [],
    interests: data.interests || [],
    socialLinks: data.social_links || {},
    contactPreferences: data.contact_preferences || {},
    phoneNumber: data.phone_number,
    slackHandle: data.slack_handle,
    funFacts: data.fun_facts || [],
    achievements: data.achievements || [],
    education: data.education || [],
    previousRoles: data.previous_roles || [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getEmployeeProfilesFromSupabase(): Promise<EmployeeProfile[]> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from(TABLES.EMPLOYEE_PROFILES)
    .select('*')
    .order('updated_at', { ascending: false });
  // Profiles are optional: a project without the table simply has no profiles.
  if (error && isMissingTableError(error)) return [];
  check('getEmployeeProfilesFromSupabase', error);
  return (data || []).map(mapProfileFromSupabase);
}

export async function getEmployeeProfileFromSupabase(employeeId: string): Promise<EmployeeProfile | null> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from(TABLES.EMPLOYEE_PROFILES)
    .select('*')
    .eq('employee_id', employeeId)
    .maybeSingle();
  if (error && isMissingTableError(error)) return null;
  check('getEmployeeProfileFromSupabase', error);
  return data ? mapProfileFromSupabase(data) : null;
}

export async function saveEmployeeProfileToSupabase(profile: EmployeeProfile): Promise<void> {
  const supabase = await requireClient();
  const now = new Date().toISOString();
  const row = {
    id: profile.id || profile.employeeId,
    employee_id: profile.employeeId,
    profile_picture: profile.profilePicture ?? null,
    profile_picture_position_x: profile.profilePicturePositionX ?? null,
    profile_picture_position_y: profile.profilePicturePositionY ?? null,
    cover_photo: profile.coverPhoto ?? null,
    cover_photo_position: profile.coverPhotoPosition ?? null,
    bio: profile.bio ?? null,
    headline: profile.headline ?? null,
    location: profile.location ?? null,
    timezone: profile.timezone ?? null,
    start_date: profile.startDate ?? null,
    birthday: profile.birthday ?? null,
    pronouns: profile.pronouns ?? null,
    skills: profile.skills ?? [],
    interests: profile.interests ?? [],
    social_links: profile.socialLinks ?? {},
    contact_preferences: profile.contactPreferences ?? {},
    phone_number: profile.phoneNumber ?? null,
    slack_handle: profile.slackHandle ?? null,
    fun_facts: profile.funFacts ?? [],
    achievements: profile.achievements ?? [],
    education: profile.education ?? [],
    previous_roles: profile.previousRoles ?? [],
    created_at: profile.createdAt || now,
    updated_at: profile.updatedAt || now,
  };
  const { error } = await supabase.from(TABLES.EMPLOYEE_PROFILES).upsert(row, { onConflict: 'employee_id' });
  check('saveEmployeeProfileToSupabase', error);
}

export async function deleteEmployeeProfileFromSupabase(employeeId: string): Promise<void> {
  const supabase = await requireClient();
  const { error } = await supabase.from(TABLES.EMPLOYEE_PROFILES).delete().eq('employee_id', employeeId);
  if (error && isMissingTableError(error)) return;
  check('deleteEmployeeProfileFromSupabase', error);
}
