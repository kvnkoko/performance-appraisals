import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Template, Employee, Appraisal, AppraisalLink, CompanySettings, PerformanceSummary, ReviewPeriod, User, Team } from '@/types';

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
}

let db: IDBPDatabase<AppraisalDB> | null = null;

export async function initDB(): Promise<IDBPDatabase<AppraisalDB>> {
  if (db) return db;

  db = await openDB<AppraisalDB>('appraisal-db', 4, {
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

// Templates - Hybrid: Supabase (if configured) or IndexedDB (fallback)
export async function getTemplates(): Promise<Template[]> {
  const database = await initDB();
  let indexedDBTemplates: Template[] = [];
  
  // Always get templates from IndexedDB as backup/cache
  try {
    if (database.objectStoreNames.contains('templates')) {
      indexedDBTemplates = await database.getAll('templates');
      console.log('getTemplates: Found', indexedDBTemplates.length, 'templates in IndexedDB');
    }
  } catch (error) {
    console.error('Error getting templates from IndexedDB:', error);
  }
  
  // Try Supabase first if configured
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getTemplatesFromSupabase } = await import('./supabase-storage');
      const supabaseTemplates = await getTemplatesFromSupabase();
      console.log('getTemplates: Found', supabaseTemplates.length, 'templates in Supabase');
      
      // Merge Supabase and IndexedDB templates, prioritizing Supabase
      const templatesMap = new Map<string, Template>();
      
      // Add IndexedDB templates first (as backup)
      for (const template of indexedDBTemplates) {
        templatesMap.set(template.id, template);
      }
      
      // Add/override with Supabase templates (as source of truth)
      for (const template of supabaseTemplates) {
        templatesMap.set(template.id, template);
      }
      
      const mergedTemplates = Array.from(templatesMap.values());
      console.log('getTemplates: Returning', mergedTemplates.length, 'merged templates');
      return mergedTemplates;
    }
  } catch (error) {
    console.log('Supabase not available or error occurred, using IndexedDB fallback:', error);
  }

  // Fallback to IndexedDB only
  return indexedDBTemplates;
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
  // Try Supabase first if configured
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { saveTemplateToSupabase } = await import('./supabase-storage');
      try {
        await saveTemplateToSupabase(template);
        console.log('Template saved to Supabase:', template.id);
      } catch (supabaseError) {
        console.error('Error saving template to Supabase:', supabaseError);
        // Continue to IndexedDB fallback even if Supabase fails
      }
      // Also save to IndexedDB as backup/cache
      const database = await initDB();
      await database.put('templates', template);
      return;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback:', error);
  }

  // Fallback to IndexedDB
  const database = await initDB();
  await database.put('templates', template);
  console.log('Template saved to IndexedDB:', template.id);
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

// Employees - Hybrid: Supabase (if configured) or IndexedDB (fallback)
export async function getEmployees(): Promise<Employee[]> {
  const database = await initDB();
  let indexedDBEmployees: Employee[] = [];
  
  // Always get employees from IndexedDB as backup/cache
  try {
    if (database.objectStoreNames.contains('employees')) {
      indexedDBEmployees = await database.getAll('employees');
      console.log('getEmployees: Found', indexedDBEmployees.length, 'employees in IndexedDB');
    }
  } catch (error) {
    console.error('Error getting employees from IndexedDB:', error);
  }
  
  // Try Supabase first if configured
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getEmployeesFromSupabase } = await import('./supabase-storage');
      const supabaseEmployees = await getEmployeesFromSupabase();
      console.log('getEmployees: Found', supabaseEmployees.length, 'employees in Supabase');
      
      // Merge Supabase and IndexedDB employees, prioritizing Supabase
      // Create a map of employees by ID to avoid duplicates
      const employeesMap = new Map<string, Employee>();
      
      // Add IndexedDB employees first (as backup)
      for (const employee of indexedDBEmployees) {
        employeesMap.set(employee.id, employee);
      }
      
      // Add/override with Supabase employees (as source of truth)
      for (const employee of supabaseEmployees) {
        employeesMap.set(employee.id, employee);
      }
      
      const mergedEmployees = Array.from(employeesMap.values());
      console.log('getEmployees: Returning', mergedEmployees.length, 'merged employees');
      return mergedEmployees;
    }
  } catch (error) {
    console.log('Supabase not available or error occurred, using IndexedDB fallback:', error);
  }

  // Fallback to IndexedDB only
  return indexedDBEmployees;
}

