import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { User, Employee } from '@/types';
import { LOCKING_STATUSES } from '@/types';
import { getUser, getEmployee, getUserByEmployeeId } from '@/lib/storage';
import { getSupabaseClient, getMyUserFromSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { setReadOnlyMode } from '@/lib/read-only-mode';

export interface ViewAsTarget {
  mode: 'role' | 'employee';
  employeeId: string;
  /** For role mode: the role being previewed (the employee is an example holder of it). */
  role?: Employee['hierarchy'];
}

export interface ViewAsState extends ViewAsTarget {
  user: User;
  employee: Employee;
  /** False when the employee has no (active) login account; the view shows what they would see. */
  hasLogin: boolean;
}

interface UserContextType {
  /** The account the app is acting as: the viewed person while "View as" is on. */
  user: User | null;
  employee: Employee | null;
  /** The person actually signed in. */
  realUser: User | null;
  viewAs: ViewAsState | null;
  startViewAs: (target: ViewAsTarget) => Promise<void>;
  stopViewAs: () => Promise<void>;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  // Helper functions
  isAdmin: () => boolean;
  isExecutive: () => boolean;
  isLeader: () => boolean;
  isMember: () => boolean;
  isHR: () => boolean;
  getTeamIds: () => string[];
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const SESSION_KEYS = ['authenticated', 'userId', 'username', 'userName', 'userEmail', 'userRole', 'employeeId'];

function clearStoredSession() {
  for (const key of SESSION_KEYS) localStorage.removeItem(key);
}

export function storeSession(user: User) {
  localStorage.setItem('authenticated', 'true');
  localStorage.setItem('userId', user.id);
  localStorage.setItem('username', user.username);
  localStorage.setItem('userName', user.name);
  localStorage.setItem('userEmail', user.email || user.username);
  localStorage.setItem('userRole', user.role);
  localStorage.setItem('employeeId', user.employeeId || '');
}

async function signOutOfSupabase() {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = await getSupabaseClient();
    await supabase?.auth.signOut();
  } catch (error) {
    console.warn('Supabase sign-out failed:', error);
  }
}

/** Last known account details, used only while the server cannot be reached. */
function userFromStoredSession(): User {
  const username = localStorage.getItem('username') || 'user';
  return {
    id: localStorage.getItem('userId') || 'temp-user',
    username,
    passwordHash: '',
    name: localStorage.getItem('userName') || username,
    email: localStorage.getItem('userEmail') || undefined,
    role: (localStorage.getItem('userRole') || 'staff') as 'admin' | 'staff',
    active: true,
    employeeId: localStorage.getItem('employeeId') || undefined,
    createdAt: new Date().toISOString(),
  };
}

const VIEW_AS_KEY = 'viewAs';

function readStoredViewAs(): ViewAsTarget | null {
  try {
    const raw = sessionStorage.getItem(VIEW_AS_KEY);
    return raw ? (JSON.parse(raw) as ViewAsTarget) : null;
  } catch {
    return null;
  }
}

async function logViewAs(action: 'start' | 'stop', target: ViewAsTarget) {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = await getSupabaseClient();
    await supabase?.rpc('log_view_as', {
      p_action: action,
      p_employee_id: target.employeeId,
      p_details: { mode: target.mode, role: target.role ?? null },
    });
  } catch (error) {
    console.warn('Could not record View as in the audit log:', error);
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [realUser, setUser] = useState<User | null>(null);
  const [realEmployee, setEmployee] = useState<Employee | null>(null);
  const [viewAs, setViewAs] = useState<ViewAsState | null>(null);
  const [loading, setLoading] = useState(true);
  const user = viewAs?.user ?? realUser;
  const employee = viewAs?.employee ?? realEmployee;

  const clearViewAs = useCallback(() => {
    sessionStorage.removeItem(VIEW_AS_KEY);
    setReadOnlyMode(false);
    setViewAs(null);
  }, []);

  /** Switch the app to another person's view. Read-only mode is on before anything renders as them. */
  const enterViewAs = useCallback(async (target: ViewAsTarget, record: boolean) => {
    const targetEmployee = await getEmployee(target.employeeId);
    if (!targetEmployee) throw new Error('That employee no longer exists.');
    const account = await getUserByEmployeeId(target.employeeId);
    const hasLogin = !!account && account.active !== false;
    const viewedUser: User = account
      ? { ...account, employeeId: targetEmployee.id }
      : {
          id: `view-as-${targetEmployee.id}`,
          username: '(no login account)',
          passwordHash: '',
          name: targetEmployee.name,
          email: targetEmployee.email,
          role: 'staff',
          active: true,
          employeeId: targetEmployee.id,
          createdAt: new Date().toISOString(),
        };
    setReadOnlyMode(true);
    sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify(target));
    setViewAs({ ...target, user: viewedUser, employee: targetEmployee, hasLogin });
    if (record) await logViewAs('start', target);
  }, []);

  const startViewAs = useCallback(
    async (target: ViewAsTarget) => {
      if (realUser?.role !== 'admin') throw new Error('Only administrators can use View as.');
      if (viewAs) await logViewAs('stop', viewAs);
      try {
        await enterViewAs(target, true);
      } catch (error) {
        clearViewAs();
        throw error;
      }
    },
    [realUser, viewAs, enterViewAs, clearViewAs]
  );

  const stopViewAs = useCallback(async () => {
    const current = viewAs;
    clearViewAs();
    if (current) await logViewAs('stop', current);
  }, [viewAs, clearViewAs]);

  const endSession = useCallback(async (signOut: boolean) => {
    clearViewAs();
    clearStoredSession();
    setUser(null);
    setEmployee(null);
    if (signOut) await signOutOfSupabase();
  }, [clearViewAs]);

  /** Load the account and linked employee; returns false when the session must end. */
  const applyAccount = useCallback(
    async (userData: User | undefined): Promise<boolean> => {
      if (!userData || !userData.active) return false;
      let employeeData: Employee | null = null;
      if (userData.employeeId) {
        employeeData = (await getEmployee(userData.employeeId)) ?? null;
        if (!employeeData) return false;
        if (LOCKING_STATUSES.includes(employeeData.employmentStatus ?? 'permanent')) return false;
      }
      storeSession(userData);
      setUser(userData);
      setEmployee(employeeData);

      // "View as" survives a page reload in the same tab, but only for administrators.
      const storedViewAs = readStoredViewAs();
      if (storedViewAs && userData.role === 'admin') {
        await enterViewAs(storedViewAs, false).catch(() => clearViewAs());
      } else if (storedViewAs) {
        clearViewAs();
      }
      return true;
    },
    [enterViewAs, clearViewAs]
  );

  const refresh = useCallback(async () => {
    try {
      if (isSupabaseConfigured()) {
        const supabase = await getSupabaseClient();
        const { data } = supabase ? await supabase.auth.getSession() : { data: null };
        if (!data?.session) {
          // Sessions from before Supabase sign-in, or expired ones, must sign in again.
          await endSession(false);
          return;
        }
        let account: User | undefined;
        try {
          account = await getMyUserFromSupabase();
        } catch (error) {
          console.error('Could not load account; using last known details:', error);
          if (localStorage.getItem('authenticated') === 'true') setUser(userFromStoredSession());
          return;
        }
        if (account?.mustChangePassword) {
          // Signed in but has not set a new password yet; the sign-in page handles this.
          clearStoredSession();
          setUser(null);
          setEmployee(null);
          return;
        }
        if (!(await applyAccount(account))) await endSession(true);
        return;
      }

      if (localStorage.getItem('authenticated') !== 'true') {
        await endSession(false);
        return;
      }
      const userId = localStorage.getItem('userId');
      if (userId && userId !== 'pin-admin') {
        try {
          if (!(await applyAccount(await getUser(userId)))) await endSession(false);
        } catch (error) {
          console.error('Error loading user from DB:', error);
          setUser(userFromStoredSession());
        }
      } else {
        // Local-only PIN sign-in
        setUser({
          ...userFromStoredSession(),
          id: userId || 'pin-user',
          name: localStorage.getItem('userName') || 'Administrator',
          role: 'admin',
          employeeId: undefined,
        });
        setEmployee(null);
      }
    } catch (error) {
      console.error('Error in refresh:', error);
      if (localStorage.getItem('authenticated') === 'true') setUser(userFromStoredSession());
      else await endSession(false);
    } finally {
      setLoading(false);
    }
  }, [applyAccount, endSession]);

  const logout = useCallback(async () => {
    if (viewAs) await logViewAs('stop', viewAs);
    await endSession(true);
  }, [viewAs, endSession]);

  // Helper functions
  const isAdmin = () => user?.role === 'admin';

  const isExecutive = () => {
    return employee?.hierarchy === 'executive';
  };
  
  const isLeader = () => {
    return employee?.hierarchy === 'leader' || employee?.hierarchy === 'department-leader';
  };
  
  const isMember = () => {
    return employee?.hierarchy === 'member';
  };
  
  const isHR = () => {
    return employee?.hierarchy === 'hr';
  };
  
  const getTeamIds = () => {
    if (!employee?.teamId) return [];
    return [employee.teamId];
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Supabase signs the browser out when the session is revoked or the refresh token stops working.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let unsubscribe: (() => void) | undefined;
    getSupabaseClient().then((supabase) => {
      if (!supabase) return;
      const { data } = supabase.auth.onAuthStateChange((event: string) => {
        if (event === 'SIGNED_OUT') {
          clearViewAs();
          clearStoredSession();
          setUser(null);
          setEmployee(null);
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });
    return () => unsubscribe?.();
  }, [clearViewAs]);

  // Re-validate session when user returns to the tab (e.g. from another device we may have deleted the user/employee)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [refresh]);

  // When a user is deleted (e.g. by admin in another tab), broadcast is sent. If this tab
  // is that user, clear session so they are logged out immediately.
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('appraisals-auth');
      channel.onmessage = (e: MessageEvent) => {
        const d = e.data;
        const isMe =
          (d?.type === 'userDeleted' && d.userId && d.userId === localStorage.getItem('userId')) ||
          ((d?.type === 'employeeTerminatedOrResigned' || d?.type === 'employeeDeleted') &&
            d.employeeId &&
            d.employeeId === localStorage.getItem('employeeId'));
        if (isMe) {
          void endSession(true).then(() => {
            window.location.href = '/auth';
          });
        }
      };
    } catch {
      // BroadcastChannel not supported (e.g. some old browsers)
    }
    return () => {
      channel?.close();
    };
  }, [endSession]);

  // When the current user is updated (e.g. admin links user to employee), refresh so this tab gets new user/employeeId.
  useEffect(() => {
    const handleUserUpdated = (e: CustomEvent<{ userId?: string; employeeId?: string }>) => {
      const detail = e.detail;
      if (detail?.userId && detail.userId === localStorage.getItem('userId')) {
        refresh();
      }
    };
    window.addEventListener('userUpdated', handleUserUpdated as EventListener);
    return () => window.removeEventListener('userUpdated', handleUserUpdated as EventListener);
  }, [refresh]);

  return (
    <UserContext.Provider value={{ 
      user, 
      employee,
      realUser,
      viewAs,
      startViewAs,
      stopViewAs,
      loading, 
      refresh, 
      logout,
      isAdmin,
      isExecutive,
      isLeader,
      isMember,
      isHR,
      getTeamIds
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
}
