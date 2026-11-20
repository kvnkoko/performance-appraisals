import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User as UserIcon, Key, Warning, Eye, EyeSlash } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/shared/brand-logo';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSettings, initDB, getUserByUsername, saveUser } from '@/lib/storage';
import { verifyPassword } from '@/lib/utils';
import {
  FunctionCallError,
  callFunction,
  getMyUserFromSupabase,
  getSupabaseClient,
  isSupabaseConfigured,
  recordLogin,
} from '@/lib/supabase';
import { storeSession } from '@/contexts/user-context';
import { useToast } from '@/contexts/toast-context';
import type { User } from '@/types';

type SignInResult =
  | { status: 'ok'; user: User }
  | { status: 'invalid' }
  | { status: 'disabled'; message: string };

/** Check the password on the server and open a Supabase session. */
async function signInWithSupabase(username: string, password: string): Promise<SignInResult> {
  let email: string;
  try {
    ({ email } = await callFunction<{ email: string }>('auth-resolve', { username, password }));
  } catch (error) {
    if (error instanceof FunctionCallError && (error.status === 401 || error.status === 400)) return { status: 'invalid' };
    if (error instanceof FunctionCallError && error.status === 403) return { status: 'disabled', message: error.message };
    throw error;
  }
  const supabase = await getSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.status === 400) return { status: 'invalid' };
    throw error;
  }
  // The database decides whether the account may be used (active, employee has not left).
  const { data: appUserId, error: accessError } = await supabase.rpc('app_user_id');
  if (accessError) throw accessError;
  const user = appUserId ? await getMyUserFromSupabase() : undefined;
  if (!user) {
    await supabase.auth.signOut();
    return { status: 'disabled', message: 'Your account has been disabled. Please contact an administrator.' };
  }
  return { status: 'ok', user };
}

/** Local mode only (no Supabase): compare against the stored hash. */
async function signInLocally(username: string, password: string): Promise<SignInResult> {
  const user = await getUserByUsername(username);
  if (!user) return { status: 'invalid' };
  if (!user.active) return { status: 'disabled', message: 'Your account has been disabled. Please contact an administrator.' };
  if (!(await verifyPassword(password, user.passwordHash))) return { status: 'invalid' };
  return { status: 'ok', user };
}

export function AuthPage() {
  const cloudMode = isSupabaseConfigured();
  const [authMode, setAuthMode] = useState<'pin' | 'user'>('user'); // Default to user mode
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  
  const [showPassword, setShowPassword] = useState(false);
  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
      const updatedUser: User = {
        ...currentUser,
        mustChangePassword: false,
        lastLoginAt: new Date().toISOString(),
      };

      if (cloudMode) {
        const supabase = await getSupabaseClient();
        const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
        if (passwordError) {
          const sameAsOld = /different from the old password/i.test(passwordError.message ?? '');
          toast({
            title: 'Error',
            description: sameAsOld ? 'Please choose a password different from your current one.' : passwordError.message,
            variant: 'error',
          });
          setChangingPassword(false);
          return;
        }
        const { error: flagError } = await supabase.rpc('complete_password_change');
        if (flagError) throw flagError;
      } else {
        await saveUser(updatedUser, { password: newPassword });
      }

      storeSession(updatedUser);
      
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
      const result = cloudMode
        ? await signInWithSupabase(username.trim(), password)
        : await signInLocally(username.trim(), password);

      if (result.status === 'disabled') {
        toast({ title: 'Account disabled', description: result.message, variant: 'error' });
        setPassword('');
        setLoading(false);
        return;
      }

      if (result.status === 'ok') {
        const user = result.user;
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
        
        storeSession(user);

        if (cloudMode) {
          await recordLogin();
        } else {
          await saveUser({ ...user, lastLoginAt: new Date().toISOString() }).catch(() => {});
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
    
    if (cloudMode) return;
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
      <div className="flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto bg-background p-4 pb-10 sm:pb-12">
        <div className="mb-8 flex justify-center">
          <BrandLogo className="max-h-10" />
        </div>
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
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="Enter new password (min 6 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((p) => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeSlash size={18} weight="duotone" /> : <Eye size={18} weight="duotone" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((p) => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeSlash size={18} weight="duotone" /> : <Eye size={18} weight="duotone" />}
                  </button>
                </div>
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
        <footer className="mt-8 flex flex-col items-center gap-2 text-center">
          <BrandLogo className="max-h-6 opacity-80" />
          <p className="text-xs text-muted-foreground">Performance Appraisal</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto bg-background p-4 pb-10 sm:pb-12">
      <div className="mb-8 flex justify-center">
        <BrandLogo className="max-h-10" />
      </div>
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
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !loading && !initializing && username.trim() && password.trim()) {
                        handleUserSubmit(e as any);
                      }
                    }}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeSlash size={18} weight="duotone" /> : <Eye size={18} weight="duotone" />}
                  </button>
                </div>
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
              {!cloudMode && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setAuthMode('pin')}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Use PIN instead
                  </button>
                </div>
              )}
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
      <footer className="mt-8 flex flex-col items-center gap-2 text-center">
        <BrandLogo className="max-h-6 opacity-80" />
        <p className="text-xs text-muted-foreground">Performance Appraisal</p>
      </footer>
    </div>
  );
}