export async function getEmployee(id: string): Promise<Employee | undefined> {
  // Try Supabase first if configured
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getEmployeeFromSupabase } = await import('./supabase-storage');
      return await getEmployeeFromSupabase(id);
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }

  // Fallback to IndexedDB
  const database = await initDB();
  return database.get('employees', id);
}

export async function saveEmployee(employee: Employee): Promise<void> {
  // Try Supabase first if configured
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { saveEmployeeToSupabase } = await import('./supabase-storage');
      await saveEmployeeToSupabase(employee);
      // Also save to IndexedDB as backup/cache
      const database = await initDB();
      await database.put('employees', employee);
      return;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }

  // Fallback to IndexedDB
  const database = await initDB();
  await database.put('employees', employee);
}

export async function deleteEmployee(id: string): Promise<void> {
  // Try Supabase first if configured
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { deleteEmployeeFromSupabase } = await import('./supabase-storage');
      await deleteEmployeeFromSupabase(id);
      // Also delete from IndexedDB
      const database = await initDB();
      await database.delete('employees', id);
      return;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }

  // Fallback to IndexedDB
  const database = await initDB();
  await database.delete('employees', id);
}

// Appraisals - Hybrid: Supabase (if configured) or IndexedDB (fallback)
export async function getAppraisals(): Promise<Appraisal[]> {
  const database = await initDB();
  let indexedDBAppraisals: Appraisal[] = [];
  
  // Always get appraisals from IndexedDB as backup/cache
  try {
    if (database.objectStoreNames.contains('appraisals')) {
      indexedDBAppraisals = await database.getAll('appraisals');
      console.log('getAppraisals: Found', indexedDBAppraisals.length, 'appraisals in IndexedDB');
    }
  } catch (error) {
    console.error('Error getting appraisals from IndexedDB:', error);
  }
  
  // Try Supabase first if configured
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getAppraisalsFromSupabase } = await import('./supabase-storage');
      const supabaseAppraisals = await getAppraisalsFromSupabase();
      console.log('getAppraisals: Found', supabaseAppraisals.length, 'appraisals in Supabase');
      
      // Merge Supabase and IndexedDB appraisals, prioritizing Supabase
      const appraisalsMap = new Map<string, Appraisal>();
      
      // Add IndexedDB appraisals first (as backup)
      for (const appraisal of indexedDBAppraisals) {
        appraisalsMap.set(appraisal.id, appraisal);
      }
      
      // Add/override with Supabase appraisals (as source of truth)
      for (const appraisal of supabaseAppraisals) {
        appraisalsMap.set(appraisal.id, appraisal);
      }
      
      const mergedAppraisals = Array.from(appraisalsMap.values());
      console.log('getAppraisals: Returning', mergedAppraisals.length, 'merged appraisals');
      return mergedAppraisals;
    }
  } catch (error) {
    console.log('Supabase not available or error occurred, using IndexedDB fallback:', error);
  }

  // Fallback to IndexedDB only
  return indexedDBAppraisals;
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
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { saveAppraisalToSupabase } = await import('./supabase-storage');
      await saveAppraisalToSupabase(appraisal);
      const database = await initDB();
      await database.put('appraisals', appraisal);
      return;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }
  const database = await initDB();
  await database.put('appraisals', appraisal);
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

