import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Template, Employee, Appraisal, AppraisalLink, CompanySettings, PerformanceSummary, ReviewPeriod, User, Team, AppraisalAssignment, EmployeeProfile } from '@/types';

interface AppraisalDB extends DBSchema {
  templates: {
    key: string;
    value: Template;
  };
  employees: {
    key: string;
    value: Employee;
  };
  appraisals: {
    key: string;
    value: Appraisal;
  };
  links: {
    key: string;
    value: AppraisalLink;
  };
  settings: {
    key: string;
    value: CompanySettings;
  };
  summaries: {
    key: string;
    value: PerformanceSummary;
  };
  reviewPeriods: {
    key: string;
    value: ReviewPeriod;
  };
  users: {
    key: string;
    value: User;
    indexes: { 'by-username': string; 'by-employeeId': string };
  };
  teams: {
    key: string;
    value: Team;
  };
  appraisalAssignments: {
    key: string;
    value: AppraisalAssignment;
    indexes: { 'by-period': string; 'by-appraiser': string };
  };
  employeeProfiles: {
    key: string;
    value: EmployeeProfile;
  };
}

let db: IDBPDatabase<AppraisalDB> | null = null;
let _supabaseUsersDiagnosticLogged = false;

export async function initDB(): Promise<IDBPDatabase<AppraisalDB>> {
  if (db) return db;

  db = await openDB<AppraisalDB>('appraisal-db', 6, {
    upgrade(db, _oldVersion, _newVersion, transaction) {
      // Create all object stores if they don't exist
      if (!db.objectStoreNames.contains('templates')) {
        db.createObjectStore('templates', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('employees')) {
        db.createObjectStore('employees', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('appraisals')) {
        db.createObjectStore('appraisals', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('links')) {
        const linksStore = db.createObjectStore('links', { keyPath: 'id' });
        // @ts-ignore - idb library type issue
        linksStore.createIndex('token', 'token', { unique: true });
      } else {
        // Add index if it doesn't exist
        try {
          const linksStore = transaction.objectStore('links');
          // @ts-ignore - idb library type issue
          if (!linksStore.indexNames.contains('token')) {
            // @ts-ignore - idb library type issue
            // @ts-ignore - idb library type issue
            linksStore.createIndex('token', 'token', { unique: true });
          }
        } catch (e) {
          // Index might already exist, ignore
        }
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('summaries')) {
        db.createObjectStore('summaries', { keyPath: 'employeeId' });
      }
      if (!db.objectStoreNames.contains('reviewPeriods')) {
        const periodsStore = db.createObjectStore('reviewPeriods', { keyPath: 'id' });
        // @ts-ignore - idb library type issue
        periodsStore.createIndex('status', 'status');
        // @ts-ignore - idb library type issue
        periodsStore.createIndex('year', 'year');
      } else {
        // Add indexes if they don't exist
        try {
          const periodsStore = transaction.objectStore('reviewPeriods');
          // @ts-ignore - idb library type issue
          if (!periodsStore.indexNames.contains('status')) {
            // @ts-ignore - idb library type issue
            // @ts-ignore - idb library type issue
            periodsStore.createIndex('status', 'status');
          }
          // @ts-ignore - idb library type issue
          if (!periodsStore.indexNames.contains('year')) {
            // @ts-ignore - idb library type issue
            // @ts-ignore - idb library type issue
            periodsStore.createIndex('year', 'year');
          }
        } catch (e) {
          // Indexes might already exist, ignore
        }
      }
      // Create users store
      if (!db.objectStoreNames.contains('users')) {
        const usersStore = db.createObjectStore('users', { keyPath: 'id' });
        // @ts-ignore - idb library type issue
        usersStore.createIndex('by-username', 'username', { unique: true });
        // @ts-ignore - idb library type issue
        usersStore.createIndex('by-employeeId', 'employeeId', { unique: false });
      } else {
        // Add indexes if they don't exist
        try {
          const usersStore = transaction.objectStore('users');
          // @ts-ignore - idb library type issue
          if (!usersStore.indexNames.contains('by-username')) {
            // @ts-ignore - idb library type issue
            usersStore.createIndex('by-username', 'username', { unique: true });
          }
          // @ts-ignore - idb library type issue
          if (!usersStore.indexNames.contains('by-employeeId')) {
            // @ts-ignore - idb library type issue
            usersStore.createIndex('by-employeeId', 'employeeId', { unique: false });
          }
        } catch (e) {
          // Index might already exist, ignore
        }
      }
      // Create teams store
      if (!db.objectStoreNames.contains('teams')) {
        db.createObjectStore('teams', { keyPath: 'id' });
      }
      // Create appraisal_assignments store (auto + manual assignments)
      if (!db.objectStoreNames.contains('appraisalAssignments')) {
        const asnStore = db.createObjectStore('appraisalAssignments', { keyPath: 'id' });
        // @ts-ignore - idb library type issue
        asnStore.createIndex('by-period', 'reviewPeriodId', { unique: false });
        // @ts-ignore - idb library type issue
        asnStore.createIndex('by-appraiser', 'appraiserId', { unique: false });
      }
      // Create employee_profiles store (directory / org chart profiles)
      if (!db.objectStoreNames.contains('employeeProfiles')) {
        db.createObjectStore('employeeProfiles', { keyPath: 'employeeId' });
      }
    },
  });

  // Initialize default settings if not exists
  const settings = await db.get('settings', 'company');
  if (!settings) {
    await db.put('settings', {
      key: 'company',
      name: 'Your Company',
      adminPin: '1234',
      accentColor: '#3B82F6',
      theme: 'system',
    } as any);
  }

  return db;
}

// Templates - Supabase as single source of truth when configured; else IndexedDB
export async function getTemplates(): Promise<Template[]> {
  const database = await initDB();
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getTemplatesFromSupabase } = await import('./supabase-storage');
      const supabaseTemplates = await getTemplatesFromSupabase();
      if (import.meta.env.DEV) console.log('getTemplates: Found', supabaseTemplates.length, 'templates in Supabase');
      // Overwrite IndexedDB with Supabase result so local cache stays in sync
      if (database.objectStoreNames.contains('templates')) {
        const tx = database.transaction('templates', 'readwrite');
        const store = tx.objectStore('templates');
        await store.clear();
        for (const t of supabaseTemplates) await store.put(t);
      }
      return supabaseTemplates;
    }
  } catch (error) {
    if (import.meta.env.DEV) console.log('getTemplates: Supabase not available, using IndexedDB:', error);
  }
  try {
    if (database.objectStoreNames.contains('templates')) {
      return database.getAll('templates');
    }
  } catch (error) {
    console.error('Error getting templates from IndexedDB:', error);
  }
  return [];
}

export async function getTemplate(id: string): Promise<Template | undefined> {
  // Try Supabase first if configured
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getTemplateFromSupabase } = await import('./supabase-storage');
      return await getTemplateFromSupabase(id);
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }

  // Fallback to IndexedDB
  const database = await initDB();
  return database.get('templates', id);
}

