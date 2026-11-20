import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Template, Employee, Appraisal, AppraisalLink, CompanySettings, PerformanceSummary, ReviewPeriod, User, Team, AppraisalAssignment, EmployeeProfile } from '@/types';
import {
  appraisalIdForAssignment,
  appraisalIdForLink,
  assignmentKey,
  buildSubmittedPairSet,
  pairKey,
} from '@/lib/appraisal-status';

/*
 * Data access for the whole app.
 *
 * When Supabase is configured it is the single source of truth:
 *  - Reads come from Supabase and replace the local IndexedDB cache. If Supabase cannot be
 *    reached, the cached copy is returned and a `cloudSyncError` event is dispatched so the UI
 *    can say it is showing a saved copy.
 *  - Writes go to Supabase first and throw on failure. The cache is only updated after the
 *    server accepted the change, so the UI never reports success for data that was not saved.
 * Without Supabase (local development) everything runs against IndexedDB.
 */

interface AppraisalDB extends DBSchema {
  templates: { key: string; value: Template };
  employees: { key: string; value: Employee };
  appraisals: { key: string; value: Appraisal };
  links: { key: string; value: AppraisalLink };
  settings: { key: string; value: CompanySettings };
  summaries: { key: string; value: PerformanceSummary };
  reviewPeriods: { key: string; value: ReviewPeriod };
  users: {
    key: string;
    value: User;
    indexes: { 'by-username': string; 'by-employeeId': string };
  };
  teams: { key: string; value: Team };
  appraisalAssignments: {
    key: string;
    value: AppraisalAssignment;
    indexes: { 'by-period': string; 'by-appraiser': string };
  };
  employeeProfiles: { key: string; value: EmployeeProfile };
}

type StoreName =
  | 'templates'
  | 'employees'
  | 'appraisals'
  | 'links'
  | 'settings'
  | 'summaries'
  | 'reviewPeriods'
  | 'users'
  | 'teams'
  | 'appraisalAssignments'
  | 'employeeProfiles';

let db: IDBPDatabase<AppraisalDB> | null = null;
let _supabaseUsersDiagnosticLogged = false;

export async function initDB(): Promise<IDBPDatabase<AppraisalDB>> {
  if (db) return db;

  db = await openDB<AppraisalDB>('appraisal-db', 6, {
    upgrade(db, _oldVersion, _newVersion, transaction) {
      if (!db.objectStoreNames.contains('templates')) db.createObjectStore('templates', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('employees')) db.createObjectStore('employees', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('appraisals')) db.createObjectStore('appraisals', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('links')) {
        const linksStore = db.createObjectStore('links', { keyPath: 'id' });
        // @ts-ignore - idb library type issue
        linksStore.createIndex('token', 'token', { unique: true });
      } else {
        try {
          const linksStore = transaction.objectStore('links');
          // @ts-ignore - idb library type issue
          if (!linksStore.indexNames.contains('token')) linksStore.createIndex('token', 'token', { unique: true });
        } catch {
          // index may already exist
        }
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('summaries')) db.createObjectStore('summaries', { keyPath: 'employeeId' });
      if (!db.objectStoreNames.contains('reviewPeriods')) {
        const periodsStore = db.createObjectStore('reviewPeriods', { keyPath: 'id' });
        // @ts-ignore - idb library type issue
        periodsStore.createIndex('status', 'status');
        // @ts-ignore - idb library type issue
        periodsStore.createIndex('year', 'year');
      }
      if (!db.objectStoreNames.contains('users')) {
        const usersStore = db.createObjectStore('users', { keyPath: 'id' });
        usersStore.createIndex('by-username', 'username', { unique: true });
        usersStore.createIndex('by-employeeId', 'employeeId', { unique: false });
      }
      if (!db.objectStoreNames.contains('teams')) db.createObjectStore('teams', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('appraisalAssignments')) {
        const asnStore = db.createObjectStore('appraisalAssignments', { keyPath: 'id' });
        asnStore.createIndex('by-period', 'reviewPeriodId', { unique: false });
        asnStore.createIndex('by-appraiser', 'appraiserId', { unique: false });
      }
      if (!db.objectStoreNames.contains('employeeProfiles')) db.createObjectStore('employeeProfiles', { keyPath: 'employeeId' });
    },
  });

  return db;
}

// ============================================
// Helpers
// ============================================
async function cloudEnabled(): Promise<boolean> {
  const { isSupabaseConfigured } = await import('./supabase');
  return isSupabaseConfigured();
}

async function remote() {
  return import('./supabase-storage');
}

async function cacheGetAll<T>(store: StoreName): Promise<T[]> {
  const database = await initDB();
  if (!database.objectStoreNames.contains(store)) return [];
  return (await database.getAll(store as never)) as T[];
}

