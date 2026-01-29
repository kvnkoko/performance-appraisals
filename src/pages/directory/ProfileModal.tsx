import { useState, useEffect, useRef } from 'react';
import { X, MapPin, Buildings, Envelope, Link as LinkIcon, Briefcase, Trophy, Sparkle } from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { getInitials, hashToHue } from '@/components/ui/avatar';
import { HierarchyBadge } from '@/components/shared/hierarchy-badge';
import { SkillBadge } from '@/components/ui/skill-badge';
import { useApp } from '@/contexts/app-context';
import { useUser } from '@/contexts/user-context';
import { getDirectReports, getReportingChain } from '@/lib/org-chart-utils';
import type { Employee, EmployeeProfile } from '@/types';
import { cn } from '@/lib/utils';

interface ProfileModalProps {
  employee: Employee;
  profile?: EmployeeProfile | null;
  onClose: () => void;
  onEdit: () => void;
}

export function ProfileModal({ employee, profile, onClose, onEdit }: ProfileModalProps) {
  const { employees, teams } = useApp();
  const { user, isAdmin } = useUser();
  const team = employee.teamId ? teams.find((t) => t.id === employee.teamId) : undefined;
  const reports = getDirectReports(employee.id, employees);
  const chain = getReportingChain(employee.id, employees);
  const manager = chain[0];
  const isOwnProfile = user?.employeeId === employee.id;
  const canEdit = isOwnProfile || isAdmin();

  const heroImageSrc = profile?.profilePicture ?? profile?.coverPhoto ?? null;
  const [heroAspect, setHeroAspect] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const setAspectFromImg = (img: HTMLImageElement | null) => {
    if (!img?.naturalWidth || !img.naturalHeight) return;
    setHeroAspect(img.naturalWidth / img.naturalHeight);
  };

  useEffect(() => {
    setHeroAspect(null);
    if (!heroImageSrc) return;
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth) {
      setAspectFromImg(img);
      return;
    }
    const preload = new Image();
    preload.onload = () => setHeroAspect(preload.naturalWidth / preload.naturalHeight);
    preload.src = heroImageSrc;
    return () => { preload.src = ''; };
  }, [heroImageSrc]);

  const onHeroImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setAspectFromImg(e.currentTarget);
  };

  const hasAspect = heroAspect != null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className={cn(
          'relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-dropdown',
          'animate-scale-in'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero: container aspect = image aspect so no blank areas; portrait = tall, landscape = shorter; modal scrolls if needed */}
        <div
          className="w-full rounded-t-2xl overflow-hidden bg-muted flex justify-center items-center shrink-0 min-h-[180px]"
          style={
            hasAspect
              ? { aspectRatio: `${heroAspect}` }
              : { minHeight: 200, maxHeight: 'min(45vh, 360px)' }
          }
        >
          {heroImageSrc ? (
            <img
              ref={imgRef}
              src={heroImageSrc}
              alt=""
              className="w-full h-full object-contain object-center block"
              loading="eager"
              onLoad={onHeroImageLoad}
            />
          ) : (
            <div
              className="w-full flex items-center justify-center min-h-[220px] rounded-t-2xl"
              style={{
                background: `linear-gradient(135deg, hsl(${hashToHue(employee.name)}, 65%, 55%), hsl(${hashToHue(employee.name)}, 65%, 40%))`,
              }}
            >
              <span className="text-6xl font-semibold text-white select-none">
                {getInitials(employee.name)}
              </span>
            </div>
          )}
        </div>
        <div className="px-6 sm:px-8 pb-8 pt-6 relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-foreground tracking-tight">{employee.name}</h2>
                <HierarchyBadge hierarchy={employee.hierarchy} size="md" />
              </div>
              <p className="text-muted-foreground mt-1">{employee.role}</p>
              {team && employee.role !== team.name && (
                <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-1.5">
                  <Buildings size={14} weight="duotone" /> {team.name}
                </p>
              )}
            </div>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={onEdit} className="shrink-0">
                {isAdmin() ? 'Edit profile (admin)' : 'Edit profile'}
              </Button>
            )}
          </div>

          {profile?.headline && (
            <p className="text-muted-foreground mt-5 pb-5 border-b border-border">{profile.headline}</p>
          )}
          {profile?.bio && (
            <section className="mt-6">
              <h3 className="text-sm font-semibold text-foreground mb-2">About</h3>
              <p className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">{profile.bio}</p>
            </section>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            {profile?.location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin size={18} weight="duotone" /> {profile.location}
              </div>
            )}
            {employee.email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Envelope size={18} weight="duotone" /> {employee.email}
              </div>
            )}
          </div>

          {manager && (
            <section className="mt-6 pt-4 border-t border-border/60">
              <h3 className="text-sm font-semibold text-foreground mb-1.5">Reports to</h3>
              <p className="text-muted-foreground text-sm">{manager.name} · {manager.role}</p>
            </section>
          )}
          {reports.length > 0 && (
            <section className="mt-4">
              <h3 className="text-sm font-semibold text-foreground mb-1.5">Direct reports ({reports.length})</h3>
              <p className="text-muted-foreground text-sm">{reports.map((r) => r.name).join(', ')}</p>
            </section>
          )}

          {(profile?.skills?.length ?? 0) > 0 && (
            <section className="mt-6 pt-4 border-t border-border/60">
              <h3 className="text-sm font-semibold text-foreground mb-2">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {profile!.skills!.map((s) => (
                  <SkillBadge key={s} label={s} />
                ))}
              </div>
            </section>
          )}
          {(profile?.funFacts?.length ?? 0) > 0 && (
            <section className="mt-6 pt-4 border-t border-border/60">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
                <Sparkle size={16} /> Fun facts
              </h3>
              <ul className="list-disc list-inside text-muted-foreground text-sm space-y-1">
                {profile!.funFacts!.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </section>
          )}
          {(profile?.achievements?.length ?? 0) > 0 && (
            <section className="mt-6 pt-4 border-t border-border/60">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
                <Trophy size={16} /> Achievements
              </h3>
              <ul className="list-disc list-inside text-muted-foreground text-sm space-y-1">
                {profile!.achievements!.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-card/90 border border-border hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X size={20} weight="bold" />
        </button>
      </div>
    </div>
  );
}