export async function saveTemplate(template: Template): Promise<void> {
  // ALWAYS save to IndexedDB first to ensure data persistence
  const database = await initDB();
  await database.put('templates', template);
  console.log('Template saved to IndexedDB:', template.id);

  // Try Supabase if configured (but don't let Supabase errors prevent IndexedDB save)
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { saveTemplateToSupabase } = await import('./supabase-storage');
      try {
        await saveTemplateToSupabase(template);
        console.log('Template saved to Supabase:', template.id);
      } catch (supabaseError: any) {
        // Log Supabase errors but don't throw - IndexedDB save already succeeded
        console.warn('Failed to save template to Supabase (but saved to IndexedDB):', supabaseError);
        // Don't re-throw - IndexedDB save is sufficient
      }
    }
  } catch (error) {
    // If Supabase import or config check fails, that's fine - IndexedDB save already succeeded
    console.log('Supabase not available, data saved to IndexedDB only:', error);
  }
}

export async function deleteTemplate(id: string): Promise<void> {
  // Try Supabase first if configured
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { deleteTemplateFromSupabase } = await import('./supabase-storage');
      await deleteTemplateFromSupabase(id);
      // Also delete from IndexedDB
      const database = await initDB();
      await database.delete('templates', id);
      return;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }

  // Fallback to IndexedDB
  const database = await initDB();
  await database.delete('templates', id);
}

// Employees - Supabase as single source of truth when configured; fallback to IndexedDB for read-your-writes.
// Never throws: returns [] on any failure so directory never disappears due to unhandled rejection.
export async function getEmployees(): Promise<Employee[]> {
  try {
    const database = await initDB();
    try {
      const { isSupabaseConfigured } = await import('./supabase');
      if (isSupabaseConfigured()) {
        const { getEmployeesFromSupabase } = await import('./supabase-storage');
        const supabaseEmployees = await getEmployeesFromSupabase();
        if (import.meta.env.DEV) console.log('getEmployees: Found', supabaseEmployees.length, 'employees in Supabase');
        if (supabaseEmployees.length > 0) {
          // Merge IndexedDB over Supabase for employment_status, team_id, reports_to so local saves persist when Supabase lacks columns
          let merged = supabaseEmployees;
          if (database.objectStoreNames.contains('employees')) {
            const idbEmployees = await database.getAll('employees');
            const idbById = new Map(idbEmployees.map((e) => [e.id, e]));
            merged = supabaseEmployees.map((se) => {
              const local = idbById.get(se.id);
              if (!local) return se;
              return {
                ...se,
                employmentStatus: local.employmentStatus ?? se.employmentStatus,
                teamId: local.teamId ?? se.teamId,
                reportsTo: local.reportsTo ?? se.reportsTo,
              };
            });
            const tx = database.transaction('employees', 'readwrite');
            const store = tx.objectStore('employees');
            await store.clear();
            for (const e of merged) await store.put(e);
          }
          return merged;
        }
        // Supabase returned empty — do not overwrite IndexedDB; return existing data so directory does not disappear
        if (database.objectStoreNames.contains('employees')) {
          const existing = await database.getAll('employees');
          if (existing.length > 0) return existing;
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) console.log('getEmployees: Supabase not available, using IndexedDB:', error);
    }
    try {
      if (database.objectStoreNames.contains('employees')) {
        return await database.getAll('employees');
      }
    } catch (error) {
      console.error('Error getting employees from IndexedDB:', error);
    }
    return [];
  } catch (error) {
    console.error('getEmployees failed:', error);
    return [];
  }
}

export async function getEmployee(id: string): Promise<Employee | undefined> {
  const database = await initDB();
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getEmployeeFromSupabase } = await import('./supabase-storage');
      const supabaseEmployee = await getEmployeeFromSupabase(id);
      if (supabaseEmployee) {
        // Merge employment_status, team_id, reports_to from IndexedDB so local saves persist when Supabase lacks columns
        if (database.objectStoreNames.contains('employees')) {
          const local = await database.get('employees', id);
          if (local) {
            return {
              ...supabaseEmployee,
              employmentStatus: local.employmentStatus ?? supabaseEmployee.employmentStatus,
              teamId: local.teamId ?? supabaseEmployee.teamId,
              reportsTo: local.reportsTo ?? supabaseEmployee.reportsTo,
            };
          }
        }
        return supabaseEmployee;
      }
      // Supabase returned nothing – employee was deleted; clear local cache so other devices don't see stale employee
      try {
        if (database.objectStoreNames.contains('employees')) {
          await database.delete('employees', id);
        }
      } catch (_) {
        /* ignore */
      }
      return undefined;
    }
  } catch (error) {
    if (import.meta.env.DEV) console.log('getEmployee: Supabase not available, using IndexedDB:', error);
  }
  return database.get('employees', id);
}

export async function saveEmployee(employee: Employee): Promise<void> {
  const database = await initDB();

  // Always write to IndexedDB first so employment_status / team_id / reports_to persist even if Supabase is missing columns
  if (database.objectStoreNames.contains('employees')) {
    await database.put('employees', employee);
  }

  const { isSupabaseConfigured } = await import('./supabase');
  if (isSupabaseConfigured()) {
    try {
      const { saveEmployeeToSupabase } = await import('./supabase-storage');
      await saveEmployeeToSupabase(employee);
      if (import.meta.env.DEV) console.log('Employee saved to Supabase:', employee.id);
    } catch (e) {
      // IndexedDB already has the correct data; surface error so user knows cloud sync failed
      console.warn('Employee saved locally but Supabase sync failed:', e);
      throw e;
    }
    return;
  }

  if (import.meta.env.DEV) console.log('Employee saved to IndexedDB:', employee.id);
}

/** Update only an employee's team (assign/remove as department leader). Uses PATCH when Supabase is configured to avoid upsert 400s. */
export async function updateEmployeeTeam(employeeId: string, teamId: string | null): Promise<void> {
  const database = await initDB();
  const { isSupabaseConfigured } = await import('./supabase');

  if (isSupabaseConfigured()) {
    const { updateEmployeeTeamInSupabase } = await import('./supabase-storage');
    await updateEmployeeTeamInSupabase(employeeId, teamId);
    const emp = await getEmployee(employeeId);
    if (emp && database.objectStoreNames.contains('employees')) {
      await database.put('employees', { ...emp, teamId: teamId ?? undefined });
    }
    return;
  }

  const emp = await getEmployee(employeeId);
  if (emp) {
    await saveEmployee({ ...emp, teamId: teamId ?? undefined });
  }
}