async function cacheGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  const database = await initDB();
  if (!database.objectStoreNames.contains(store)) return undefined;
  return (await database.get(store as never, key)) as T | undefined;
}

async function cachePut(store: StoreName, value: unknown): Promise<void> {
  const database = await initDB();
  if (!database.objectStoreNames.contains(store)) return;
  await database.put(store as never, value as never);
}

async function cacheDelete(store: StoreName, key: string): Promise<void> {
  const database = await initDB();
  if (!database.objectStoreNames.contains(store)) return;
  await database.delete(store as never, key);
}

async function cacheReplace(store: StoreName, values: unknown[]): Promise<void> {
  const database = await initDB();
  if (!database.objectStoreNames.contains(store)) return;
  const tx = database.transaction(store as never, 'readwrite');
  const objectStore = tx.objectStore(store as never) as unknown as {
    clear: () => Promise<void>;
    put: (value: unknown) => Promise<unknown>;
  };
  await objectStore.clear();
  for (const value of values) await objectStore.put(value);
  await tx.done;
}

/** Tell the UI it is looking at a cached copy because the server could not be reached. */
function notifyCloudReadFailure(entity: string, error: unknown): void {
  console.error(`Could not load ${entity} from the server; showing the last saved copy.`, error);
  try {
    window.dispatchEvent(new CustomEvent('cloudSyncError', { detail: { entity } }));
  } catch {
    // not in a browser
  }
}

/** Read a full list from the cloud and refresh the cache; fall back to the cache only on error. */
async function readList<T>(store: StoreName, entity: string, fetchRemote: () => Promise<T[]>): Promise<T[]> {
  if (await cloudEnabled()) {
    try {
      const items = await fetchRemote();
      await cacheReplace(store, items);
      return items;
    } catch (error) {
      notifyCloudReadFailure(entity, error);
    }
  }
  return cacheGetAll<T>(store);
}

/** Read one record from the cloud; a missing record removes it from the cache. */
async function readOne<T>(
  store: StoreName,
  entity: string,
  key: string,
  fetchRemote: () => Promise<T | undefined | null>
): Promise<T | undefined> {
  if (await cloudEnabled()) {
    try {
      const item = await fetchRemote();
      if (item) {
        await cachePut(store, item);
        return item;
      }
      await cacheDelete(store, key);
      return undefined;
    } catch (error) {
      notifyCloudReadFailure(entity, error);
    }
  }
  return cacheGet<T>(store, key);
}

/** Error with a message that is safe to show to the user as-is. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}

/** Message for a toast: the specific reason when we have one, otherwise the fallback. */
export function describeError(error: unknown, fallback: string): string {
  return error instanceof UserFacingError ? error.message : fallback;
}

export { AlreadySubmittedError } from './supabase-storage';

// ============================================
// Templates
// ============================================
export async function getTemplates(): Promise<Template[]> {
  return readList('templates', 'templates', async () => (await remote()).getTemplatesFromSupabase());
}

export async function getTemplate(id: string): Promise<Template | undefined> {
  return readOne('templates', 'template', id, async () => (await remote()).getTemplateFromSupabase(id));
}

export async function saveTemplate(template: Template): Promise<void> {
  if (await cloudEnabled()) await (await remote()).saveTemplateToSupabase(template);
  await cachePut('templates', template);
}

export async function deleteTemplate(id: string): Promise<void> {
  const [appraisals, assignments, links] = await Promise.all([getAppraisals(), getAppraisalAssignments(), getLinks()]);
  const used =
    appraisals.filter((a) => a.templateId === id).length +
    assignments.filter((a) => a.templateId === id).length +
    links.filter((l) => l.templateId === id).length;
  if (used > 0) {
    throw new UserFacingError(
      `This template is used by ${used} appraisal form(s) or submission(s). Deleting it would break those records, so it can't be deleted.`
    );
  }
  if (await cloudEnabled()) await (await remote()).deleteTemplateFromSupabase(id);
  await cacheDelete('templates', id);
}

// ============================================
// Employees
// ============================================

/**
 * Supabase is the source of truth for org-structure fields (reports-to, team, employment status).
 * The cached copy only fills a field Supabase did not return at all (column missing from an older
 * schema); a real value, including an intentional null, always wins. Otherwise a stale cache on one
 * device could silently revert a manager or team change made on another.
 */
function reconcileEmployeeWithLocal(remoteEmployee: Employee, local: Employee | undefined): Employee {
  const reportsTo = remoteEmployee.reportsTo !== undefined ? remoteEmployee.reportsTo : local?.reportsTo;
  const teamId = remoteEmployee.teamId !== undefined ? remoteEmployee.teamId : local?.teamId;
  const employmentStatus =
    remoteEmployee.employmentStatus !== undefined
      ? remoteEmployee.employmentStatus
      : (local?.employmentStatus ?? 'permanent');
  return { ...remoteEmployee, reportsTo, teamId, employmentStatus };
}

