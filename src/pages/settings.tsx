import { useState, useEffect } from 'react';
import { useApp } from '@/contexts/app-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Moon, Sun, Monitor, SignOut, Check, CloudArrowDown, Buildings, Trash, UserCircle } from 'phosphor-react';
import { saveSettings, exportData, importData, syncFromSupabase, clearAllAppraisalData, getUser, saveUser, getUserByUsername } from '@/lib/storage';
import { useToast } from '@/contexts/toast-context';
import { useUser } from '@/contexts/user-context';
import { useTheme } from '@/hooks/use-theme';
import { applyAccentColor, hashPassword, verifyPassword } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { User } from '@/types';

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
  const { user, logout, isAdmin, refresh: refreshUser } = useUser();
  const { theme, setTheme, setAccentColor } = useTheme();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: settings.name,
    adminPin: settings.adminPin,
    accentColor: settings.accentColor,
    hrScoreWeight: settings.hrScoreWeight ?? 30,
    requireHrForRanking: settings.requireHrForRanking ?? false,
  });
  const [profileForm, setProfileForm] = useState({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [clearAppraisalDialogOpen, setClearAppraisalDialogOpen] = useState(false);
  const [clearingAppraisals, setClearingAppraisals] = useState(false);

  useEffect(() => {
    setFormData({
      name: settings.name,
      adminPin: settings.adminPin,
      accentColor: settings.accentColor,
      hrScoreWeight: settings.hrScoreWeight ?? 30,
      requireHrForRanking: settings.requireHrForRanking ?? false,
    });
  }, [settings]);

  // Populate staff profile form from current user
  useEffect(() => {
    if (user && !isAdmin()) {
      setProfileForm((prev) => ({
        ...prev,
        username: user.username,
        email: user.email || '',
      }));
    }
  }, [user, isAdmin]);

  // Apply accent color preview immediately when changed
  const handleAccentColorChange = (color: string) => {
    setFormData({ ...formData, accentColor: color });
    applyAccentColor(color); // Apply immediately for live preview
  };

  const handleSave = async (overrides?: Partial<typeof formData>) => {
    setLoading(true);
    try {
      const data = overrides ? { ...formData, ...overrides } : formData;
      await saveSettings({
        ...settings,
        name: data.name,
        adminPin: data.adminPin,
        accentColor: data.accentColor,
        theme: settings.theme,
        hrScoreWeight: data.hrScoreWeight,
        requireHrForRanking: data.requireHrForRanking,
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

  const handleProfileSave = async () => {
    const userId = localStorage.getItem('userId');
    if (!userId || userId === 'pin-admin' || !user) return;
    if (profileForm.username.trim().length < 3) {
      toast({ title: 'Error', description: 'Username must be at least 3 characters.', variant: 'error' });
      return;
    }
    if (profileForm.newPassword && profileForm.newPassword.length < 6) {
      toast({ title: 'Error', description: 'New password must be at least 6 characters.', variant: 'error' });
      return;
    }
    if (profileForm.newPassword && profileForm.newPassword !== profileForm.confirmPassword) {
      toast({ title: 'Error', description: 'New password and confirmation do not match.', variant: 'error' });
      return;
    }
    setProfileSaving(true);
    try {
      const currentUser = await getUser(userId) as User | undefined;
      if (!currentUser) {
        toast({ title: 'Error', description: 'User not found.', variant: 'error' });
        setProfileSaving(false);
        return;
      }
      if (profileForm.username.trim() !== currentUser.username) {
        const existing = await getUserByUsername(profileForm.username.trim());
        if (existing && existing.id !== currentUser.id) {
          toast({ title: 'Error', description: 'Username is already in use.', variant: 'error' });
          setProfileSaving(false);
          return;
        }
      }
      if (profileForm.newPassword) {
        const valid = await verifyPassword(profileForm.currentPassword, currentUser.passwordHash);
        if (!valid) {
          toast({ title: 'Error', description: 'Current password is incorrect.', variant: 'error' });
          setProfileSaving(false);
          return;
        }
      }
      const updated: User = {
        ...currentUser,
        username: profileForm.username.trim(),
        email: profileForm.email.trim() || undefined,
      };
      if (profileForm.newPassword) {
        updated.passwordHash = await hashPassword(profileForm.newPassword);
      }
      await saveUser(updated);
      await refreshUser();
      window.dispatchEvent(new CustomEvent('userUpdated', { detail: { userId: updated.id } }));
      setProfileForm((prev) => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      toast({ title: 'Profile updated', description: 'Your profile and password have been saved.', variant: 'success' });
    } catch (error) {
      console.error('Profile save error:', error);
      toast({ title: 'Error', description: 'Failed to save profile.', variant: 'error' });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleClearAllAppraisalData = async () => {
    setClearingAppraisals(true);
    try {
      const counts = await clearAllAppraisalData();
      await refresh();
      setClearAppraisalDialogOpen(false);
      const parts = [
        `${counts.assignments} assignment(s)`,
        `${counts.appraisals} submission(s)`,
        `${counts.links} link(s)`,
        `${counts.summaries} performance summary(ies)`,
      ].filter((_, i) => [counts.assignments, counts.appraisals, counts.links, counts.summaries][i] > 0);
      toast({
        title: 'Appraisal data cleared',
        description: parts.length
          ? `Removed ${parts.join(', ')}. Users, employees, teams, templates, and periods are unchanged.`
          : 'All appraisal data was already empty. Users, employees, teams, templates, and periods are unchanged.',
        variant: 'success',
      });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to clear appraisal data.', variant: 'error' });
    } finally {
      setClearingAppraisals(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title text-foreground">Settings</h1>
        <p className="page-subtitle text-muted-foreground">Manage your application settings</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {!isAdmin() && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle size={20} weight="duotone" />
                Profile
              </CardTitle>
              <CardDescription>Update your username, email, and password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-username">Username</Label>
                <Input
                  id="profile-username"
                  value={profileForm.username}
                  onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                  placeholder="e.g., john.doe"
                />
                <p className="text-xs text-muted-foreground">Use this to sign in. At least 3 characters.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  placeholder="e.g., you@company.com"
                />
                <p className="text-xs text-muted-foreground">Optional; visible to admins in User Management.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-current-password">Current password (only to change password)</Label>
                <Input
                  id="profile-current-password"
                  type="password"
                  value={profileForm.currentPassword}
                  onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })}
                  placeholder="Leave blank to keep current password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-new-password">New password</Label>
                <Input
                  id="profile-new-password"
                  type="password"
                  value={profileForm.newPassword}
                  onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
                  placeholder="Min. 6 characters"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-confirm-password">Confirm new password</Label>
                <Input
                  id="profile-confirm-password"
                  type="password"
                  value={profileForm.confirmPassword}
                  onChange={(e) => setProfileForm({ ...profileForm, confirmPassword: e.target.value })}
                  placeholder="Repeat new password"
                />
              </div>
              <Button type="button" onClick={handleProfileSave} disabled={profileSaving}>
                {profileSaving ? 'Saving...' : 'Save profile'}
              </Button>
            </CardContent>
          </Card>
        )}

        {isAdmin() && (
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
        )}

        {isAdmin() && (
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Manage admin access (admin only)</CardDescription>
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
        )}

        {isAdmin() && (
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
        )}

        {isAdmin() && (
          <Card className="border-teal-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Buildings size={20} weight="duotone" className="text-teal-500" />
                Employee of the Month
              </CardTitle>
              <CardDescription>HR score weight and final ranking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hrScoreWeight">HR Score Weight: {formData.hrScoreWeight}%</Label>
                <input
                  id="hrScoreWeight"
                  type="range"
                  min="0"
                  max="100"
                  value={formData.hrScoreWeight}
                  onChange={(e) => setFormData({ ...formData, hrScoreWeight: Number(e.target.value) })}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-teal-500"
                />
                <p className="text-xs text-muted-foreground">
                  Base: {100 - formData.hrScoreWeight}%, HR: {formData.hrScoreWeight}%. Final score = base × (100 − HR%) + HR score × HR%.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.requireHrForRanking}
                  onChange={(e) => setFormData({ ...formData, requireHrForRanking: e.target.checked })}
                  className="rounded w-4 h-4"
                />
                <span className="text-sm">Require HR scores for final ranking</span>
              </label>
              <Button onClick={() => handleSave()} disabled={loading}>
                {loading ? 'Saving...' : 'Save HR Settings'}
              </Button>
            </CardContent>
          </Card>
        )}

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

        {isAdmin() && (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash size={20} weight="duotone" />
                Start fresh (appraisal data only)
              </CardTitle>
              <CardDescription>
                Remove all appraisal forms, completed submissions, links, and cached performance summaries. Users, employees, teams, templates, and review periods are kept.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/50"
                onClick={() => setClearAppraisalDialogOpen(true)}
              >
                <Trash size={18} weight="duotone" className="mr-2" />
                Clear all appraisal data
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={clearAppraisalDialogOpen}
        onClose={() => setClearAppraisalDialogOpen(false)}
        onConfirm={handleClearAllAppraisalData}
        title="Clear all appraisal data?"
        description="This will permanently remove all appraisal assignments, completed submissions, links, and cached performance summaries (e.g. the 76% review view). Users, employees, teams, templates, and review periods will not be changed. You can create new forms and links after this."
        confirmText="Clear appraisal data"
        cancelText="Cancel"
        variant="danger"
        loading={clearingAppraisals}
      />

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
