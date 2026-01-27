import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Moon, Sun, Monitor, SignOut, Check, CloudArrowDown } from 'phosphor-react';
import { saveSettings, exportData, importData, syncFromSupabase } from '@/lib/storage';
import { useToast } from '@/contexts/toast-context';
import { useUser } from '@/contexts/user-context';
import { useTheme } from '@/hooks/use-theme';
import { applyAccentColor } from '@/lib/utils';

// Preset accent colors for easy selection
const PRESET_COLORS = [
  { name: 'Blue', color: '#3B82F6' },
  { name: 'Purple', color: '#8B5CF6' },
  { name: 'Pink', color: '#EC4899' },
  { name: 'Rose', color: '#F43F5E' },
  { name: 'Orange', color: '#F97316' },
  { name: 'Amber', color: '#F59E0B' },
  { name: 'Green', color: '#22C55E' },
  { name: 'Teal', color: '#14B8A6' },
  { name: 'Cyan', color: '#06B6D4' },
  { name: 'Indigo', color: '#6366F1' },
];

export function SettingsPage() {
  const { settings, refresh } = useApp();
  const { logout } = useUser();
  const { theme, setTheme, setAccentColor } = useTheme();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: settings.name,
    adminPin: settings.adminPin,
    accentColor: settings.accentColor,
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setFormData({
      name: settings.name,
      adminPin: settings.adminPin,
      accentColor: settings.accentColor,
    });
  }, [settings]);

  // Apply accent color preview immediately when changed
  const handleAccentColorChange = (color: string) => {
    setFormData({ ...formData, accentColor: color });
    applyAccentColor(color); // Apply immediately for live preview
  };

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

  const handleSyncFromCloud = async () => {
    setSyncing(true);
    try {
      const ok = await syncFromSupabase();
      if (ok) {
        await refresh();
        toast({ title: 'Synced from cloud', description: 'Local data has been reset from Supabase.', variant: 'success' });
      } else {
        toast({ title: 'Sync unavailable', description: 'Supabase is not configured or sync failed.', variant: 'error' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to sync from cloud.', variant: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/auth';
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title text-foreground">Settings</h1>
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
          <CardContent className="space-y-6">
            <div className="space-y-3">
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
            
            <div className="space-y-3">
              <Label>Accent Color</Label>
              <p className="text-xs text-muted-foreground">Choose a color that represents your brand</p>
              
              {/* Preset color swatches */}
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.color}
                    type="button"
                    onClick={() => handleAccentColorChange(preset.color)}
                    className="relative w-10 h-10 rounded-lg transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
                    style={{ backgroundColor: preset.color }}
                    title={preset.name}
                  >
                    {formData.accentColor.toLowerCase() === preset.color.toLowerCase() && (
                      <Check 
                        size={20} 
                        weight="bold" 
                        className="absolute inset-0 m-auto text-white drop-shadow-md" 
                      />
                    )}
                  </button>
                ))}
              </div>
              
              {/* Custom color picker */}
              <div className="flex gap-2 items-center pt-2">
                <div className="relative">
                  <Input
                    id="accent"
                    type="color"
                    value={formData.accentColor}
                    onChange={(e) => handleAccentColorChange(e.target.value)}
                    className="w-14 h-10 cursor-pointer p-1"
                  />
                </div>
                <Input
                  value={formData.accentColor}
                  onChange={(e) => handleAccentColorChange(e.target.value)}
                  placeholder="#3B82F6"
                  className="flex-1 font-mono text-sm"
                />
              </div>
              
              {/* Live preview */}
              <div className="mt-4 p-4 rounded-lg border border-border/50 bg-card/50">
                <p className="text-sm text-muted-foreground mb-3">Preview</p>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: formData.accentColor }}
                  >
                    A
                  </div>
                  <div 
                    className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                    style={{ backgroundColor: formData.accentColor }}
                  >
                    Primary Button
                  </div>
                  <div 
                    className="px-3 py-1.5 rounded text-sm font-medium"
                    style={{ 
                      backgroundColor: `${formData.accentColor}20`,
                      color: formData.accentColor 
                    }}
                  >
                    Active Tab
                  </div>
                </div>
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
            <CardDescription>Export, import, or sync from cloud</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button type="button" onClick={handleSyncFromCloud} variant="secondary" className="w-full" disabled={syncing}>
              <CloudArrowDown size={18} weight="duotone" className="mr-2" />
              {syncing ? 'Syncing...' : 'Sync from cloud'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Resets local data from Supabase so all devices see the same data. Only available when Supabase is configured.
            </p>
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
