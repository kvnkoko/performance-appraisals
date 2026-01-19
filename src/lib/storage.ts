import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Template, Employee, Appraisal, AppraisalLink, CompanySettings, PerformanceSummary, ReviewPeriod } from '@/types';

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
}

let db: IDBPDatabase<AppraisalDB> | null = null;

export async function initDB(): Promise<IDBPDatabase<AppraisalDB>> {
  if (db) return db;

  db = await openDB<AppraisalDB>('appraisal-db', 3, {
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
      } else {
        // Add index if it doesn't exist
        try {
          const usersStore = transaction.objectStore('users');
          // @ts-ignore - idb library type issue
          if (!usersStore.indexNames.contains('by-username')) {
            // @ts-ignore - idb library type issue
            usersStore.createIndex('by-username', 'username', { unique: true });
          }
        } catch (e) {
          // Index might already exist, ignore
        }
      }
    },
  });

  // Initialize default settings if not exists
  const settings = await db.get('settings', 'company');
  if (!settings) {
    await db.put('settings', {
      name: 'Your Company',
      adminPin: '1234',
      accentColor: '#3B82F6',
      theme: 'system',
    } as any);
  }

  return db;
}

// Templates
export async function getTemplates(): Promise<Template[]> {
  const database = await initDB();
  return database.getAll('templates');
}

export async function getTemplate(id: string): Promise<Template | undefined> {
  const database = await initDB();
  return database.get('templates', id);
}

export async function saveTemplate(template: Template): Promise<void> {
  const database = await initDB();
  await database.put('templates', template);
}

export async function deleteTemplate(id: string): Promise<void> {
  const database = await initDB();
  await database.delete('templates', id);
}

// Employees
export async function getEmployees(): Promise<Employee[]> {
  const database = await initDB();
  return database.getAll('employees');
}

export async function getEmployee(id: string): Promise<Employee | undefined> {
  const database = await initDB();
  return database.get('employees', id);
}

export async function saveEmployee(employee: Employee): Promise<void> {
  const database = await initDB();
  await database.put('employees', employee);
}

export async function deleteEmployee(id: string): Promise<void> {
  const database = await initDB();
  await database.delete('employees', id);
}

// Appraisals
export async function getAppraisals(): Promise<Appraisal[]> {
  const database = await initDB();
  return database.getAll('appraisals');
}

export async function getAppraisal(id: string): Promise<Appraisal | undefined> {
  const database = await initDB();
  return database.get('appraisals', id);
}

export async function saveAppraisal(appraisal: Appraisal): Promise<void> {
  const database = await initDB();
  await database.put('appraisals', appraisal);
}

export async function deleteAppraisal(id: string): Promise<void> {
  const database = await initDB();
  await database.delete('appraisals', id);
}

// Links
export async function getLinks(): Promise<AppraisalLink[]> {
  const database = await initDB();
  return database.getAll('links');
}

export async function getLinkByToken(token: string): Promise<AppraisalLink | undefined> {
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
  const database = await initDB();
  await database.put('links', link);
}

export async function deleteLink(id: string): Promise<void> {
  const database = await initDB();
  await database.delete('links', id);
}

// Settings
export async function getSettings(): Promise<CompanySettings> {
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
  const database = await initDB();
  await database.put('settings', settings);
}

// Summaries
export async function getSummary(employeeId: string): Promise<PerformanceSummary | undefined> {
  const database = await initDB();
  return database.get('summaries', employeeId);
}

export async function saveSummary(summary: PerformanceSummary): Promise<void> {
  const database = await initDB();
  await database.put('summaries', summary);
}

// Review Periods
export async function getReviewPeriods(): Promise<ReviewPeriod[]> {
  const database = await initDB();
  try {
    if (!database.objectStoreNames.contains('reviewPeriods')) {
      return [];
    }
    return database.getAll('reviewPeriods');
  } catch (error) {
    console.error('Error getting review periods:', error);
    return [];
  }
}

export async function getReviewPeriod(id: string): Promise<ReviewPeriod | undefined> {
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
  const database = await initDB();
  await database.put('reviewPeriods', period);
}

export async function deleteReviewPeriod(id: string): Promise<void> {
  const database = await initDB();
  await database.delete('reviewPeriods', id);
}

// Export/Import
export async function exportData(): Promise<string> {
  const [templates, employees, appraisals, links, settings, reviewPeriods, users] = await Promise.all([
    getTemplates(),
    getEmployees(),
    getAppraisals(),
    getLinks(),
    getSettings(),
    getReviewPeriods(),
    getUsers(),
  ]);

  return JSON.stringify({
    templates,
    employees,
    appraisals,
    links,
    settings,
    reviewPeriods,
    users,
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

// Users
export async function getUsers(): Promise<User[]> {
  const database = await initDB();
  try {
    if (!database.objectStoreNames.contains('users')) {
      return [];
    }
    return database.getAll('users');
  } catch (error) {
    console.error('Error getting users:', error);
    return [];
  }
}

export async function getUser(id: string): Promise<User | undefined> {
  const database = await initDB();
  return database.get('users', id);
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const database = await initDB();
  try {
    if (!database.objectStoreNames.contains('users')) {
      return undefined;
    }
    const tx = database.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    // @ts-ignore - idb library type issue
    if (store.indexNames.contains('by-username')) {
      // @ts-ignore - idb library type issue
      const index = store.index('by-username');
      // @ts-ignore - idb library type issue
      return index.get(username);
    } else {
      // Fallback: get all and find
      const allUsers = await store.getAll();
      return allUsers.find((u) => u.username === username);
    }
  } catch (error) {
    console.error('Error getting user by username:', error);
    return undefined;
  }
}

export async function saveUser(user: User): Promise<void> {
  const database = await initDB();
  await database.put('users', user);
}

export async function deleteUser(id: string): Promise<void> {
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
    await database.put('settings', data.settings);
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
}