export async function getEmployees(): Promise<Employee[]> {
  return readList('employees', 'employees', async () => {
    const [remoteEmployees, cached] = await Promise.all([
      (await remote()).getEmployeesFromSupabase(),
      cacheGetAll<Employee>('employees'),
    ]);
    const cachedById = new Map(cached.map((e) => [e.id, e]));
    return remoteEmployees.map((e) => reconcileEmployeeWithLocal(e, cachedById.get(e.id)));
  });
}

export async function getEmployee(id: string): Promise<Employee | undefined> {
  return readOne('employees', 'employee', id, async () => {
    const remoteEmployee = await (await remote()).getEmployeeFromSupabase(id);
    if (!remoteEmployee) return undefined;
    return reconcileEmployeeWithLocal(remoteEmployee, await cacheGet<Employee>('employees', id));
  });
}

export async function saveEmployee(employee: Employee): Promise<void> {
  if (await cloudEnabled()) await (await remote()).saveEmployeeToSupabase(employee);
  await cachePut('employees', employee);
}

/** Update only an employee's team (assign/remove as department leader). */
export async function updateEmployeeTeam(employeeId: string, teamId: string | null): Promise<void> {
  if (await cloudEnabled()) {
    await (await remote()).updateEmployeeTeamInSupabase(employeeId, teamId);
    await getEmployee(employeeId);
    return;
  }
  const emp = await cacheGet<Employee>('employees', employeeId);
  if (emp) await cachePut('employees', { ...emp, teamId: teamId ?? undefined });
}

/**
 * Delete an employee. Refuses when they have submitted appraisals (as subject or reviewer):
 * those are audit records, so the employee should be marked Resigned/Terminated instead.
 * Pending forms, unused links, their profile and summary are removed; linked logins are locked.
 */
export async function deleteEmployee(id: string): Promise<void> {
  const appraisals = await getAppraisals();
  const submitted = appraisals.filter((a) => a.employeeId === id || a.appraiserId === id).length;
  if (submitted > 0) {
    throw new UserFacingError(
      `This employee has ${submitted} submitted appraisal(s) on record. To keep the audit history, set their employment status to Resigned or Terminated instead of deleting them.`
    );
  }
  const directReports = (await getEmployees()).filter((e) => e.reportsTo === id && e.id !== id);
  if (directReports.length > 0) {
    throw new UserFacingError(
      `${directReports.length} employee(s) report to this person. Change their "Reports to" first, then delete.`
    );
  }

  if (await cloudEnabled()) {
    const r = await remote();
    await r.deletePendingAssignmentsForEmployeeFromSupabase(id);
    await r.deleteUnusedLinksForEmployeeFromSupabase(id);
    await r.deleteEmployeeProfileFromSupabase(id);
    await r.deleteSummaryFromSupabase(id);
    await r.deleteEmployeeFromSupabase(id);
  }

  for (const a of await cacheGetAll<AppraisalAssignment>('appraisalAssignments')) {
    if (a.employeeId === id || a.appraiserId === id) await cacheDelete('appraisalAssignments', a.id);
  }
  for (const l of await cacheGetAll<AppraisalLink>('links')) {
    if (l.employeeId === id || l.appraiserId === id) await cacheDelete('links', l.id);
  }
  await cacheDelete('employeeProfiles', id);
  await cacheDelete('summaries', id);
  await cacheDelete('employees', id);

  const linkedUsers = (await getUsers()).filter((u) => u.employeeId === id);
  for (const u of linkedUsers) await saveUser({ ...u, active: false });
  try {
    const channel = new BroadcastChannel('appraisals-auth');
    channel.postMessage({ type: 'employeeDeleted', employeeId: id });
    channel.close();
  } catch {
    // BroadcastChannel not supported
  }
}

// ============================================
// Appraisals
// ============================================
export async function getAppraisals(): Promise<Appraisal[]> {
  return readList('appraisals', 'appraisals', async () => (await remote()).getAppraisalsFromSupabase());
}

export async function getAppraisal(id: string): Promise<Appraisal | undefined> {
  return readOne('appraisals', 'appraisal', id, async () => (await remote()).getAppraisalFromSupabase(id));
}

export async function saveAppraisal(appraisal: Appraisal): Promise<void> {
  if (await cloudEnabled()) await (await remote()).saveAppraisalToSupabase(appraisal);
  await cachePut('appraisals', appraisal);
}

export async function deleteAppraisal(id: string): Promise<void> {
  if (await cloudEnabled()) await (await remote()).deleteAppraisalFromSupabase(id);
  await cacheDelete('appraisals', id);
}

