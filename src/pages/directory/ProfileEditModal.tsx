import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  // Raw string values for Skills, Fun facts, Achievements so spaces are preserved while typing (no trim on every keystroke)
  const [skillsRaw, setSkillsRaw] = useState('');
  const [funFactsRaw, setFunFactsRaw] = useState('');
  const [achievementsRaw, setAchievementsRaw] = useState('');

  useEffect(() => {
    const next = getOrCreateProfile(employee.id);
    setForm(next);
    setSkillsRaw((next.skills ?? []).join(', '));
    setFunFactsRaw((next.funFacts ?? []).join('\n'));
    setAchievementsRaw((next.achievements ?? []).join('\n'));
  }, [employee.id, getOrCreateProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const skills = skillsRaw ? skillsRaw.split(',').map((x) => x.trim()).filter(Boolean) : [];
      const funFacts = funFactsRaw ? funFactsRaw.split('\n').map((x) => x.trim()).filter(Boolean) : [];
      const achievements = achievementsRaw ? achievementsRaw.split('\n').map((x) => x.trim()).filter(Boolean) : [];
      await saveProfile({
        id: form.id || form.employeeId,
        employeeId: form.employeeId,
        profilePicture: form.profilePicture,
        profilePicturePositionX: form.profilePicturePositionX,
        profilePicturePositionY: form.profilePicturePositionY,
        profilePictureZoom: form.profilePictureZoom,
        coverPhoto: form.coverPhoto,
        coverPhotoPosition: form.coverPhotoPosition,
        coverPhotoZoom: form.coverPhotoZoom,
        bio: form.bio?.slice(0, 500) ?? undefined,
        headline: form.headline?.slice(0, 100) ?? undefined,
        location: form.location,
        skills,
        funFacts,
        achievements,
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

  return createPortal(
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
            <Label>Profile picture (square crop)</Label>
            <div className="mt-2">
              <ImageUploader
                value={form.profilePicture}
                onChange={(v) => setForm((prev) => ({ ...prev, profilePicture: v ?? undefined }))}
                shape="square"
                size="md"
                maxDimension={1200}
                jpegQuality={0.88}
              />
            </div>
            {form.profilePicture && (
              <div className="mt-3 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Crop position</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                    Choose which part of the image is visible in the square.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground block mb-1">Horizontal</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={form.profilePicturePositionX ?? 50}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, profilePicturePositionX: Number(e.target.value) }))
                        }
                        className="w-full h-2 rounded-lg appearance-none bg-muted accent-primary cursor-pointer"
                        aria-label="Profile picture horizontal position"
                      />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground block mb-1">Vertical</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={form.profilePicturePositionY ?? 50}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, profilePicturePositionY: Number(e.target.value) }))
                        }
                        className="w-full h-2 rounded-lg appearance-none bg-muted accent-primary cursor-pointer"
                        aria-label="Profile picture vertical position"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Zoom</Label>
                  <div className="flex items-center gap-3 mt-1">
                    <input
                      type="range"
                      min={100}
                      max={200}
                      value={Math.round((form.profilePictureZoom ?? 1) * 100)}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, profilePictureZoom: Number(e.target.value) / 100 }))
                      }
                      className="flex-1 h-2 rounded-lg appearance-none bg-muted accent-primary cursor-pointer"
                      aria-label="Profile picture zoom"
                    />
                    <span className="text-xs font-medium text-muted-foreground w-10">
                      {Math.round((form.profilePictureZoom ?? 1) * 100)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-border bg-muted shrink-0">
                    <img
                      src={form.profilePicture}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{
                        objectPosition: `${form.profilePicturePositionX ?? 50}% ${form.profilePicturePositionY ?? 50}%`,
                        transform: `scale(${form.profilePictureZoom ?? 1})`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Square · {(form.profilePictureZoom ?? 1) * 100}% zoom
                  </span>
                </div>
              </div>
            )}
          </div>
          <div>
            <Label>Cover photo (optional)</Label>
            <div className="mt-2">
              <ImageUploader
                value={form.coverPhoto}
                onChange={(v) => setForm((prev) => ({ ...prev, coverPhoto: v ?? undefined }))}
                shape="square"
                size="lg"
                maxDimension={1400}
                jpegQuality={0.88}
              />
            </div>
            {form.coverPhoto && (
              <div className="mt-3 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Crop position (vertical)</Label>
                  <div className="flex items-center gap-3 mt-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={form.coverPhotoPosition ?? 50}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, coverPhotoPosition: Number(e.target.value) }))
                      }
                      className="flex-1 h-2 rounded-lg appearance-none bg-muted accent-primary cursor-pointer"
                      aria-label="Cover photo vertical position"
                    />
                    <span className="text-xs font-medium text-muted-foreground w-8">
                      {form.coverPhotoPosition ?? 50}%
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Zoom</Label>
                  <div className="flex items-center gap-3 mt-1">
                    <input
                      type="range"
                      min={100}
                      max={200}
                      value={Math.round((form.coverPhotoZoom ?? 1) * 100)}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, coverPhotoZoom: Number(e.target.value) / 100 }))
                      }
                      className="flex-1 h-2 rounded-lg appearance-none bg-muted accent-primary cursor-pointer"
                      aria-label="Cover photo zoom"
                    />
                    <span className="text-xs font-medium text-muted-foreground w-10">
                      {Math.round((form.coverPhotoZoom ?? 1) * 100)}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Top</span>
                  <span>Center</span>
                  <span>Bottom</span>
                </div>
                <div className="mt-2 rounded-lg overflow-hidden border border-border bg-muted/30 aspect-[21/9] max-h-24">
                  <img
                    src={form.coverPhoto}
                    alt=""
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: `center ${form.coverPhotoPosition ?? 50}%`,
                      transform: `scale(${form.coverPhotoZoom ?? 1})`,
                    }}
                  />
                </div>
              </div>
            )}
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
              autoFocus
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
              value={skillsRaw}
              onChange={(e) => setSkillsRaw(e.target.value)}
              placeholder="e.g. React, TypeScript, Leadership"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="funFacts">Fun facts (one per line)</Label>
            <Textarea
              id="funFacts"
              value={funFactsRaw}
              onChange={(e) => setFunFactsRaw(e.target.value)}
              placeholder={'e.g. Coffee enthusiast\nLoves hiking'}
              rows={3}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="achievements">Achievements (one per line)</Label>
            <Textarea
              id="achievements"
              value={achievementsRaw}
              onChange={(e) => setAchievementsRaw(e.target.value)}
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
    </div>,
    document.body
  );
}