// Links - Hybrid: Supabase (if configured) or IndexedDB (fallback)
export async function getLinks(): Promise<AppraisalLink[]> {
  const database = await initDB();
  let indexedDBLinks: AppraisalLink[] = [];
  
  // Always get links from IndexedDB as backup/cache
  try {
    if (database.objectStoreNames.contains('links')) {
      indexedDBLinks = await database.getAll('links');
      console.log('getLinks: Found', indexedDBLinks.length, 'links in IndexedDB');
    }
  } catch (error) {
    console.error('Error getting links from IndexedDB:', error);
  }
  
  // Try Supabase first if configured
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getLinksFromSupabase } = await import('./supabase-storage');
      const supabaseLinks = await getLinksFromSupabase();
      console.log('getLinks: Found', supabaseLinks.length, 'links in Supabase');
      
      // Merge Supabase and IndexedDB links, prioritizing Supabase
      const linksMap = new Map<string, AppraisalLink>();
      
      // Add IndexedDB links first (as backup)
      for (const link of indexedDBLinks) {
        linksMap.set(link.id, link);
      }
      
      // Add/override with Supabase links (as source of truth)
      for (const link of supabaseLinks) {
        linksMap.set(link.id, link);
      }
      
      const mergedLinks = Array.from(linksMap.values());
      console.log('getLinks: Returning', mergedLinks.length, 'merged links');
      return mergedLinks;
    }
  } catch (error) {
    console.log('Supabase not available or error occurred, using IndexedDB fallback:', error);
  }

  // Fallback to IndexedDB only
  return indexedDBLinks;
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
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { saveLinkToSupabase } = await import('./supabase-storage');
      await saveLinkToSupabase(link);
      const database = await initDB();
      await database.put('links', link);
      return;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }
  const database = await initDB();
  await database.put('links', link);
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

// Settings - Hybrid: Supabase (if configured) or IndexedDB (fallback)
export async function getSettings(): Promise<CompanySettings> {
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getSettingsFromSupabase } = await import('./supabase-storage');
      const settings = await getSettingsFromSupabase();
      if (settings) return settings;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }
  const database = await initDB();
  const settings = await database.get('settings', 'company');
  return settings || {
    name: 'Your Company',
    adminPin: '1234',
    accentColor: '#3B82F6',
    theme: 'system',
  } as CompanySettings;
}

export async function saveSettings(settings: CompanySettings): Promise<void> {
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { saveSettingsToSupabase } = await import('./supabase-storage');
      await saveSettingsToSupabase(settings);
      const database = await initDB();
      await database.put('settings', { ...settings, key: 'company' } as any);
      return;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }
  const database = await initDB();
  await database.put('settings', { ...settings, key: 'company' } as any);
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

// Review Periods - Hybrid: Supabase (if configured) or IndexedDB (fallback)
export async function getReviewPeriods(): Promise<ReviewPeriod[]> {
  const database = await initDB();
  let indexedDBPeriods: ReviewPeriod[] = [];
  
  // Always get periods from IndexedDB as backup/cache
  try {
    if (database.objectStoreNames.contains('reviewPeriods')) {
      indexedDBPeriods = await database.getAll('reviewPeriods');
      console.log('getReviewPeriods: Found', indexedDBPeriods.length, 'periods in IndexedDB');
    }
  } catch (error) {
    console.error('Error getting review periods from IndexedDB:', error);
  }
  
  // Try Supabase first if configured
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getReviewPeriodsFromSupabase } = await import('./supabase-storage');
      const supabasePeriods = await getReviewPeriodsFromSupabase();
      console.log('getReviewPeriods: Found', supabasePeriods.length, 'periods in Supabase');
      
      // Merge Supabase and IndexedDB periods, prioritizing Supabase
      const periodsMap = new Map<string, ReviewPeriod>();
      
      // Add IndexedDB periods first (as backup)
      for (const period of indexedDBPeriods) {
        periodsMap.set(period.id, period);
      }
      
      // Add/override with Supabase periods (as source of truth)
      for (const period of supabasePeriods) {
        periodsMap.set(period.id, period);
      }
      
      const mergedPeriods = Array.from(periodsMap.values());
      console.log('getReviewPeriods: Returning', mergedPeriods.length, 'merged periods');
      return mergedPeriods;
    }
  } catch (error) {
    console.log('Supabase not available or error occurred, using IndexedDB fallback:', error);
  }

  // Fallback to IndexedDB only
  return indexedDBPeriods;
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
  const database = await initDB();
  try {
    // Check if the object store exists
    if (!database.objectStoreNames.contains('reviewPeriods')) {
      return [];
    }
    const tx = database.transaction('reviewPeriods', 'readonly');
    const store = tx.objectStore('reviewPeriods');
    
    // Check if the index exists, otherwise filter manually
    // @ts-ignore - idb library type issue
    if (store.indexNames.contains('status')) {
      // @ts-ignore - idb library type issue
      // @ts-ignore - idb library type issue
      const index = store.index('status');
      // @ts-ignore - idb library type issue
      return index.getAll('active');
    } else {
      // Fallback: get all and filter
      const allPeriods = await store.getAll();
      return allPeriods.filter((p) => p.status === 'active');
    }
  } catch (error) {
    console.error('Error getting active review periods:', error);
    return [];
  }
}