/** Cascade-delete all data referencing this employee (appraisals, assignments, links, summaries). Call before deleting the employee or when deleting a user linked to this employee. */
export async function cascadeDeleteForEmployee(employeeId: string): Promise<void> {
  const database = await initDB();

  // IndexedDB: appraisals where employee is subject or appraiser
  if (database.objectStoreNames.contains('appraisals')) {
    const all = await database.getAll('appraisals');
    for (const a of all) {
      if (a.employeeId === employeeId || a.appraiserId === employeeId) {
        await database.delete('appraisals', a.id);
      }
    }
  }

  // IndexedDB: assignments where employee is subject or appraiser
  if (database.objectStoreNames.contains('appraisalAssignments')) {
    const all = await database.getAll('appraisalAssignments');
    for (const a of all) {
      if (a.employeeId === employeeId || a.appraiserId === employeeId) {
        await database.delete('appraisalAssignments', a.id);
      }
    }
  }

  // IndexedDB: links where employee is subject or appraiser
  if (database.objectStoreNames.contains('links')) {
    const all = await database.getAll('links');
    for (const l of all) {
      if (l.employeeId === employeeId || l.appraiserId === employeeId) {
        await database.delete('links', l.id);
      }
    }
  }

  // IndexedDB: performance summaries for this employee
  if (database.objectStoreNames.contains('summaries')) {
    try {
      await database.delete('summaries', employeeId);
    } catch {
      // summaries keyPath is employeeId; ignore if missing
    }
  }

  // IndexedDB: employee profile for this employee
  if (database.objectStoreNames.contains('employeeProfiles')) {
    try {
      await database.delete('employeeProfiles', employeeId);
    } catch {
      // ignore if missing
    }
  }

  // Supabase: appraisals and links for this employee
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const {
        deleteAppraisalsForEmployeeFromSupabase,
        deleteLinksForEmployeeFromSupabase,
      } = await import('./supabase-storage');
      await deleteAppraisalsForEmployeeFromSupabase(employeeId);
      await deleteLinksForEmployeeFromSupabase(employeeId);
    }
  } catch {
    // Supabase not available, IndexedDB cascade is enough
  }
}

export async function deleteEmployee(id: string): Promise<void> {
  await cascadeDeleteForEmployee(id);

  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { deleteEmployeeFromSupabase } = await import('./supabase-storage');
      await deleteEmployeeFromSupabase(id);
      const database = await initDB();
      await database.delete('employees', id);
      // Lock all users linked to this employee so they cannot sign in again; other devices will log out on next refresh
      const allUsers = await getUsers();
      const linkedUsers = allUsers.filter((u) => u.employeeId === id);
      for (const u of linkedUsers) {
        await saveUser({ ...u, active: false });
      }
      try {
        const channel = new BroadcastChannel('appraisals-auth');
        channel.postMessage({ type: 'employeeDeleted', employeeId: id });
        channel.close();
      } catch {
        /* BroadcastChannel not supported */
      }
      return;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }

  const database = await initDB();
  await database.delete('employees', id);
  // Lock linked users and broadcast for same-device tabs (IndexedDB-only path)
  const allUsers = await getUsers();
  const linkedUsers = allUsers.filter((u) => u.employeeId === id);
  for (const u of linkedUsers) {
    await saveUser({ ...u, active: false });
  }
  try {
    const channel = new BroadcastChannel('appraisals-auth');
    channel.postMessage({ type: 'employeeDeleted', employeeId: id });
    channel.close();
  } catch {
    /* BroadcastChannel not supported */
  }
}

// Appraisals - Supabase as single source of truth when configured; else IndexedDB
export async function getAppraisals(): Promise<Appraisal[]> {
  const database = await initDB();
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getAppraisalsFromSupabase } = await import('./supabase-storage');
      const supabaseAppraisals = await getAppraisalsFromSupabase();
      if (import.meta.env.DEV) console.log('getAppraisals: Found', supabaseAppraisals.length, 'appraisals in Supabase');
      if (database.objectStoreNames.contains('appraisals')) {
        const tx = database.transaction('appraisals', 'readwrite');
        const store = tx.objectStore('appraisals');
        await store.clear();
        for (const a of supabaseAppraisals) await store.put(a);
      }
      return supabaseAppraisals;
    }
  } catch (error) {
    if (import.meta.env.DEV) console.log('getAppraisals: Supabase not available, using IndexedDB:', error);
  }
  try {
    if (database.objectStoreNames.contains('appraisals')) {
      return database.getAll('appraisals');
    }
  } catch (error) {
    console.error('Error getting appraisals from IndexedDB:', error);
  }
  return [];
}

export async function getAppraisal(id: string): Promise<Appraisal | undefined> {
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getAppraisalFromSupabase } = await import('./supabase-storage');
      return await getAppraisalFromSupabase(id);
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }
  const database = await initDB();
  return database.get('appraisals', id);
}

export async function saveAppraisal(appraisal: Appraisal): Promise<void> {
  // ALWAYS save to IndexedDB first to ensure data persistence
  const database = await initDB();
  await database.put('appraisals', appraisal);
  console.log('Appraisal saved to IndexedDB:', appraisal.id);

  // Try Supabase if configured (but don't let Supabase errors prevent IndexedDB save)
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { saveAppraisalToSupabase } = await import('./supabase-storage');
      try {
        await saveAppraisalToSupabase(appraisal);
        console.log('Appraisal saved to Supabase:', appraisal.id);
      } catch (supabaseError: any) {
        // Log Supabase errors but don't throw - IndexedDB save already succeeded
        console.warn('Failed to save appraisal to Supabase (but saved to IndexedDB):', supabaseError);
        // Don't re-throw - IndexedDB save is sufficient
      }
    }
  } catch (error) {
    // If Supabase import or config check fails, that's fine - IndexedDB save already succeeded
    console.log('Supabase not available, data saved to IndexedDB only:', error);
  }
}

export async function deleteAppraisal(id: string): Promise<void> {
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { deleteAppraisalFromSupabase } = await import('./supabase-storage');
      await deleteAppraisalFromSupabase(id);
      const database = await initDB();
      await database.delete('appraisals', id);
      return;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }
  const database = await initDB();
  await database.delete('appraisals', id);
}

// Links - Supabase as single source of truth when configured; else IndexedDB
export async function getLinks(): Promise<AppraisalLink[]> {
  const database = await initDB();
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getLinksFromSupabase } = await import('./supabase-storage');
      const supabaseLinks = await getLinksFromSupabase();
      if (import.meta.env.DEV) console.log('getLinks: Found', supabaseLinks.length, 'links in Supabase');
      if (database.objectStoreNames.contains('links')) {
        const tx = database.transaction('links', 'readwrite');
        const store = tx.objectStore('links');
        await store.clear();
        for (const link of supabaseLinks) await store.put(link);
      }
      return supabaseLinks;
    }
  } catch (error) {
    if (import.meta.env.DEV) console.log('getLinks: Supabase not available, using IndexedDB:', error);
  }
  try {
    if (database.objectStoreNames.contains('links')) {
      return database.getAll('links');
    }
  } catch (error) {
    console.error('Error getting links from IndexedDB:', error);
  }
  return [];
}