async function insertAppraisal(appraisal: Appraisal): Promise<void> {
  if (await cloudEnabled()) {
    await (await remote()).insertAppraisalToSupabase(appraisal);
  } else if (await cacheGet<Appraisal>('appraisals', appraisal.id)) {
    const { AlreadySubmittedError } = await remote();
    throw new AlreadySubmittedError();
  }
  await cachePut('appraisals', appraisal);
}

export async function getSubmittedAppraisalsForPair(reviewPeriodId: string, appraiserId: string, employeeId: string): Promise<Appraisal[]> {
  if (await cloudEnabled()) {
    return (await remote()).getSubmittedAppraisalsForPairFromSupabase(reviewPeriodId, appraiserId, employeeId);
  }
  const key = pairKey(reviewPeriodId, appraiserId, employeeId);
  return (await cacheGetAll<Appraisal>('appraisals')).filter(
    (a) => a.completedAt && pairKey(a.reviewPeriodId, a.appraiserId, a.employeeId) === key
  );
}

/**
 * Submit a review for an assigned form. Safe against double clicks, two open tabs and duplicate
 * forms: the appraisal id is derived from the form, the form is re-checked on the server first,
 * and a reviewer who already reviewed this person in this period is stopped.
 */
export async function submitAppraisalForAssignment(
  assignmentId: string,
  appraisal: Omit<Appraisal, 'id'>
): Promise<void> {
  const { AlreadySubmittedError } = await remote();
  const fresh = await getAppraisalAssignmentFresh(assignmentId);
  if (!fresh) throw new UserFacingError('This appraisal form no longer exists. Please refresh your list.');
  if (fresh.status === 'completed') throw new AlreadySubmittedError();

  const existing = await getSubmittedAppraisalsForPair(fresh.reviewPeriodId, fresh.appraiserId, fresh.employeeId);
  if (existing.length > 0) {
    await markAssignmentCompleted(fresh).catch((e) => console.error('Could not mark duplicate form completed:', e));
    throw new AlreadySubmittedError(`You already submitted a review of ${fresh.employeeName} for this period.`);
  }

  await insertAppraisal({ ...appraisal, id: appraisalIdForAssignment(fresh.id) });
  // The appraisal is saved. If the status update fails, the form still shows as done because a
  // submission exists for this reviewer/person/period, so don't report the submission as failed.
  await markAssignmentCompleted(fresh).catch((e) => console.error('Appraisal saved but form status update failed:', e));
}

/** Submit a review through a one-off link. The link can only be used once. */
export async function submitAppraisalForLink(token: string, appraisal: Omit<Appraisal, 'id'>): Promise<void> {
  const { AlreadySubmittedError } = await remote();
  const fresh = await getLinkByToken(token);
  if (!fresh) throw new UserFacingError('This appraisal link does not exist.');
  if (fresh.used) throw new AlreadySubmittedError();
  if (fresh.expiresAt && new Date(fresh.expiresAt) < new Date()) {
    throw new UserFacingError('This appraisal link has expired.');
  }

  await insertAppraisal({ ...appraisal, id: appraisalIdForLink(fresh.id) });
  if (await cloudEnabled()) {
    await (await remote()).markLinkUsedInSupabase(fresh.id).catch((e) => console.error('Appraisal saved but link could not be marked used:', e));
  }
  await cachePut('links', { ...fresh, used: true });
}

// ============================================
// Links
// ============================================
export async function getLinks(): Promise<AppraisalLink[]> {
  return readList('links', 'appraisal links', async () => (await remote()).getLinksFromSupabase());
}

export async function getLinkByToken(token: string): Promise<AppraisalLink | undefined> {
  if (await cloudEnabled()) {
    const link = await (await remote()).getLinkByTokenFromSupabase(token);
    if (link) await cachePut('links', link);
    return link;
  }
  return (await cacheGetAll<AppraisalLink>('links')).find((l) => l.token === token);
}

export async function saveLink(link: AppraisalLink): Promise<void> {
  if (await cloudEnabled()) await (await remote()).saveLinkToSupabase(link);
  await cachePut('links', link);
}

export async function deleteLink(id: string): Promise<void> {
  if (await cloudEnabled()) await (await remote()).deleteLinkFromSupabase(id);
  await cacheDelete('links', id);
}

// ============================================
// Appraisal assignments (forms)
// ============================================
export async function getAppraisalAssignments(): Promise<AppraisalAssignment[]> {
  return readList('appraisalAssignments', 'appraisal forms', async () => (await remote()).getAppraisalAssignmentsFromSupabase());
}

/** Always asks the server (never the cache) so the form page sees the current status. */
async function getAppraisalAssignmentFresh(id: string): Promise<AppraisalAssignment | undefined> {
  if (await cloudEnabled()) {
    const a = await (await remote()).getAppraisalAssignmentFromSupabase(id);
    if (a) await cachePut('appraisalAssignments', a);
    else await cacheDelete('appraisalAssignments', id);
    return a;
  }
  return cacheGet<AppraisalAssignment>('appraisalAssignments', id);
}

