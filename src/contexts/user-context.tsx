import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User, Employee } from '@/types';
import { LOCKING_STATUSES } from '@/types';
import { getUser, getEmployee, getTeams } from '@/lib/storage';

interface UserContextType {
  user: User | null;
  employee: Employee | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => void;
  // Helper functions
  isAdmin: () => boolean;
  isExecutive: () => boolean;
  isLeader: () => boolean;
  isMember: () => boolean;
  isHR: () => boolean;
  getTeamIds: () => string[];
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const authenticated = localStorage.getItem('authenticated');
      if (authenticated !== 'true') {
        setUser(null);
        setEmployee(null);
        setLoading(false);
        return;
      }

      const userId = localStorage.getItem('userId');
      if (userId && userId !== 'pin-admin') {
        try {
          const userData = await getUser(userId);
          if (userData) {
            // Account was locked (e.g. employee deleted or terminated) – invalidate session
            if (!userData.active) {
              localStorage.removeItem('authenticated');
              localStorage.removeItem('userId');
              localStorage.removeItem('username');
              localStorage.removeItem('userName');
              localStorage.removeItem('userEmail');
              localStorage.removeItem('userRole');
              localStorage.removeItem('employeeId');
              setUser(null);
              setEmployee(null);
              return;
            }
            setUser(userData);
            // Update localStorage with latest user data
            localStorage.setItem('username', userData.username);
            localStorage.setItem('userName', userData.name);
            localStorage.setItem('userEmail', userData.email || userData.username);
            localStorage.setItem('userRole', userData.role);
            localStorage.setItem('employeeId', userData.employeeId || '');
            
            // Load linked employee if exists
            if (userData.employeeId) {
              const employeeData = await getEmployee(userData.employeeId);
              // If employee was deleted, invalidate session (staff member removed)
              if (!employeeData) {
                localStorage.removeItem('authenticated');
                localStorage.removeItem('userId');
                localStorage.removeItem('username');
                localStorage.removeItem('userName');
                localStorage.removeItem('userEmail');
                localStorage.removeItem('userRole');
                localStorage.removeItem('employeeId');
                setUser(null);
                setEmployee(null);
                return;
              }
              // If employee is terminated or resigned, invalidate session (lock account)
              if (LOCKING_STATUSES.includes(employeeData.employmentStatus ?? 'permanent')) {
                localStorage.removeItem('authenticated');
                localStorage.removeItem('userId');
                localStorage.removeItem('username');
                localStorage.removeItem('userName');
                localStorage.removeItem('userEmail');
                localStorage.removeItem('userRole');
                localStorage.removeItem('employeeId');
                setUser(null);
                setEmployee(null);
                return;
              }
              setEmployee(employeeData);
            } else {
              setEmployee(null);
            }
          } else {
            // User not found in DB – account was deleted or no longer exists. Invalidate session
            // so they cannot stay logged in and are logged out on this and any other device on next load.
            localStorage.removeItem('authenticated');
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            localStorage.removeItem('userName');
            localStorage.removeItem('userEmail');
            localStorage.removeItem('userRole');
            localStorage.removeItem('employeeId');
            setUser(null);
            setEmployee(null);
          }
        } catch (error) {
          console.error('Error loading user from DB:', error);
          // Don't logout on error, use localStorage data
          const username = localStorage.getItem('username') || 'User';
          const userRole = localStorage.getItem('userRole') || 'staff';
          const employeeId = localStorage.getItem('employeeId');
          setUser({
            id: userId || 'temp-user',
            username: localStorage.getItem('username') || 'user',
            passwordHash: '',
            name: localStorage.getItem('userName') || username,
            email: localStorage.getItem('userEmail') || undefined,
            role: userRole as 'admin' | 'staff',
            active: true,
            employeeId: employeeId || undefined,
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        // PIN-based auth or no userId
        setUser({
          id: userId || 'pin-user',
          username: localStorage.getItem('username') || 'admin',
          passwordHash: '',
          name: localStorage.getItem('userName') || 'Administrator',
          email: localStorage.getItem('userEmail') || undefined,
          role: (localStorage.getItem('userRole') || 'admin') as 'admin' | 'staff',
          active: true,
          createdAt: new Date().toISOString(),
        });
        setEmployee(null);
      }
    } catch (error) {
      console.error('Error in refresh:', error);
      // On error, check if authenticated and create temp user
      const authenticated = localStorage.getItem('authenticated');
      if (authenticated === 'true') {
        setUser({
          id: localStorage.getItem('userId') || 'temp-user',
          username: localStorage.getItem('username') || 'user',
          passwordHash: '',
          name: localStorage.getItem('userName') || 'User',
          email: localStorage.getItem('userEmail') || undefined,
          role: (localStorage.getItem('userRole') || 'staff') as 'admin' | 'staff',
          active: true,
          createdAt: new Date().toISOString(),
        });
      } else {
        setUser(null);
        setEmployee(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('authenticated');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    localStorage.removeItem('employeeId');
    setUser(null);
    setEmployee(null);
  };
  
  // Helper functions
  const isAdmin = () => {
    return user?.role === 'admin' || localStorage.getItem('userRole') === 'admin';
  };
  
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
        if (d?.type === 'userDeleted' && d.userId && d.userId === localStorage.getItem('userId')) {
          localStorage.removeItem('authenticated');
          localStorage.removeItem('userId');
          localStorage.removeItem('username');
          localStorage.removeItem('userName');
          localStorage.removeItem('userEmail');
          localStorage.removeItem('userRole');
          localStorage.removeItem('employeeId');
          setUser(null);
          setEmployee(null);
          window.location.href = '/auth';
        }
        if (d?.type === 'employeeTerminatedOrResigned' && d.employeeId && d.employeeId === localStorage.getItem('employeeId')) {
          localStorage.removeItem('authenticated');
          localStorage.removeItem('userId');
          localStorage.removeItem('username');
          localStorage.removeItem('userName');
          localStorage.removeItem('userEmail');
          localStorage.removeItem('userRole');
          localStorage.removeItem('employeeId');
          setUser(null);
          setEmployee(null);
          window.location.href = '/auth';
        }
        if (d?.type === 'employeeDeleted' && d.employeeId && d.employeeId === localStorage.getItem('employeeId')) {
          localStorage.removeItem('authenticated');
          localStorage.removeItem('userId');
          localStorage.removeItem('username');
          localStorage.removeItem('userName');
          localStorage.removeItem('userEmail');
          localStorage.removeItem('userRole');
          localStorage.removeItem('employeeId');
          setUser(null);
          setEmployee(null);
          window.location.href = '/auth';
        }
      };
    } catch {
      // BroadcastChannel not supported (e.g. some old browsers)
    }
    return () => {
      channel?.close();
    };
  }, []);

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