export async function getLinkByToken(token: string): Promise<AppraisalLink | undefined> {
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getLinkByTokenFromSupabase } = await import('./supabase-storage');
      return await getLinkByTokenFromSupabase(token);
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }
  const database = await initDB();
  try {
    const tx = database.transaction('links', 'readonly');
    // @ts-ignore
    const index = tx.store.index('token');
    // @ts-ignore
    return await index.get(token);
  } catch (error) {
    // Fallback if index doesn't exist yet
    const allLinks = await database.getAll('links');
    return allLinks.find((link) => link.token === token);
  }
}

export async function saveLink(link: AppraisalLink): Promise<void> {
  // ALWAYS save to IndexedDB first to ensure data persistence
  const database = await initDB();
  await database.put('links', link);
  console.log('Link saved to IndexedDB:', link.id);

  // Try Supabase if configured (but don't let Supabase errors prevent IndexedDB save)
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { saveLinkToSupabase } = await import('./supabase-storage');
      try {
        await saveLinkToSupabase(link);
        console.log('Link saved to Supabase:', link.id);
      } catch (supabaseError: any) {
        // Log Supabase errors but don't throw - IndexedDB save already succeeded
        console.warn('Failed to save link to Supabase (but saved to IndexedDB):', supabaseError);
        // Don't re-throw - IndexedDB save is sufficient
      }
    }
  } catch (error) {
    // If Supabase import or config check fails, that's fine - IndexedDB save already succeeded
    console.log('Supabase not available, data saved to IndexedDB only:', error);
  }
}

export async function deleteLink(id: string): Promise<void> {
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { deleteLinkFromSupabase } = await import('./supabase-storage');
      await deleteLinkFromSupabase(id);
      const database = await initDB();
      await database.delete('links', id);
      return;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }
  const database = await initDB();
  await database.delete('links', id);
}

// Appraisal Assignments (auto + manual) – Supabase as source of truth when configured; else IndexedDB
export async function getAppraisalAssignments(): Promise<AppraisalAssignment[]> {
  const database = await initDB();
  if (!database.objectStoreNames.contains('appraisalAssignments')) return [];
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getAppraisalAssignmentsFromSupabase, saveAppraisalAssignmentToSupabase } = await import('./supabase-storage');
      let list: AppraisalAssignment[];
      try {
        list = await getAppraisalAssignmentsFromSupabase();
      } catch (e: unknown) {
        if (e instanceof Error && e.message === 'TABLE_MISSING') {
          const local = await database.getAll('appraisalAssignments');
          if (import.meta.env.DEV) console.info('getAppraisalAssignments: appraisal_assignments table missing in Supabase, using local data. Run supabase-appraisal-assignments.sql to sync to all staff.');
          return local;
        }
        throw e;
      }
      const local = await database.getAll('appraisalAssignments');
      if (list.length === 0 && local.length > 0) {
        for (const a of local) {
          try {
            await saveAppraisalAssignmentToSupabase(a);
          } catch {
            // table may not exist or other error; skip
          }
        }
        list = await getAppraisalAssignmentsFromSupabase();
      }
      const tx = database.transaction('appraisalAssignments', 'readwrite');
      const store = tx.objectStore('appraisalAssignments');
      await store.clear();
      for (const a of list) await store.put(a);
      if (import.meta.env.DEV) console.log('getAppraisalAssignments: Found', list.length, 'assignments in Supabase');
      return list;
    }
  } catch (error) {
    if (import.meta.env.DEV) console.log('getAppraisalAssignments: Supabase not available, using IndexedDB:', error);
  }
  return database.getAll('appraisalAssignments');
}

export async function getAppraisalAssignment(id: string): Promise<AppraisalAssignment | undefined> {
  const database = await initDB();
  if (!database.objectStoreNames.contains('appraisalAssignments')) return undefined;
  return database.get('appraisalAssignments', id);
}

export async function getAppraisalAssignmentsForPeriod(reviewPeriodId: string): Promise<AppraisalAssignment[]> {
  const database = await initDB();
  if (!database.objectStoreNames.contains('appraisalAssignments')) return [];
  const all = await database.getAll('appraisalAssignments');
  return all.filter((a) => a.reviewPeriodId === reviewPeriodId);
}

export async function getAppraisalAssignmentsByAppraiser(appraiserId: string): Promise<AppraisalAssignment[]> {
  const database = await initDB();
  if (!database.objectStoreNames.contains('appraisalAssignments')) return [];
  const all = await database.getAll('appraisalAssignments');
  return all.filter((a) => a.appraiserId === appraiserId);
}

export async function saveAppraisalAssignment(assignment: AppraisalAssignment): Promise<void> {
  const database = await initDB();
  if (database.objectStoreNames.contains('appraisalAssignments')) {
    await database.put('appraisalAssignments', assignment);
  }
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { saveAppraisalAssignmentToSupabase } = await import('./supabase-storage');
      await saveAppraisalAssignmentToSupabase(assignment);
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn('saveAppraisalAssignment: Supabase sync failed', e);
  }
}

export async function saveAppraisalAssignments(assignments: AppraisalAssignment[]): Promise<void> {
  const database = await initDB();
  if (database.objectStoreNames.contains('appraisalAssignments')) {
    for (const a of assignments) await database.put('appraisalAssignments', a);
  }
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { saveAppraisalAssignmentToSupabase } = await import('./supabase-storage');
      for (const a of assignments) await saveAppraisalAssignmentToSupabase(a);
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn('saveAppraisalAssignments: Supabase sync failed', e);
  }
}

export async function deleteAppraisalAssignment(id: string): Promise<void> {
  const database = await initDB();
  if (database.objectStoreNames.contains('appraisalAssignments')) {
    await database.delete('appraisalAssignments', id);
  }
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { deleteAppraisalAssignmentFromSupabase } = await import('./supabase-storage');
      await deleteAppraisalAssignmentFromSupabase(id);
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn('deleteAppraisalAssignment: Supabase sync failed', e);
  }
}

/** Delete all appraisal assignments (forms) for a review period. Use to "start over" for that period. */
export async function deleteAssignmentsByPeriod(reviewPeriodId: string): Promise<number> {
  const list = await getAppraisalAssignmentsForPeriod(reviewPeriodId);
  const database = await initDB();
  if (database.objectStoreNames.contains('appraisalAssignments')) {
    for (const a of list) await database.delete('appraisalAssignments', a.id);
  }
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { deleteAssignmentsByPeriodFromSupabase } = await import('./supabase-storage');
      await deleteAssignmentsByPeriodFromSupabase(reviewPeriodId);
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn('deleteAssignmentsByPeriod: Supabase sync failed', e);
  }
  return list.length;
}

/**
 * Clear all appraisal data (assignments, completed appraisals, links, performance summaries) so you can start fresh.
 * Does NOT remove users, employees, teams, templates, review periods, or settings.
 */