export async function getAppraisalAssignment(id: string): Promise<AppraisalAssignment | undefined> {
  return getAppraisalAssignmentFresh(id);
}

export async function getAppraisalAssignmentsForPeriod(reviewPeriodId: string): Promise<AppraisalAssignment[]> {
  if (await cloudEnabled()) {
    return (await remote()).getAppraisalAssignmentsForPeriodFromSupabase(reviewPeriodId);
  }
  return (await cacheGetAll<AppraisalAssignment>('appraisalAssignments')).filter((a) => a.reviewPeriodId === reviewPeriodId);
}

export async function getAppraisalAssignmentsByAppraiser(appraiserId: string): Promise<AppraisalAssignment[]> {
  return (await getAppraisalAssignments()).filter((a) => a.appraiserId === appraiserId);
}

export async function saveAppraisalAssignment(assignment: AppraisalAssignment): Promise<void> {
  if (await cloudEnabled()) await (await remote()).saveAppraisalAssignmentToSupabase(assignment);
  await cachePut('appraisalAssignments', assignment);
}

export async function saveAppraisalAssignments(assignments: AppraisalAssignment[]): Promise<void> {
  if (await cloudEnabled()) await (await remote()).saveAppraisalAssignmentsToSupabase(assignments);
  for (const a of assignments) await cachePut('appraisalAssignments', a);
}

async function markAssignmentCompleted(assignment: AppraisalAssignment): Promise<void> {
  if (await cloudEnabled()) await (await remote()).markAssignmentCompletedInSupabase(assignment.id);
  await cachePut('appraisalAssignments', { ...assignment, status: 'completed' });
}

export interface AssignmentCreationResult {
  created: AppraisalAssignment[];
  skippedExisting: number;
  skippedAlreadySubmitted: number;
}

/**
 * Create forms for a review period, skipping any reviewer/person pair that already has a form of
 * the same relationship type or an already-submitted review. Re-running bulk generation therefore
 * only adds forms for new people and never asks anyone to review someone twice.
 */
export async function createAssignmentsSkippingExisting(
  reviewPeriodId: string,
  candidates: AppraisalAssignment[]
): Promise<AssignmentCreationResult> {
  const [existing, appraisals] = await Promise.all([
    getAppraisalAssignmentsForPeriod(reviewPeriodId),
    getAppraisals(),
  ]);
  const existingKeys = new Set(existing.map(assignmentKey));
  const submitted = buildSubmittedPairSet(appraisals.filter((a) => a.reviewPeriodId === reviewPeriodId));

  const created: AppraisalAssignment[] = [];
  let skippedExisting = 0;
  let skippedAlreadySubmitted = 0;
  for (const candidate of candidates) {
    const key = assignmentKey(candidate);
    if (existingKeys.has(key)) {
      skippedExisting++;
      continue;
    }
    if (submitted.has(pairKey(candidate.reviewPeriodId, candidate.appraiserId, candidate.employeeId))) {
      skippedAlreadySubmitted++;
      continue;
    }
    existingKeys.add(key);
    created.push(candidate);
  }

  await saveAppraisalAssignments(created);
  return { created, skippedExisting, skippedAlreadySubmitted };
}

export async function deleteAppraisalAssignment(id: string): Promise<void> {
  if (await cloudEnabled()) await (await remote()).deleteAppraisalAssignmentFromSupabase(id);
  await cacheDelete('appraisalAssignments', id);
}

export async function deleteAppraisalAssignments(ids: string[]): Promise<void> {
  if (await cloudEnabled()) await (await remote()).deleteAppraisalAssignmentsByIdsFromSupabase(ids);
  for (const id of ids) await cacheDelete('appraisalAssignments', id);
}

/**
 * Remove the forms nobody has submitted yet for a review period. Completed forms (and forms whose
 * review was already submitted) are kept so the audit trail stays intact and regenerating the
 * period cannot ask people to review again.
 */
export async function deleteAssignmentsByPeriod(reviewPeriodId: string): Promise<{ removed: number; kept: number }> {
  const [list, appraisals] = await Promise.all([getAppraisalAssignmentsForPeriod(reviewPeriodId), getAppraisals()]);
  const submitted = buildSubmittedPairSet(appraisals.filter((a) => a.reviewPeriodId === reviewPeriodId));
  const removable = list.filter(
    (a) => a.status !== 'completed' && !submitted.has(pairKey(a.reviewPeriodId, a.appraiserId, a.employeeId))
  );
  await deleteAppraisalAssignments(removable.map((a) => a.id));
  return { removed: removable.length, kept: list.length - removable.length };
}

