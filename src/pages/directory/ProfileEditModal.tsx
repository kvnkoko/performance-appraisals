import { useState, useEffect } from 'react';
import { X } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageUploader } from '@/components/ui/image-uploader';
import { useEmployeeProfiles } from '@/hooks/use-employee-profiles';
import type { Employee, EmployeeProfile } from '@/types';
import { cn } from '@/lib/utils';

interface ProfileEditModalProps {
  employee: Employee;
  onClose: () => void;
  onSaved: () => void;
}

export function ProfileEditModal({ employee, onClose, onSaved }: ProfileEditModalProps) {
  const { getOrCreateProfile, saveProfile } = useEmployeeProfiles();
  const [form, setForm] = useState<Partial<EmployeeProfile> & { employeeId: string }>(() => getOrCreateProfile(employee.id));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(getOrCreateProfile(employee.id));
  }, [employee.id, getOrCreateProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await saveProfile({
        id: form.id || form.employeeId,
        employeeId: form.employeeId,
        profilePicture: form.profilePicture,
        coverPhoto: form.coverPhoto,
        bio: form.bio?.slice(0, 500) ?? undefined,
        headline: form.headline?.slice(0, 100) ?? undefined,
        location: form.location,
        skills: form.skills ?? [],
        funFacts: form.funFacts ?? [],
        achievements: form.achievements ?? [],
        socialLinks: form.socialLinks ?? {},
        createdAt: form.createdAt ?? now,
        updatedAt: now,
      });
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const skillsText = (form.skills ?? []).join(', ');
  const setSkills = (s: string) =>
    setForm((prev) => ({ ...prev, skills: s ? s.split(',').map((x) => x.trim()).filter(Boolean) : [] }));
  const funFactsText = (form.funFacts ?? []).join('\n');
  const setFunFacts = (s: string) =>
    setForm((prev) => ({ ...prev, funFacts: s ? s.split('\n').map((x) => x.trim()).filter(Boolean) : [] }));
  const achievementsText = (form.achievements ?? []).join('\n');
  const setAchievements = (s: string) =>
    setForm((prev) => ({ ...prev, achievements: s ? s.split('\n').map((x) => x.trim()).filter(Boolean) : [] }));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className={cn(
          'relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-dropdown',
          'animate-scale-in'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-foreground mb-4">
          Edit profile{employee?.name ? ` · ${employee.name}` : ''}
        </h2>
        <div className="space-y-4">
          <div>
            <Label>Profile picture</Label>
            <div className="mt-2">
              <ImageUploader
                value={form.profilePicture}
                onChange={(v) => setForm((prev) => ({ ...prev, profilePicture: v ?? undefined }))}
                shape="circle"
                size="md"
              />
            </div>
          </div>
          <div>
            <Label>Cover photo (optional)</Label>
            <div className="mt-2">
              <ImageUploader
                value={form.coverPhoto}
                onChange={(v) => setForm((prev) => ({ ...prev, coverPhoto: v ?? undefined }))}
                shape="square"
                size="lg"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="headline">Headline (max 100 chars)</Label>
            <Input
              id="headline"
              value={form.headline ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, headline: e.target.value.slice(0, 100) }))}
              placeholder="e.g. Senior Engineer · Product"
              maxLength={100}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="bio">Bio (max 500 chars)</Label>
            <Textarea
              id="bio"
              value={form.bio ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value.slice(0, 500) }))}
              placeholder="A short bio about you..."
              maxLength={500}
              rows={4}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={form.location ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
              placeholder="e.g. San Francisco, CA"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="skills">Skills (comma-separated)</Label>
            <Input
              id="skills"
              value={skillsText}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="e.g. React, TypeScript, Leadership"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="funFacts">Fun facts (one per line)</Label>
            <Textarea
              id="funFacts"
              value={funFactsText}
              onChange={(e) => setFunFacts(e.target.value)}
              placeholder={'e.g. Coffee enthusiast\nLoves hiking'}
              rows={3}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="achievements">Achievements (one per line)</Label>
            <Textarea
              id="achievements"
              value={achievementsText}
              onChange={(e) => setAchievements(e.target.value)}
              placeholder={'e.g. Q4 MVP\nCertified Scrum Master'}
              rows={3}
              className="mt-1"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X size={20} weight="bold" />
        </button>
      </div>
    </div>
  );
}
