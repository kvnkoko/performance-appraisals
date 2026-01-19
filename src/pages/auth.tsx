import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User as UserIcon } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSettings, initDB, getUserByUsername } from '@/lib/storage';
import { verifyPassword } from '@/lib/utils';
import { useToast } from '@/contexts/toast-context';
import type { User } from '@/types';

export function AuthPage() {
  const [authMode, setAuthMode] = useState<'pin' | 'user'>('user'); // Default to user mode
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Ensure database is initialized
    initDB()
      .then(() => setInitializing(false))
      .catch((error) => {
        console.error('Failed to initialize database:', error);
        setInitializing(false);
      });
  }, []);

  const handleUserSubmit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (initializing || loading) {
      console.log('Form submission blocked: initializing=', initializing, 'loading=', loading);
      return;
    }
    
    if (!username.trim() || !password.trim()) {
      toast({ title: 'Error', description: 'Please enter both username and password.', variant: 'error' });
      return;
    }
    
    setLoading(true);
    console.log('Starting authentication for user:', username);

    try {
      await initDB();
      console.log('Database initialized');
      
      // Debug: Check if users store exists and list all users
      try {
        const { getUsers } = await import('@/lib/storage');
        const allUsers = await getUsers();
        console.log('Total users in database:', allUsers.length);
        console.log('All users:', allUsers.map(u => ({ username: u.username, name: u.name, active: u.active })));
      } catch (debugError) {
        console.warn('Could not list users for debugging:', debugError);
      }
      
      const user = await getUserByUsername(username.trim());
      console.log('User found:', user ? 'yes' : 'no');
      if (user) {
        console.log('User details:', { username: user.username, name: user.name, active: user.active, role: user.role });
      }
      
      if (!user) {
        toast({ 
          title: 'User not found', 
          description: 'User account not found in this browser. Use PIN login (1234) to access admin, then create users.', 
          variant: 'error' 
        });
        setPassword('');
        setLoading(false);
        return;
      }

      if (!user.active) {
        toast({ title: 'Account disabled', description: 'Your account has been disabled. Please contact an administrator.', variant: 'error' });
        setPassword('');
        setLoading(false);
        return;
      }

      console.log('Verifying password...');
      const isValid = await verifyPassword(password, user.passwordHash);
      console.log('Password valid:', isValid);
      
      if (isValid) {
        // Store user session FIRST (before any async operations)
        localStorage.setItem('authenticated', 'true');
        localStorage.setItem('userId', user.id);
        localStorage.setItem('username', user.username);
        localStorage.setItem('userName', user.name);
        localStorage.setItem('userEmail', user.email || user.username);
        localStorage.setItem('userRole', user.role);
        console.log('Session stored in localStorage');
        
        // Update last login - ensure user has all required fields (non-blocking)
        try {
          const { isSupabaseConfigured, updateUserLastLogin } = await import('@/lib/supabase');
          if (isSupabaseConfigured()) {
            await updateUserLastLogin(user.id);
          } else {
            // Fallback to IndexedDB
            const { saveUser } = await import('@/lib/storage');
            const updatedUser: User = {
              id: user.id,
              username: user.username,
              passwordHash: user.passwordHash,
              name: user.name,
              email: user.email,
              role: user.role,
              active: user.active,
              createdAt: user.createdAt,
              lastLoginAt: new Date().toISOString(),
            };
            await saveUser(updatedUser);
          }
          console.log('Last login updated');
        } catch (error) {
          // If saving last login fails, log but don't block login
          console.warn('Failed to update last login time:', error);
        }

        console.log('Session stored, showing toast and navigating...');
        toast({ title: 'Welcome!', description: `Successfully logged in as ${user.name}`, variant: 'success' });
        
        // Use window.location for more reliable navigation
        setTimeout(() => {
          console.log('Navigating to dashboard via window.location...');
          window.location.href = '/dashboard';
        }, 300);
      } else {
        console.log('Password invalid');
        toast({ title: 'Invalid credentials', description: 'Username or password is incorrect.', variant: 'error' });
        setPassword('');
        setLoading(false);
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to authenticate. Please try again.', 
        variant: 'error' 
      });
      setLoading(false);
    }
  };

  const handlePinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (initializing || loading) {
      console.log('PIN submission blocked: initializing=', initializing, 'loading=', loading);
      return;
    }
    
    if (!pin.trim()) {
      toast({ title: 'Error', description: 'Please enter a PIN.', variant: 'error' });
      return;
    }
    
    setLoading(true);
    console.log('Starting PIN authentication');

    try {
      await initDB();
      console.log('Database initialized for PIN');
      
      const settings = await getSettings();
      console.log('Settings loaded, PIN from settings:', settings.adminPin);
      console.log('Entered PIN (trimmed):', pin.trim());
      console.log('PIN match:', pin.trim() === settings.adminPin);
      
      if (pin.trim() === settings.adminPin) {
        console.log('PIN matches, setting authentication...');
        localStorage.setItem('authenticated', 'true');
        localStorage.setItem('userRole', 'admin');
        localStorage.setItem('userId', 'pin-admin');
        localStorage.setItem('username', 'admin');
        localStorage.setItem('userName', 'Administrator');
        localStorage.setItem('userEmail', 'admin@example.com');
        console.log('Session stored in localStorage');
        
        console.log('Session stored, showing toast and navigating...');
        toast({ title: 'Welcome!', description: 'Successfully authenticated.', variant: 'success' });
        
        // Use window.location for more reliable navigation
        setTimeout(() => {
          console.log('Navigating to dashboard via window.location...');
          window.location.href = '/dashboard';
        }, 300);
      } else {
        console.log('PIN does not match');
        toast({ title: 'Invalid PIN', description: 'Please check your PIN and try again.', variant: 'error' });
        setPin('');
        setLoading(false);
      }
    } catch (error) {
      console.error('PIN Auth error:', error);
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to authenticate. Please try again.', 
        variant: 'error' 
      });
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            {authMode === 'user' ? (
              <UserIcon size={24} weight="duotone" className="text-accent/80" />
            ) : (
              <Lock size={24} weight="duotone" className="text-accent/80" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">
            {authMode === 'user' ? 'Sign In' : 'Admin Access'}
          </CardTitle>
          <CardDescription>
            {authMode === 'user' 
              ? 'Enter your username and password to access the dashboard'
              : 'Enter your PIN to access the admin dashboard'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {authMode === 'user' && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                <strong>Note:</strong> User accounts are stored locally in your browser. If this is a new browser or you've cleared cache, use PIN login first, then create users.
              </p>
            </div>
          )}
          {authMode === 'user' ? (
            <form onSubmit={handleUserSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !loading && !initializing && username.trim() && password.trim()) {
                      handleUserSubmit(e as any);
                    }
                  }}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !username.trim() || !password.trim() || initializing}
                onClick={(e) => {
                  e.preventDefault();
                  if (!loading && !initializing && username.trim() && password.trim()) {
                    handleUserSubmit(e as any);
                  }
                }}
              >
                {initializing ? 'Initializing...' : loading ? 'Signing in...' : 'Sign In'}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setAuthMode('pin')}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Use PIN instead
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin">PIN</Label>
                <Input
                  id="pin"
                  type="password"
                  placeholder="Enter your PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoFocus
                  maxLength={10}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !pin.trim() || initializing}
                onClick={(e) => {
                  e.preventDefault();
                  if (!loading && !initializing && pin.trim()) {
                    handlePinSubmit(e as any);
                  }
                }}
              >
                {initializing ? 'Initializing...' : loading ? 'Authenticating...' : 'Access Dashboard'}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setAuthMode('user')}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Use username/password instead
                </button>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-center text-muted-foreground">
                  Default PIN: <strong>1234</strong>
                </p>
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-blue-600 dark:text-blue-400 text-center">
                    <strong>Admin Access:</strong> PIN login works in any browser. After logging in, create user accounts in the Users page.
                  </p>
                </div>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
