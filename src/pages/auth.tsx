import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User as UserIcon, Key, Warning } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSettings, initDB, getUserByUsername, saveUser } from '@/lib/storage';
import { verifyPassword, hashPassword } from '@/lib/utils';
import { useToast } from '@/contexts/toast-context';
import type { User } from '@/types';

export function AuthPage() {
  const [authMode, setAuthMode] = useState<'pin' | 'user'>('user'); // Default to user mode
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  
  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  
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

  // Handle password change
  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) return;
    
    if (newPassword.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters.', variant: 'error' });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match.', variant: 'error' });
      return;
    }
    
    setChangingPassword(true);
    
    try {
      const passwordHash = await hashPassword(newPassword);
      
      const updatedUser: User = {
        ...currentUser,
        passwordHash,
        mustChangePassword: false,
        lastLoginAt: new Date().toISOString(),
      };
      
      await saveUser(updatedUser);
      
      // Store user session
      localStorage.setItem('authenticated', 'true');
      localStorage.setItem('userId', updatedUser.id);
      localStorage.setItem('username', updatedUser.username);
      localStorage.setItem('userName', updatedUser.name);
      localStorage.setItem('userEmail', updatedUser.email || updatedUser.username);
      localStorage.setItem('userRole', updatedUser.role);
      localStorage.setItem('employeeId', updatedUser.employeeId || '');
      
      toast({ title: 'Password Changed', description: 'Your password has been updated successfully.', variant: 'success' });
      
      // Redirect based on user role
      const redirectUrl = updatedUser.role === 'admin' ? '/dashboard' : '/my-dashboard';
      
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 300);
    } catch (error) {
      console.error('Password change error:', error);
      toast({ title: 'Error', description: 'Failed to change password. Please try again.', variant: 'error' });
      setChangingPassword(false);
    }
  };

  const handleUserSubmit = async (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (initializing || loading) return;
    
    if (!username.trim() || !password.trim()) {
      toast({ title: 'Error', description: 'Please enter both username and password.', variant: 'error' });
      return;
    }
    
    setLoading(true);

    try {
      await initDB();
      const user = await getUserByUsername(username.trim());
      
      if (!user) {
        toast({ 
          title: 'Invalid credentials', 
          description: 'Username or password is incorrect.', 
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
        // Check if user must change password
        if (user.mustChangePassword) {
          setCurrentUser(user);
          setShowPasswordChange(true);
          setLoading(false);
          toast({ 
            title: 'Password Change Required', 
            description: 'You must change your password before continuing.', 
            variant: 'default' 
          });
          return;
        }
        
        // Store user session FIRST (before any async operations)
        localStorage.setItem('authenticated', 'true');
        localStorage.setItem('userId', user.id);
        localStorage.setItem('username', user.username);
        localStorage.setItem('userName', user.name);
        localStorage.setItem('userEmail', user.email || user.username);
        localStorage.setItem('userRole', user.role);
        localStorage.setItem('employeeId', user.employeeId || '');
        
        // Update last login - ensure user has all required fields (non-blocking)
        try {
          const { isSupabaseConfigured, updateUserLastLogin } = await import('@/lib/supabase');
          if (isSupabaseConfigured()) {
            await updateUserLastLogin(user.id);
          } else {
            // Fallback to IndexedDB
            const updatedUser: User = {
              id: user.id,
              username: user.username,
              passwordHash: user.passwordHash,
              name: user.name,
              email: user.email,
              role: user.role,
              active: user.active,
              employeeId: user.employeeId,
              mustChangePassword: user.mustChangePassword,
              createdAt: user.createdAt,
              lastLoginAt: new Date().toISOString(),
            };
            await saveUser(updatedUser);
          }
        } catch {
          // If saving last login fails, don't block login
        }

        toast({ title: 'Welcome!', description: `Successfully logged in as ${user.name}`, variant: 'success' });
        const redirectUrl = user.role === 'admin' ? '/dashboard' : '/my-dashboard';
        setTimeout(() => { window.location.href = redirectUrl; }, 300);
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
    e.stopPropagation();
    
    if (initializing || loading) return;
    
    if (!pin.trim()) {
      toast({ title: 'Error', description: 'Please enter a PIN.', variant: 'error' });
      return;
    }
    
    setLoading(true);

    try {
      await initDB();
      const settings = await getSettings();
      
      if (pin.trim() === settings.adminPin) {
        localStorage.setItem('authenticated', 'true');
        localStorage.setItem('userRole', 'admin');
        localStorage.setItem('userId', 'pin-admin');
        localStorage.setItem('username', 'admin');
        localStorage.setItem('userName', 'Administrator');
        localStorage.setItem('userEmail', 'admin@example.com');
        toast({ title: 'Welcome!', description: 'Successfully authenticated.', variant: 'success' });
        setTimeout(() => { window.location.href = '/dashboard'; }, 300);
      } else {
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

  // Password change screen
  if (showPasswordChange && currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border/50 shadow-dropdown">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-chart-4/12">
              <Key size={24} weight="duotone" className="text-chart-4" />
            </div>
            <CardTitle className="page-title text-center">Change Your Password</CardTitle>
            <CardDescription>
              For security, you must set a new password before continuing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <Warning size={20} weight="duotone" className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Welcome, <strong>{currentUser.name}</strong>! This is your first login. Please create a secure password.
              </p>
            </div>
            
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Enter new password (min 6 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={changingPassword || newPassword.length < 6 || newPassword !== confirmPassword}
              >
                {changingPassword ? 'Changing Password...' : 'Set New Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 shadow-dropdown">
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
              <p className="text-xs text-center text-muted-foreground">
                Default PIN: <strong>1234</strong>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
