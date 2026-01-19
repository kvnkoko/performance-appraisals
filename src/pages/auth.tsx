import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSettings, initDB } from '@/lib/storage';
import { useToast } from '@/contexts/toast-context';

export function AuthPage() {
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (initializing) return;
    
    setLoading(true);

    try {
      // Ensure DB is initialized
      await initDB();
      const settings = await getSettings();
      
      if (pin === settings.adminPin) {
        localStorage.setItem('authenticated', 'true');
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
            <Lock size={24} weight="duotone" className="text-accent/80" />
          </div>
          <CardTitle className="text-2xl font-bold">Admin Access</CardTitle>
          <CardDescription>Enter your PIN to access the admin dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <p className="text-xs text-center text-muted-foreground">
              Default PIN: 1234
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