export async function clearAllAppraisalData(): Promise<{
  assignments: number;
  appraisals: number;
  links: number;
  summaries: number;
}> {
  const [allAssignments, allAppraisals, allLinks] = await Promise.all([
    getAppraisalAssignments(),
    getAppraisals(),
    getLinks(),
  ]);
  const database = await initDB();
  let summariesCount = 0;
  if (database.objectStoreNames.contains('summaries')) {
    const allSummaries = await database.getAll('summaries');
    summariesCount = allSummaries.length;
  }
  const counts = {
    assignments: allAssignments.length,
    appraisals: allAppraisals.length,
    links: allLinks.length,
    summaries: summariesCount,
  };

  if (database.objectStoreNames.contains('appraisalAssignments')) {
    for (const a of allAssignments) await database.delete('appraisalAssignments', a.id);
  }
  if (database.objectStoreNames.contains('appraisals')) {
    for (const a of allAppraisals) await database.delete('appraisals', a.id);
  }
  if (database.objectStoreNames.contains('links')) {
    for (const l of allLinks) await database.delete('links', l.id);
  }
  if (database.objectStoreNames.contains('summaries')) {
    const allSummaries = await database.getAll('summaries');
    for (const s of allSummaries) await database.delete('summaries', (s as { employeeId: string }).employeeId);
  }

  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const {
        deleteAllAppraisalsFromSupabase,
        deleteAllLinksFromSupabase,
        deleteAllSummariesFromSupabase,
        deleteAllAssignmentsFromSupabase,
      } = await import('./supabase-storage');
      await deleteAllAssignmentsFromSupabase();
      await deleteAllAppraisalsFromSupabase();
      await deleteAllLinksFromSupabase();
      await deleteAllSummariesFromSupabase();
    }
  } catch (e) {
    console.warn('clearAllAppraisalData: Supabase clear failed', e);
  }

  return counts;
}

// Settings - Supabase as single source of truth when configured; else IndexedDB
const defaultSettings: CompanySettings = {
  name: 'Your Company',
  adminPin: '1234',
  accentColor: '#3B82F6',
  theme: 'system',
  hrScoreWeight: 30,
  requireHrForRanking: false,
};

export async function getSettings(): Promise<CompanySettings> {
  const database = await initDB();
  const stored = await database.get('settings', 'company') as (CompanySettings & { key?: string }) | undefined;
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getSettingsFromSupabase } = await import('./supabase-storage');
      const fromSupabase = await getSettingsFromSupabase();
      if (fromSupabase) {
        const merged = { ...defaultSettings, ...fromSupabase };
        // Prefer IndexedDB for HR fields so local slider saves persist (re-read after Supabase to get latest)
        const latestStored = await database.get('settings', 'company') as (CompanySettings & { key?: string }) | undefined;
        const idbSettings = latestStored ?? stored;
        if (idbSettings) {
          if (idbSettings.hrScoreWeight != null) merged.hrScoreWeight = idbSettings.hrScoreWeight;
          if (idbSettings.requireHrForRanking != null) merged.requireHrForRanking = idbSettings.requireHrForRanking;
        }
        const toStore = { ...merged, key: 'company' };
        if (database.objectStoreNames.contains('settings')) {
          await database.put('settings', toStore as any);
        }
        return merged as CompanySettings;
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) console.log('getSettings: Supabase not available, using IndexedDB:', error);
  }
  const merged = { ...defaultSettings, ...(stored as CompanySettings) };
  if (stored && (stored as any).key) delete (merged as any).key;
  return merged as CompanySettings;
}

export async function saveSettings(settings: CompanySettings): Promise<void> {
  // ALWAYS save to IndexedDB first to ensure data persistence
  const database = await initDB();
  await database.put('settings', { ...settings, key: 'company' } as any);
  console.log('Settings saved to IndexedDB');

  // Try Supabase if configured (but don't let Supabase errors prevent IndexedDB save)
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { saveSettingsToSupabase } = await import('./supabase-storage');
      try {
        await saveSettingsToSupabase(settings);
        console.log('Settings saved to Supabase');
      } catch (supabaseError: any) {
        // Log Supabase errors but don't throw - IndexedDB save already succeeded
        console.warn('Failed to save settings to Supabase (but saved to IndexedDB):', supabaseError);
        // Don't re-throw - IndexedDB save is sufficient
      }
    }
  } catch (error) {
    // If Supabase import or config check fails, that's fine - IndexedDB save already succeeded
    console.log('Supabase not available, data saved to IndexedDB only:', error);
  }
}

// Summaries - Hybrid: Supabase (if configured) or IndexedDB (fallback)
export async function getSummary(employeeId: string): Promise<PerformanceSummary | undefined> {
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getSummaryFromSupabase } = await import('./supabase-storage');
      return await getSummaryFromSupabase(employeeId);
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }
  const database = await initDB();
  return database.get('summaries', employeeId);
}

export async function saveSummary(summary: PerformanceSummary): Promise<void> {
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { saveSummaryToSupabase } = await import('./supabase-storage');
      await saveSummaryToSupabase(summary);
      const database = await initDB();
      await database.put('summaries', summary);
      return;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }
  const database = await initDB();
  await database.put('summaries', summary);
}

// Review Periods - Supabase as single source of truth when configured; else IndexedDB
export async function getReviewPeriods(): Promise<ReviewPeriod[]> {
  const database = await initDB();
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getReviewPeriodsFromSupabase } = await import('./supabase-storage');
      const supabasePeriods = await getReviewPeriodsFromSupabase();
      if (import.meta.env.DEV) console.log('getReviewPeriods: Found', supabasePeriods.length, 'periods in Supabase');
      if (database.objectStoreNames.contains('reviewPeriods')) {
        const tx = database.transaction('reviewPeriods', 'readwrite');
        const store = tx.objectStore('reviewPeriods');
        await store.clear();
        for (const p of supabasePeriods) await store.put(p);
      }
      return supabasePeriods;
    }
  } catch (error) {
    if (import.meta.env.DEV) console.log('getReviewPeriods: Supabase not available, using IndexedDB:', error);
  }
  try {
    if (database.objectStoreNames.contains('reviewPeriods')) {
      return database.getAll('reviewPeriods');
    }
  } catch (error) {
    console.error('Error getting review periods from IndexedDB:', error);
  }
  return [];
}

export async function getReviewPeriod(id: string): Promise<ReviewPeriod | undefined> {
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getReviewPeriodFromSupabase } = await import('./supabase-storage');
      return await getReviewPeriodFromSupabase(id);
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }
  const database = await initDB();
  return database.get('reviewPeriods', id);
}