export async function saveReviewPeriod(period: ReviewPeriod): Promise<void> {
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { saveReviewPeriodToSupabase } = await import('./supabase-storage');
      await saveReviewPeriodToSupabase(period);
      const database = await initDB();
      await database.put('reviewPeriods', period);
      return;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }
  const database = await initDB();
  await database.put('reviewPeriods', period);
}

export async function deleteReviewPeriod(id: string): Promise<void> {
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { deleteReviewPeriodFromSupabase } = await import('./supabase-storage');
      await deleteReviewPeriodFromSupabase(id);
      const database = await initDB();
      await database.delete('reviewPeriods', id);
      return;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }
  const database = await initDB();
  await database.delete('reviewPeriods', id);
}

// Teams - Hybrid: Supabase (if configured) or IndexedDB (fallback)
export async function getTeams(): Promise<Team[]> {
  const database = await initDB();
  let indexedDBTeams: Team[] = [];
  
  // Always get teams from IndexedDB as backup/cache
  try {
    if (database.objectStoreNames.contains('teams')) {
      indexedDBTeams = await database.getAll('teams');
      console.log('getTeams: Found', indexedDBTeams.length, 'teams in IndexedDB');
    }
  } catch (error) {
    console.error('Error getting teams from IndexedDB:', error);
  }
  
  // Try Supabase first if configured
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getTeamsFromSupabase } = await import('./supabase-storage');
      const supabaseTeams = await getTeamsFromSupabase();
      console.log('getTeams: Found', supabaseTeams.length, 'teams in Supabase');
      
      // Merge Supabase and IndexedDB teams, prioritizing Supabase
      // Create a map of teams by ID to avoid duplicates
      const teamsMap = new Map<string, Team>();
      
      // Add IndexedDB teams first (as backup)
      for (const team of indexedDBTeams) {
        teamsMap.set(team.id, team);
      }
      
      // Add/override with Supabase teams (as source of truth)
      for (const team of supabaseTeams) {
        teamsMap.set(team.id, team);
      }
      
      const mergedTeams = Array.from(teamsMap.values());
      console.log('getTeams: Returning', mergedTeams.length, 'merged teams');
      return mergedTeams;
    }
  } catch (error) {
    console.log('Supabase not available or error occurred, using IndexedDB fallback:', error);
  }

  // Fallback to IndexedDB only
  return indexedDBTeams;
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
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { saveTeamToSupabase } = await import('./supabase-storage');
      await saveTeamToSupabase(team);
      const database = await initDB();
      await database.put('teams', team);
      return;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }
  const database = await initDB();
  await database.put('teams', team);
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