/**
 * Clear all appraisal data (forms, submitted appraisals, links, summaries) to start fresh.
 * Does NOT remove users, employees, teams, templates, review periods, or settings.
 */
export async function clearAllAppraisalData(): Promise<{
  assignments: number;
  appraisals: number;
  links: number;
  summaries: number;
}> {
  const [allAssignments, allAppraisals, allLinks, allSummaries] = await Promise.all([
    getAppraisalAssignments(),
    getAppraisals(),
    getLinks(),
    cacheGetAll<PerformanceSummary>('summaries'),
  ]);

  if (await cloudEnabled()) {
    const r = await remote();
    await r.deleteAllAssignmentsFromSupabase();
    await r.deleteAllAppraisalsFromSupabase();
    await r.deleteAllLinksFromSupabase();
    await r.deleteAllSummariesFromSupabase();
  }
  await cacheReplace('appraisalAssignments', []);
  await cacheReplace('appraisals', []);
  await cacheReplace('links', []);
  await cacheReplace('summaries', []);

  return {
    assignments: allAssignments.length,
    appraisals: allAppraisals.length,
    links: allLinks.length,
    summaries: allSummaries.length,
  };
}

// ============================================
// Settings
// ============================================
const defaultSettings: CompanySettings = {
  name: 'Your Company',
  adminPin: '1234',
  accentColor: '#3B82F6',
  theme: 'system',
  hrScoreWeight: 30,
  requireHrForRanking: false,
};

type StoredSettings = CompanySettings & { key?: string };
type StoredOverrides = { key: string; employeeOfPeriodOverrides?: Record<string, string> };

async function cachedOverrides(): Promise<Record<string, string> | undefined> {
  const row = await cacheGet<StoredOverrides>('settings', 'employeeOfPeriodOverrides');
  return row?.employeeOfPeriodOverrides && typeof row.employeeOfPeriodOverrides === 'object'
    ? row.employeeOfPeriodOverrides
    : undefined;
}

export async function getSettings(): Promise<CompanySettings> {
  if (await cloudEnabled()) {
    try {
      const fromCloud = await (await remote()).getSettingsFromSupabase();
      if (fromCloud) {
        // Older databases have no overrides column; keep using the local copy there.
        const overrides = fromCloud.employeeOfPeriodOverrides ?? (await cachedOverrides());
        const merged: CompanySettings = { ...defaultSettings, ...fromCloud, employeeOfPeriodOverrides: overrides };
        const { employeeOfPeriodOverrides: _o, ...rest } = merged;
        await cachePut('settings', { ...rest, key: 'company' });
        return merged;
      }
    } catch (error) {
      notifyCloudReadFailure('settings', error);
    }
  }
  const stored = await cacheGet<StoredSettings>('settings', 'company');
  const merged: CompanySettings = { ...defaultSettings, ...(stored ?? {}) };
  delete (merged as StoredSettings).key;
  merged.employeeOfPeriodOverrides = await cachedOverrides();
  return merged;
}

export async function getEmployeeOfPeriodOverrides(): Promise<Record<string, string>> {
  return (await getSettings()).employeeOfPeriodOverrides ?? {};
}

export async function saveEmployeeOfPeriodOverrides(overrides: Record<string, string>): Promise<void> {
  if (await cloudEnabled()) {
    const savedToCloud = await (await remote()).saveEmployeeOfPeriodOverridesToSupabase(overrides);
    if (!savedToCloud) {
      console.warn('settings.employee_of_period_overrides column is missing; awards are only saved on this device. Run supabase-settings-employee-of-period-overrides.sql.');
    }
  }
  await cachePut('settings', { key: 'employeeOfPeriodOverrides', employeeOfPeriodOverrides: overrides });
}

export async function saveSettings(settings: CompanySettings): Promise<void> {
  const { employeeOfPeriodOverrides, ...rest } = settings;
  if (await cloudEnabled()) await (await remote()).saveSettingsToSupabase(rest as CompanySettings);
  await cachePut('settings', { ...rest, key: 'company' });
  if (employeeOfPeriodOverrides) await saveEmployeeOfPeriodOverrides(employeeOfPeriodOverrides);
}

// ============================================
// Summaries
// ============================================
export async function getSummary(employeeId: string): Promise<PerformanceSummary | undefined> {
  return readOne('summaries', 'performance summary', employeeId, async () => (await remote()).getSummaryFromSupabase(employeeId));
}

export async function saveSummary(summary: PerformanceSummary): Promise<void> {
  if (await cloudEnabled()) await (await remote()).saveSummaryToSupabase(summary);
  await cachePut('summaries', summary);
}

// ============================================
// Review periods
// ============================================
export async function getReviewPeriods(): Promise<ReviewPeriod[]> {
  return readList('reviewPeriods', 'review periods', async () => (await remote()).getReviewPeriodsFromSupabase());
}

