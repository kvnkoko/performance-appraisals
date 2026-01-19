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
      
      const user = await getUserByUsername(username.trim());
      console.log('User found:', user ? 'yes' : 'no');
      
      if (!user) {
        toast({ title: 'Invalid credentials', description: 'Username or password is incorrect.', variant: 'error' });
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
        // Update last login - ensure user has all required fields
        try {
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
          console.log('Last login updated');
        } catch (error) {
          // If saving last login fails, log but don't block login
          console.warn('Failed to update last login time:', error);
        }

        // Store user session
        localStorage.setItem('authenticated', 'true');
        localStorage.setItem('userId', user.id);
        localStorage.setItem('username', user.username);
        localStorage.setItem('userName', user.name);
        localStorage.setItem('userEmail', user.email || user.username);
        localStorage.setItem('userRole', user.role);
        
        console.log('Session stored, navigating to dashboard...');
        toast({ title: 'Welcome!', description: `Successfully logged in as ${user.name}`, variant: 'success' });
        
        // Small delay to ensure toast is shown
        setTimeout(() => {
          navigate('/dashboard');
        }, 100);
      } else {
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
    if (initializing) return;
    
    setLoading(true);

    try {
      await initDB();
      const settings = await getSettings();
      
      if (pin === settings.adminPin) {
        localStorage.setItem('authenticated', 'true');
        localStorage.setItem('userRole', 'admin');
        toast({ title: 'Welcome!', description: 'Successfully authenticated.', variant: 'success' });
        navigate('/dashboard');
      } else {
        toast({ title: 'Invalid PIN', description: 'Please check your PIN and try again.', variant: 'error' });
        setPin('');
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast({ title: 'Error', description: 'Failed to authenticate. Please try again.', variant: 'error' });
    } finally {
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
              <Button type="submit" className="w-full" disabled={loading || !pin || initializing}>
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
              <p className="text-xs text-center text-muted-foreground">
                Default PIN: 1234
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
