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
      const userId = localStorage.getItem('userId');
      if (userId) {
        const userData = await getUser(userId);
        if (userData) {
          setUser(userData);
          // Update localStorage with latest user data
          localStorage.setItem('username', userData.username);
          localStorage.setItem('userName', userData.name);
          localStorage.setItem('userEmail', userData.email || userData.username);
          localStorage.setItem('userRole', userData.role);
        } else {
          // User not found, clear session
          logout();
        }
      } else {
        // Check if using PIN auth (legacy)
        const authenticated = localStorage.getItem('authenticated');
        if (authenticated === 'true') {
          // PIN-based auth, create a temporary user object
          setUser({
            id: 'pin-user',
            username: 'admin',
            passwordHash: '',
            name: 'Administrator',
            role: 'admin',
            active: true,
            createdAt: new Date().toISOString(),
          });
        } else {
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
      setUser(null);
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
