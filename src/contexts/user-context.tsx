import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { User, Employee } from '@/types';
import { LOCKING_STATUSES } from '@/types';
import { getUser, getEmployee } from '@/lib/storage';
import { getSupabaseClient, getMyUserFromSupabase, isSupabaseConfigured } from '@/lib/supabase';

interface UserContextType {
  user: User | null;
  employee: Employee | null;
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

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  const endSession = useCallback(async (signOut: boolean) => {
    clearStoredSession();
    setUser(null);
    setEmployee(null);
    if (signOut) await signOutOfSupabase();
  }, []);

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
      return true;
    },
    []
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

  const logout = useCallback(() => endSession(true), [endSession]);

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
          clearStoredSession();
          setUser(null);
          setEmployee(null);
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });
    return () => unsubscribe?.();
  }, []);

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