// Get user by employee ID
export async function getUserByEmployeeId(employeeId: string): Promise<User | undefined> {
  const database = await initDB();
  let indexedDBUser: User | undefined;
  
  // Always check IndexedDB as backup/cache
  try {
    if (database.objectStoreNames.contains('users')) {
      const allUsers = await database.getAll('users');
      indexedDBUser = allUsers.find((u) => u.employeeId === employeeId);
      if (indexedDBUser) {
        console.log('getUserByEmployeeId: Found user in IndexedDB:', indexedDBUser.id);
      }
    }
  } catch (error) {
    console.error('Error getting user from IndexedDB:', error);
  }
  
  // Try Supabase first if configured
  try {
    const { isSupabaseConfigured } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const { getUserByEmployeeIdFromSupabase } = await import('./supabase-storage');
      const supabaseUser = await getUserByEmployeeIdFromSupabase(employeeId);
      
      if (supabaseUser) {
        console.log('getUserByEmployeeId: Found user in Supabase:', supabaseUser.id);
        // Supabase is source of truth, return it
        return supabaseUser;
      }
    }
  } catch (error) {
    console.log('Supabase not available or error occurred, using IndexedDB fallback:', error);
  }

  // Fallback to IndexedDB
  return indexedDBUser;
}

// Export/Import
export async function exportData(): Promise<string> {
  const [templates, employees, appraisals, links, settings, reviewPeriods, users, teams] = await Promise.all([
    getTemplates(),
    getEmployees(),
    getAppraisals(),
    getLinks(),
    getSettings(),
    getReviewPeriods(),
    getUsers(),
    getTeams(),
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
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

// Users - Hybrid: Supabase (if configured) or IndexedDB (fallback)
export async function getUsers(): Promise<User[]> {
  const database = await initDB();
  let indexedDBUsers: User[] = [];
  
  // Always get users from IndexedDB as backup/cache
  try {
    if (database.objectStoreNames.contains('users')) {
      indexedDBUsers = await database.getAll('users');
      console.log('getUsers: Found', indexedDBUsers.length, 'users in IndexedDB');
    }
  } catch (error) {
    console.error('Error getting users from IndexedDB:', error);
  }
  
  // Try Supabase first if configured
  try {
    const { isSupabaseConfigured, getUsersFromSupabase } = await import('./supabase');
    if (isSupabaseConfigured()) {
      const supabaseUsers = await getUsersFromSupabase();
      console.log('getUsers: Found', supabaseUsers.length, 'users in Supabase');
      
      // Merge Supabase and IndexedDB users, prioritizing Supabase
      // Create a map of users by ID to avoid duplicates
      const usersMap = new Map<string, User>();
      
      // Add IndexedDB users first (as backup)
      for (const user of indexedDBUsers) {
        usersMap.set(user.id, user);
      }
      
      // Add/override with Supabase users (as source of truth)
      for (const user of supabaseUsers) {
        usersMap.set(user.id, user);
      }
      
      const mergedUsers = Array.from(usersMap.values());
      console.log('getUsers: Returning', mergedUsers.length, 'merged users');
      return mergedUsers;
    }
  } catch (error) {
    console.log('Supabase not available or error occurred, using IndexedDB fallback:', error);
  }

  // Fallback to IndexedDB only
  return indexedDBUsers;
}

export async function getUser(id: string): Promise<User | undefined> {
  const database = await initDB();
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

  // Try Supabase first if configured
  try {
    const { isSupabaseConfigured, saveUserToSupabase } = await import('./supabase');
    if (isSupabaseConfigured()) {
      await saveUserToSupabase(userToSave);
      // Also save to IndexedDB as backup/cache
      const database = await initDB();
      await database.put('users', userToSave);
      return;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }

  // Fallback to IndexedDB
  const database = await initDB();
  await database.put('users', userToSave);
}

export async function deleteUser(id: string): Promise<void> {
  // Try Supabase first if configured
  try {
    const { isSupabaseConfigured, deleteUserFromSupabase } = await import('./supabase');
    if (isSupabaseConfigured()) {
      await deleteUserFromSupabase(id);
      // Also delete from IndexedDB
      const database = await initDB();
      await database.delete('users', id);
      return;
    }
  } catch (error) {
    console.log('Supabase not available, using IndexedDB fallback');
  }

  // Fallback to IndexedDB
  const database = await initDB();
  await database.delete('users', id);
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
}