export async function getReviewPeriod(id: string): Promise<ReviewPeriod | undefined> {
  return readOne('reviewPeriods', 'review period', id, async () => (await remote()).getReviewPeriodFromSupabase(id));
}

export async function getActiveReviewPeriods(): Promise<ReviewPeriod[]> {
  return (await getReviewPeriods()).filter((p) => p.status === 'active');
}

export async function saveReviewPeriod(period: ReviewPeriod): Promise<void> {
  if (await cloudEnabled()) await (await remote()).saveReviewPeriodToSupabase(period);
  await cachePut('reviewPeriods', period);
}

/** Delete a review period and its pending forms/links. Refused when appraisals were submitted for it. */
export async function deleteReviewPeriod(id: string): Promise<void> {
  const submitted = (await getAppraisals()).filter((a) => a.reviewPeriodId === id).length;
  if (submitted > 0) {
    throw new UserFacingError(
      `This review period has ${submitted} submitted appraisal(s). To keep the audit history, set its status to Archived instead of deleting it.`
    );
  }
  if (await cloudEnabled()) await (await remote()).deleteReviewPeriodFromSupabase(id);
  for (const a of await cacheGetAll<AppraisalAssignment>('appraisalAssignments')) {
    if (a.reviewPeriodId === id) await cacheDelete('appraisalAssignments', a.id);
  }
  for (const l of await cacheGetAll<AppraisalLink>('links')) {
    if (l.reviewPeriodId === id) await cacheDelete('links', l.id);
  }
  await cacheDelete('reviewPeriods', id);
}

// ============================================
// Teams
// ============================================
export async function getTeams(): Promise<Team[]> {
  return readList('teams', 'teams', async () => (await remote()).getTeamsFromSupabase());
}

export async function getTeam(id: string): Promise<Team | undefined> {
  return readOne('teams', 'team', id, async () => (await remote()).getTeamFromSupabase(id));
}

export async function saveTeam(team: Team): Promise<void> {
  if (await cloudEnabled()) await (await remote()).saveTeamToSupabase(team);
  await cachePut('teams', team);
}

/** Delete a team. Refused while employees still belong to it, so nobody is silently left without a department. */
export async function deleteTeam(id: string): Promise<void> {
  const members = (await getEmployees()).filter((e) => e.teamId === id);
  if (members.length > 0) {
    throw new UserFacingError(
      `${members.length} employee(s) still belong to this team. Move them to another team first, then delete it.`
    );
  }
  if (await cloudEnabled()) await (await remote()).deleteTeamFromSupabase(id);
  await cacheDelete('teams', id);
}

// ============================================
// Users
// ============================================
function normalizeUser(u: User): User {
  return { ...u, username: (u.username || '').toLowerCase() };
}

export async function getUsers(): Promise<User[]> {
  return readList('users', 'users', async () => {
    const { getUsersFromSupabase, getSupabaseProjectHint } = await import('./supabase');
    const users = (await getUsersFromSupabase()).map(normalizeUser);
    if (!_supabaseUsersDiagnosticLogged) {
      _supabaseUsersDiagnosticLogged = true;
      console.log('Supabase: configured, users count =', users.length, `(${getSupabaseProjectHint()})`);
    }
    return users;
  });
}

/** Throws when the server cannot be reached, so a network blip is never mistaken for a deleted account. */
export async function getUser(id: string): Promise<User | undefined> {
  if (await cloudEnabled()) {
    const { getUserFromSupabase } = await import('./supabase');
    const user = await getUserFromSupabase(id);
    if (user) await cachePut('users', normalizeUser(user));
    else await cacheDelete('users', id);
    return user;
  }
  return cacheGet<User>('users', id);
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  if (await cloudEnabled()) {
    const { getUserByUsernameFromSupabase } = await import('./supabase');
    return getUserByUsernameFromSupabase(username);
  }
  const normalized = username.trim().toLowerCase();
  return (await cacheGetAll<User>('users')).find((u) => (u.username || '').trim().toLowerCase() === normalized);
}

export async function getUserByEmployeeId(employeeId: string): Promise<User | undefined> {
  if (await cloudEnabled()) {
    return (await remote()).getUserByEmployeeIdFromSupabase(employeeId);
  }
  return (await cacheGetAll<User>('users')).find((u) => u.employeeId === employeeId);
}

export async function saveUser(user: User): Promise<void> {
  if (!user.id) throw new Error('User must have an id field');
  const userToSave: User = {
    id: user.id,
    username: user.username.toLowerCase(),
    passwordHash: user.passwordHash,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active !== undefined ? user.active : true,
    employeeId: user.employeeId,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt || new Date().toISOString(),
    lastLoginAt: user.lastLoginAt,
  };
  if (await cloudEnabled()) {
    const { saveUserToSupabase } = await import('./supabase');
    await saveUserToSupabase(userToSave);
  }
  await cachePut('users', userToSave);
}