export async function getActiveReviewPeriods(): Promise<ReviewPeriod[]> {
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const periods = await getReviewPeriods();
      return periods.filter((p) => p.status === 'active');
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }

  const database = await initDB();
  try {
    if (!database.objectStoreNames.contains('reviewPeriods')) {
      return [];
    }
    const tx = database.transaction('reviewPeriods', 'readonly');
    const store = tx.objectStore('reviewPeriods');
    // @ts-ignore - idb library type issue
    if (store.indexNames.contains('status')) {
      // @ts-ignore - idb library type issue
      const index = store.index('status');
      // @ts-ignore - idb library type issue
      return index.getAll('active');
    }
    const allPeriods = await store.getAll();
    return allPeriods.filter((p) => p.status === 'active');
  } catch (error) {
    console.error('Error getting active review periods:', error);
    return [];
  }
}

export async function saveReviewPeriod(period: ReviewPeriod): Promise<void> {
  // ALWAYS save to IndexedDB first to ensure data persistence
  const database = await initDB();
  await database.put('reviewPeriods', period);
  console.log('Review period saved to IndexedDB:', period.id);

  // Try Supabase if configured (but don't let Supabase errors prevent IndexedDB save)
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { saveReviewPeriodToSupabase } = await import('./supabase-storage');
      try {
        await saveReviewPeriodToSupabase(period);
        console.log('Review period saved to Supabase:', period.id);
      } catch (supabaseError: any) {
        // Log Supabase errors but don't throw - IndexedDB save already succeeded
        console.warn('Failed to save review period to Supabase (but saved to IndexedDB):', supabaseError);
        // Don't re-throw - IndexedDB save is sufficient
      }
    }
  } catch (error) {
    // If Supabase import or config check fails, that's fine - IndexedDB save already succeeded
    console.log('Supabase not available, data saved to IndexedDB only:', error);
  }
}

export async function deleteReviewPeriod(id: string): Promise<void> {
  const database = await initDB();

  // Cascade: delete all assignments and links for this period first
  if (database.objectStoreNames.contains('appraisalAssignments')) {
    const assignments = await getAppraisalAssignmentsForPeriod(id);
    for (const a of assignments) await database.delete('appraisalAssignments', a.id);
  }
  if (database.objectStoreNames.contains('links')) {
    const allLinks = await database.getAll('links');
    for (const l of allLinks) {
      if (l.reviewPeriodId === id) await database.delete('links', l.id);
    }
  }

  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { deleteReviewPeriodFromSupabase } = await import('./supabase-storage');
      await deleteReviewPeriodFromSupabase(id);
      await database.delete('reviewPeriods', id);
      return;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }
  await database.delete('reviewPeriods', id);
}

// Teams - Supabase as single source of truth when configured; else IndexedDB
export async function getTeams(): Promise<Team[]> {
  const database = await initDB();
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getTeamsFromSupabase } = await import('./supabase-storage');
      const supabaseTeams = await getTeamsFromSupabase();
      if (import.meta.env.DEV) console.log('getTeams: Found', supabaseTeams.length, 'teams in Supabase');
      if (database.objectStoreNames.contains('teams')) {
        const tx = database.transaction('teams', 'readwrite');
        const store = tx.objectStore('teams');
        await store.clear();
        for (const t of supabaseTeams) await store.put(t);
      }
      return supabaseTeams;
    }
  } catch (error) {
    if (import.meta.env.DEV) console.log('getTeams: Supabase not available, using IndexedDB:', error);
  }
  try {
    if (database.objectStoreNames.contains('teams')) {
      return database.getAll('teams');
    }
  } catch (error) {
    console.error('Error getting teams from IndexedDB:', error);
  }
  return [];
}

export async function getTeam(id: string): Promise<Team | undefined> {
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getTeamFromSupabase } = await import('./supabase-storage');
      return await getTeamFromSupabase(id);
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }
  const database = await initDB();
  return database.get('teams', id);
}

export async function saveTeam(team: Team): Promise<void> {
  // ALWAYS save to IndexedDB first to ensure data persistence
  const database = await initDB();
  await database.put('teams', team);
  console.log('Team saved to IndexedDB:', team.id);

  // Try Supabase if configured (but don't let Supabase errors prevent IndexedDB save)
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { saveTeamToSupabase } = await import('./supabase-storage');
      try {
        await saveTeamToSupabase(team);
        console.log('Team saved to Supabase:', team.id);
      } catch (supabaseError: any) {
        // Log Supabase errors but don't throw - IndexedDB save already succeeded
        console.warn('Failed to save team to Supabase (but saved to IndexedDB):', supabaseError);
        // Don't re-throw - IndexedDB save is sufficient
      }
    }
  } catch (error) {
    // If Supabase import or config check fails, that's fine - IndexedDB save already succeeded
    console.log('Supabase not available, data saved to IndexedDB only:', error);
  }
}

export async function deleteTeam(id: string): Promise<void> {
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { deleteTeamFromSupabase } = await import('./supabase-storage');
      await deleteTeamFromSupabase(id);
      const database = await initDB();
      await database.delete('teams', id);
      return;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }
  const database = await initDB();
  await database.delete('teams', id);
}

// Get user by employee ID - Supabase first when configured; fallback to IndexedDB so same-device read-after-write works
export async function getUserByEmployeeId(employeeId: string): Promise<User | undefined> {
  const database = await initDB();
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getUserByEmployeeIdFromSupabase } = await import('./supabase-storage');
      const supabaseUser = await getUserByEmployeeIdFromSupabase(employeeId);
      if (supabaseUser) return supabaseUser;
      // Supabase returned nothing – fall back to IndexedDB so the creating browser sees its just-written user
    }
  } catch (error) {
    if (import.meta.env.DEV) console.log('getUserByEmployeeId: Supabase not available, using IndexedDB:', error);
  }
  try {
    if (database.objectStoreNames.contains('users')) {
      const allUsers = await database.getAll('users');
      return allUsers.find((u) => u.employeeId === employeeId);
    }
  } catch (error) {
    console.error('Error getting user from IndexedDB:', error);
  }
  return undefined;
}

/**
 * Reset local IndexedDB from Supabase and overwrite with cloud data.
 * Use when Supabase is configured to force all browsers to see the same data.
 * @returns true if sync succeeded, false if Supabase not configured or sync failed
 */
