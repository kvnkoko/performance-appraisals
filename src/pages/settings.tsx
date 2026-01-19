import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Moon, Sun, Monitor, SignOut } from 'phosphor-react';
import { saveSettings, exportData, importData } from '@/lib/storage';
import { useToast } from '@/contexts/toast-context';
import { useTheme } from '@/hooks/use-theme';

export function SettingsPage() {
  const { settings, refresh } = useApp();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: settings.name,
    adminPin: settings.adminPin,
    accentColor: settings.accentColor,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFormData({
      name: settings.name,
      adminPin: settings.adminPin,
      accentColor: settings.accentColor,
    });
  }, [settings]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await saveSettings({
        ...settings,
        ...formData,
        theme: settings.theme,
      });
      await refresh();
      toast({ title: 'Settings saved', variant: 'success' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save settings.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `appraisal-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: 'Export successful', description: 'Data exported to JSON file.', variant: 'success' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to export data.', variant: 'error' });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Importing data will replace all existing data. Are you sure?')) {
      return;
    }

    try {
      const text = await file.text();
      await importData(text);
      await refresh();
      toast({ title: 'Import successful', description: 'Data imported successfully.', variant: 'success' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to import data. Please check the file format.', variant: 'error' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authenticated');
    window.location.href = '/auth';
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your application settings</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
            <CardDescription>Update your company details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Company Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <Button type="button" onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Manage admin access</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin">Admin PIN</Label>
              <Input
                id="pin"
                type="password"
                value={formData.adminPin}
                onChange={(e) => setFormData({ ...formData, adminPin: e.target.value })}
                placeholder="Enter new PIN"
              />
            </div>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Update PIN'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Customize the look and feel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant={theme === 'light' ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setTheme('light')}
                >
                  <Sun size={18} weight="duotone" className="mr-2" />
                  Light
                </Button>
                <Button
                  type="button"
                  variant={theme === 'dark' ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setTheme('dark')}
                >
                  <Moon size={18} weight="duotone" className="mr-2" />
                  Dark
                </Button>
                <Button
                  type="button"
                  variant={theme === 'system' ? 'default' : 'secondary'}
                  size="sm"
                  onClick={() => setTheme('system')}
                >
                  <Monitor size={18} weight="duotone" className="mr-2" />
                  System
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accent">Accent Color</Label>
              <div className="flex gap-2">
                <Input
                  id="accent"
                  type="color"
                  value={formData.accentColor}
                  onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  value={formData.accentColor}
                  onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                  placeholder="#3B82F6"
                />
              </div>
            </div>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Appearance'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>Export or import your data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button type="button" onClick={handleExport} variant="secondary" className="w-full">
              <Download size={18} weight="duotone" className="mr-2" />
              Export Data
            </Button>
            <div className="space-y-2">
              <Label htmlFor="import">Import Data</Label>
              <Input
                id="import"
                type="file"
                accept=".json"
                onChange={handleImport}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground">
                Importing will replace all existing data. Make sure to export first as a backup.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Manage your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="destructive" onClick={handleLogout}>
            <SignOut size={18} weight="duotone" className="mr-2" />
            Log Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