/** Delete a login account. The linked employee and their appraisals are left untouched. */
export async function deleteUser(id: string): Promise<void> {
  if (await cloudEnabled()) {
    const { deleteUserFromSupabase } = await import('./supabase');
    await deleteUserFromSupabase(id);
  }
  await cacheDelete('users', id);
}

// ============================================
// Employee profiles (directory / org chart)
// ============================================
export async function getEmployeeProfiles(): Promise<EmployeeProfile[]> {
  return readList('employeeProfiles', 'employee profiles', async () => (await remote()).getEmployeeProfilesFromSupabase());
}

export async function getEmployeeProfile(employeeId: string): Promise<EmployeeProfile | null> {
  const p = await readOne('employeeProfiles', 'employee profile', employeeId, async () =>
    (await remote()).getEmployeeProfileFromSupabase(employeeId)
  );
  return p ?? null;
}

export async function saveEmployeeProfile(profile: EmployeeProfile): Promise<void> {
  if (await cloudEnabled()) await (await remote()).saveEmployeeProfileToSupabase(profile);
  await cachePut('employeeProfiles', profile);
  window.dispatchEvent(new CustomEvent('employeeProfileUpdated', { detail: { employeeId: profile.employeeId } }));
}

export async function deleteEmployeeProfile(employeeId: string): Promise<void> {
  if (await cloudEnabled()) await (await remote()).deleteEmployeeProfileFromSupabase(employeeId);
  await cacheDelete('employeeProfiles', employeeId);
  window.dispatchEvent(new CustomEvent('employeeProfileUpdated', { detail: { employeeId } }));
}

// ============================================
// Sync / export / import
// ============================================

/** Reload every entity from Supabase into the local cache. */
export async function syncFromSupabase(): Promise<boolean> {
  if (!(await cloudEnabled())) return false;
  try {
    const r = await remote();
    const { getUsersFromSupabase } = await import('./supabase');
    const [templates, employees, appraisals, links, periods, teams, users, assignments, profiles] = await Promise.all([
      r.getTemplatesFromSupabase(),
      r.getEmployeesFromSupabase(),
      r.getAppraisalsFromSupabase(),
      r.getLinksFromSupabase(),
      r.getReviewPeriodsFromSupabase(),
      r.getTeamsFromSupabase(),
      getUsersFromSupabase(),
      r.getAppraisalAssignmentsFromSupabase(),
      r.getEmployeeProfilesFromSupabase(),
    ]);
    await cacheReplace('templates', templates);
    await cacheReplace('employees', employees.map((e) => reconcileEmployeeWithLocal(e, undefined)));
    await cacheReplace('appraisals', appraisals);
    await cacheReplace('links', links);
    await cacheReplace('reviewPeriods', periods);
    await cacheReplace('teams', teams);
    await cacheReplace('users', users.map(normalizeUser));
    await cacheReplace('appraisalAssignments', assignments);
    await cacheReplace('employeeProfiles', profiles);
    await getSettings();
    return true;
  } catch (error) {
    console.error('syncFromSupabase failed:', error);
    return false;
  }
}

export async function exportData(): Promise<string> {
  const [templates, employees, appraisals, links, settings, reviewPeriods, users, teams, employeeProfiles, assignments] = await Promise.all([
    getTemplates(),
    getEmployees(),
    getAppraisals(),
    getLinks(),
    getSettings(),
    getReviewPeriods(),
    getUsers(),
    getTeams(),
    getEmployeeProfiles(),
    getAppraisalAssignments(),
  ]);

  return JSON.stringify(
    {
      templates,
      employees,
      appraisals,
      links,
      settings,
      reviewPeriods,
      users,
      teams,
      employeeProfiles,
      assignments,
      version: '1.1.0',
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
}

/** Import a backup. Records go through the normal save functions, so they reach the server. */
export async function importData(json: string): Promise<void> {
  const data = JSON.parse(json);
  for (const template of data.templates ?? []) await saveTemplate(template);
  for (const team of data.teams ?? []) await saveTeam(team);
  for (const employee of data.employees ?? []) await saveEmployee(employee);
  for (const period of data.reviewPeriods ?? []) await saveReviewPeriod(period);
  for (const appraisal of data.appraisals ?? []) await saveAppraisal(appraisal);
  for (const link of data.links ?? []) await saveLink(link);
  if (Array.isArray(data.assignments)) await saveAppraisalAssignments(data.assignments);
  for (const user of data.users ?? []) await saveUser(user);
  for (const profile of data.employeeProfiles ?? []) {
    if (profile.employeeId) await saveEmployeeProfile(profile);
  }
  if (data.settings) await saveSettings(data.settings);
}