export async function syncFromSupabase(): Promise<boolean> {
  try {
    const { isSupabaseConfigured, getUsersFromSupabase } = await import('./supabase');
    if (!isSupabaseConfigured()) {
      return false;
    }
    const {
      getTemplatesFromSupabase,
      getEmployeesFromSupabase,
      getAppraisalsFromSupabase,
      getLinksFromSupabase,
      getSettingsFromSupabase,
      getReviewPeriodsFromSupabase,
      getTeamsFromSupabase,
    } = await import('./supabase-storage');

    const database = await initDB();

    const [templates, employees, appraisals, links, settings, periods, teams, users] = await Promise.all([
      getTemplatesFromSupabase(),
      getEmployeesFromSupabase(),
      getAppraisalsFromSupabase(),
      getLinksFromSupabase(),
      getSettingsFromSupabase(),
      getReviewPeriodsFromSupabase(),
      getTeamsFromSupabase(),
      getUsersFromSupabase(),
    ]);

    if (database.objectStoreNames.contains('templates')) {
      const tx = database.transaction('templates', 'readwrite');
      const store = tx.objectStore('templates');
      await store.clear();
      for (const t of templates) await store.put(t);
    }
    if (database.objectStoreNames.contains('employees')) {
      const tx = database.transaction('employees', 'readwrite');
      const store = tx.objectStore('employees');
      await store.clear();
      for (const e of employees) await store.put(e);
    }
    if (database.objectStoreNames.contains('appraisals')) {
      const tx = database.transaction('appraisals', 'readwrite');
      const store = tx.objectStore('appraisals');
      await store.clear();
      for (const a of appraisals) await store.put(a);
    }
    if (database.objectStoreNames.contains('links')) {
      const tx = database.transaction('links', 'readwrite');
      const store = tx.objectStore('links');
      await store.clear();
      for (const link of links) await store.put(link);
    }
    if (database.objectStoreNames.contains('settings') && settings) {
      await database.put('settings', { ...settings, key: 'company' } as any);
    }
    if (database.objectStoreNames.contains('reviewPeriods')) {
      const tx = database.transaction('reviewPeriods', 'readwrite');
      const store = tx.objectStore('reviewPeriods');
      await store.clear();
      for (const p of periods) await store.put(p);
    }
    if (database.objectStoreNames.contains('teams')) {
      const tx = database.transaction('teams', 'readwrite');
      const store = tx.objectStore('teams');
      await store.clear();
      for (const t of teams) await store.put(t);
    }
    if (database.objectStoreNames.contains('users')) {
      const tx = database.transaction('users', 'readwrite');
      const store = tx.objectStore('users');
      await store.clear();
      for (const u of users) {
        await store.put({ ...u, username: (u.username || '').toLowerCase() });
      }
    }

    if (import.meta.env.DEV) {
      console.log('syncFromSupabase: completed', {
        templates: templates.length,
        employees: employees.length,
        appraisals: appraisals.length,
        links: links.length,
        periods: periods.length,
        teams: teams.length,
        users: users.length,
      });
    }
    return true;
  } catch (error) {
    console.error('syncFromSupabase failed:', error);
    return false;
  }
}

// Export/Import
export async function exportData(): Promise<string> {
  const [templates, employees, appraisals, links, settings, reviewPeriods, users, teams, employeeProfiles] = await Promise.all([
    getTemplates(),
    getEmployees(),
    getAppraisals(),
    getLinks(),
    getSettings(),
    getReviewPeriods(),
    getUsers(),
    getTeams(),
    getEmployeeProfiles(),
  ]);

  return JSON.stringify({
    templates,
    employees,
    appraisals,
    links,
    settings,
    reviewPeriods,
    users,
    teams,
    employeeProfiles,
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

// Users - Supabase as single source of truth when configured; else IndexedDB
export async function getUsers(): Promise<User[]> {
  const database = await initDB();
  try {
    const { isSupabaseConfigured, getUsersFromSupabase, getSupabaseProjectHint } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const supabaseUsers = await getUsersFromSupabase();
      if (!_supabaseUsersDiagnosticLogged) {
        _supabaseUsersDiagnosticLogged = true;
        console.log('Supabase: configured, users count =', supabaseUsers.length, `(${getSupabaseProjectHint()})`);
      }
      if (import.meta.env.DEV) console.log('getUsers: Found', supabaseUsers.length, 'users in Supabase');
      if (database.objectStoreNames.contains('users')) {
        const tx = database.transaction('users', 'readwrite');
        const store = tx.objectStore('users');
        await store.clear();
        for (const u of supabaseUsers) {
          await store.put({ ...u, username: (u.username || '').toLowerCase() });
        }
      }
      return supabaseUsers;
    }
  } catch (error) {
    if (import.meta.env.DEV) console.log('getUsers: Supabase not available, using IndexedDB:', error);
  }
  try {
    if (database.objectStoreNames.contains('users')) {
      return database.getAll('users');
    }
  } catch (error) {
    console.error('Error getting users from IndexedDB:', error);
  }
  return [];
}

export async function getUser(id: string): Promise<User | undefined> {
  const database = await initDB();
  try {
    const { isSupabaseConfigured, getUserFromSupabase } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const user = await getUserFromSupabase(id);
      if (user) {
        try {
          if (database.objectStoreNames.contains('users')) {
            await database.put('users', { ...user, username: (user.username || '').toLowerCase() });
          }
        } catch (_) {
          /* ignore cache write errors */
        }
        return user;
      }
      // Supabase returned nothing – user was deleted; clear local cache so other devices/sessions don't see stale user
      try {
        if (database.objectStoreNames.contains('users')) {
          await database.delete('users', id);
        }
      } catch (_) {
        /* ignore */
      }
      return undefined;
    }
  } catch (error) {
    if (import.meta.env.DEV) console.log('getUser: Supabase not available, using IndexedDB:', error);
  }
  return database.get('users', id);
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  // Try Supabase first if configured
  try {
    const { isSupabaseConfigured, getUserByUsernameFromSupabase } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const user = await getUserByUsernameFromSupabase(username);
      if (user) {
        return user;
      }
      // If Supabase is configured but user not found, return undefined (don't fallback)
      return undefined;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }

  // Fallback to IndexedDB
  const database = await initDB();
  try {
    if (!database.objectStoreNames.contains('users')) {
      console.log('Users store does not exist');
      return undefined;
    }
    
    const trimmedUsername = username.trim().toLowerCase();
    console.log('Looking for user with username (normalized):', trimmedUsername);
    
    const tx = database.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    
    // Try using index first
    // @ts-ignore - idb library type issue
    if (store.indexNames.contains('by-username')) {
      try {
        // @ts-ignore - idb library type issue
        const index = store.index('by-username');
        // Try exact match first
        // @ts-ignore - idb library type issue
        let user = await index.get(username.trim());
        
        // If not found, try case-insensitive lookup
        if (!user) {
          // @ts-ignore - idb library type issue
          const allUsers = await store.getAll();
          console.log('Total users in database:', allUsers.length);
          console.log('All usernames:', allUsers.map(u => u.username));
          user = allUsers.find((u) => u.username.trim().toLowerCase() === trimmedUsername);
        }
        
        if (user) {
          console.log('User found via index:', user.username);
        } else {
          console.log('User not found via index');
        }
        
        return user;
      } catch (indexError) {
        console.warn('Index lookup failed, falling back to getAll:', indexError);
      }
    }
    
    // Fallback: get all and find (case-insensitive)
    console.log('Using fallback: getAll and find');
    const allUsers = await store.getAll();
    console.log('Total users in database:', allUsers.length);
    console.log('All usernames:', allUsers.map(u => u.username));
    
    const user = allUsers.find((u) => {
      const userUsername = (u.username || '').trim().toLowerCase();
      return userUsername === trimmedUsername;
    });
    
    if (user) {
      console.log('User found via fallback:', user.username);
    } else {
      console.log('User not found via fallback');
    }
    
    return user;
  } catch (error) {
    console.error('Error getting user by username:', error);
    return undefined;
  }
}

export async function saveUser(user: User): Promise<void> {
  // Ensure user has all required fields
  if (!user.id) {
    throw new Error('User must have an id field');
  }
  
  // Create a clean user object with all required fields
  const userToSave: User = {
    id: user.id,
    username: user.username.toLowerCase(), // Store username as lowercase for consistent lookup
    passwordHash: user.passwordHash,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active !== undefined ? user.active : true,
    employeeId: user.employeeId, // Link to employee record
    mustChangePassword: user.mustChangePassword, // Force password change flag
    createdAt: user.createdAt || new Date().toISOString(),
    lastLoginAt: user.lastLoginAt,
  };

  // ALWAYS save to IndexedDB first to ensure data persistence
  const database = await initDB();
  await database.put('users', userToSave);
  console.log('User saved to IndexedDB:', userToSave.id, 'employeeId:', userToSave.employeeId);

  // Try Supabase if configured (but don't let Supabase errors prevent IndexedDB save)
  try {
    const { isSupabaseConfigured, saveUserToSupabase } = await import('./supabase');
    if (isSupabaseConfigured()) {
      try {
        await saveUserToSupabase(userToSave);
        console.log('User saved to Supabase:', userToSave.id);
      } catch (supabaseError: any) {
        // Log Supabase errors but don't throw - IndexedDB save already succeeded
        console.warn('Failed to save user to Supabase (but saved to IndexedDB):', supabaseError);
        // Check if it's a schema error (column doesn't exist)
        if (supabaseError?.message?.includes('does not exist') || supabaseError?.code === '42703') {
          console.error('Supabase schema error - employee_id column may not exist. Data saved to IndexedDB only.');
        }
        // Don't re-throw - IndexedDB save is sufficient
      }
    }
  } catch (error) {
    // If Supabase import or config check fails, that's fine - IndexedDB save already succeeded
    console.log('Supabase not available, data saved to IndexedDB only:', error);
  }
}

export async function deleteUser(id: string): Promise<void> {
  const user = await getUser(id);
  if (user?.employeeId) {
    await cascadeDeleteForEmployee(user.employeeId);
  }

  try {
    const { isSupabaseConfigured, deleteUserFromSupabase } = await import('./supabase');
    if (isSupabaseConfigured()) {
      await deleteUserFromSupabase(id);
      const database = await initDB();
      await database.delete('users', id);
      return;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }

  const database = await initDB();
  await database.delete('users', id);
}

// Employee profiles (directory / org chart). Never throws: returns [] on any failure.
export async function getEmployeeProfiles(): Promise<EmployeeProfile[]> {
  try {
    const database = await initDB();
    try {
      const { isSupabaseConfigured } = await import('./supabase');
      if (isSupabaseConfigured()) {
        const { getEmployeeProfilesFromSupabase } = await import('./supabase-storage');
        const list = await getEmployeeProfilesFromSupabase();
        if (list.length > 0) {
          if (database.objectStoreNames.contains('employeeProfiles')) {
            const tx = database.transaction('employeeProfiles', 'readwrite');
            const store = tx.objectStore('employeeProfiles');
            await store.clear();
            for (const p of list) await store.put(p);
          }
          return list;
        }
        // Supabase returned empty — do not overwrite IndexedDB; return existing data
        if (database.objectStoreNames.contains('employeeProfiles')) {
          const existing = await database.getAll('employeeProfiles');
          if (existing.length > 0) return existing;
        }
      }
    } catch (e) {
      if (import.meta.env.DEV) console.log('getEmployeeProfiles: Supabase not available, using IndexedDB:', e);
    }
    if (database.objectStoreNames.contains('employeeProfiles')) {
      return await database.getAll('employeeProfiles');
    }
    return [];
  } catch (error) {
    console.error('getEmployeeProfiles failed:', error);
    return [];
  }
}

export async function getEmployeeProfile(employeeId: string): Promise<EmployeeProfile | null> {
  const database = await initDB();
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getEmployeeProfileFromSupabase } = await import('./supabase-storage');
      const p = await getEmployeeProfileFromSupabase(employeeId);
      if (p && database.objectStoreNames.contains('employeeProfiles')) {
        await database.put('employeeProfiles', p);
      }
      return p ?? null;
    }
  } catch (e) {
    if (import.meta.env.DEV) console.log('getEmployeeProfile: Supabase not available, using IndexedDB:', e);
  }
  const p = await database.get('employeeProfiles', employeeId);
  return p ?? null;
}

