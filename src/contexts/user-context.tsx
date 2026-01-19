import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '@/types';
import { getUser } from '@/lib/storage';

interface UserContextType {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const authenticated = localStorage.getItem('authenticated');
      if (authenticated !== 'true') {
        setUser(null);
        setLoading(false);
        return;
      }

      const userId = localStorage.getItem('userId');
      if (userId && userId !== 'pin-admin') {
        try {
          const userData = await getUser(userId);
          if (userData) {
            setUser(userData);
            // Update localStorage with latest user data
            localStorage.setItem('username', userData.username);
            localStorage.setItem('userName', userData.name);
            localStorage.setItem('userEmail', userData.email || userData.username);
            localStorage.setItem('userRole', userData.role);
          } else {
            // User not found in DB but authenticated - might be a new user or DB issue
            // Don't logout, just set a temporary user object
            const username = localStorage.getItem('username') || 'User';
            const userRole = localStorage.getItem('userRole') || 'staff';
            setUser({
              id: userId,
              username: localStorage.getItem('username') || 'user',
              passwordHash: '',
              name: localStorage.getItem('userName') || username,
              email: localStorage.getItem('userEmail') || undefined,
              role: userRole as 'admin' | 'staff',
              active: true,
              createdAt: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error('Error loading user from DB:', error);
          // Don't logout on error, use localStorage data
          const username = localStorage.getItem('username') || 'User';
          const userRole = localStorage.getItem('userRole') || 'staff';
          setUser({
            id: userId || 'temp-user',
            username: localStorage.getItem('username') || 'user',
            passwordHash: '',
            name: localStorage.getItem('userName') || username,
            email: localStorage.getItem('userEmail') || undefined,
            role: userRole as 'admin' | 'staff',
            active: true,
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
    setUser(null);
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, refresh, logout }}>
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