export async function saveEmployeeProfile(profile: EmployeeProfile): Promise<void> {
  const database = await initDB();
  const toSave = { ...profile, employeeId: profile.employeeId };
  await database.put('employeeProfiles', toSave);
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { saveEmployeeProfileToSupabase } = await import('./supabase-storage');
      await saveEmployeeProfileToSupabase(toSave);
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn('saveEmployeeProfile: Supabase sync failed', e);
  }
  window.dispatchEvent(new CustomEvent('employeeProfileUpdated', { detail: { employeeId: profile.employeeId } }));
}

export async function deleteEmployeeProfile(employeeId: string): Promise<void> {
  const database = await initDB();
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { deleteEmployeeProfileFromSupabase } = await import('./supabase-storage');
      await deleteEmployeeProfileFromSupabase(employeeId);
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn('deleteEmployeeProfile: Supabase sync failed', e);
  }
  await database.delete('employeeProfiles', employeeId);
  window.dispatchEvent(new CustomEvent('employeeProfileUpdated', { detail: { employeeId } }));
}

export async function importData(json: string): Promise<void> {
  const data = JSON.parse(json);
  const database = await initDB();

  if (data.templates) {
    for (const template of data.templates) {
      await database.put('templates', template);
    }
  }
  if (data.employees) {
    for (const employee of data.employees) {
      await database.put('employees', employee);
    }
  }
  if (data.appraisals) {
    for (const appraisal of data.appraisals) {
      await database.put('appraisals', appraisal);
    }
  }
  if (data.links) {
    for (const link of data.links) {
      await database.put('links', link);
    }
  }
  if (data.settings) {
    // Ensure settings have the correct key structure
    const settingsToSave = {
      ...data.settings,
      key: 'company',
    };
    await database.put('settings', settingsToSave as any);
  }
  if (data.reviewPeriods) {
    for (const period of data.reviewPeriods) {
      await database.put('reviewPeriods', period);
    }
  }
  if (data.users) {
    for (const user of data.users) {
      await database.put('users', user);
    }
  }
  if (data.teams) {
    for (const team of data.teams) {
      await database.put('teams', team);
    }
  }
  if (data.employeeProfiles) {
    for (const profile of data.employeeProfiles) {
      if (profile.employeeId) await database.put('employeeProfiles', profile);
    }
  }
}
