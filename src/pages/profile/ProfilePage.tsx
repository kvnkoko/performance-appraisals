import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Buildings,
  Envelope,
  Trophy,
  Sparkle,
  PencilSimple,
  User,
  TreeStructure,
} from 'phosphor-react';
import { Button } from '@/components/ui/button';
import { getInitials, hashToHue } from '@/components/ui/avatar';
import { HierarchyBadge } from '@/components/shared/hierarchy-badge';
import { SkillBadge } from '@/components/ui/skill-badge';
import { useApp } from '@/contexts/app-context';
import { useUser } from '@/contexts/user-context';
import { getDirectReports, getReportingChain } from '@/lib/org-chart-utils';
import { ProfileEditModal } from '@/pages/directory/ProfileEditModal';
import type { Employee, EmployeeProfile } from '@/types';
import { cn } from '@/lib/utils';

export function ProfilePage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { employees, employeeProfiles, teams } = useApp();
  const { user, isAdmin } = useUser();

  const employee = employees.find((e) => e.id === employeeId) ?? null;
  const profile: EmployeeProfile | null = employee
    ? employeeProfiles.find((p) => p.employeeId === employee.id) ?? null
    : null;
  const team = employee?.teamId ? teams.find((t) => t.id === employee.teamId) : undefined;
  const reports = employee ? getDirectReports(employee.id, employees) : [];
  const chain = employee ? getReportingChain(employee.id, employees) : [];
  const manager = chain[0] ?? null;
  const isOwnProfile = user?.employeeId === employee?.id;
  const canEdit = isOwnProfile || isAdmin();
  const [editOpen, setEditOpen] = useState(false);

  const coverZoom = profile?.coverPhotoZoom ?? 1;
  const coverPosition = profile?.coverPhotoPosition ?? 50;
  const profileZoom = profile?.profilePictureZoom ?? 1;
  const profilePosX = profile?.profilePicturePositionX ?? 50;
  const profilePosY = profile?.profilePicturePositionY ?? 50;

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="rounded-2xl border border-border bg-card/50 px-8 py-12 text-center">
          <p className="text-muted-foreground font-medium">Profile not found</p>
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2 mt-4">
            <ArrowLeft size={18} /> Back
          </Button>
        </div>
      </div>
    );
  }

  const hasCover = Boolean(profile?.coverPhoto);

  /* ----- Layout when user HAS a cover photo: full-width hero + overlapping card ----- */
  if (hasCover) {
    return (
      <div className="min-h-full flex flex-col min-w-0">
        {/* Hero: cover extends down so it sits behind the profile card (no gap) */}
        <div
          className="relative w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] lg:w-[calc(100%+4rem)] max-w-none min-w-0 -mx-4 sm:-mx-6 lg:-mx-8 -mt-20 lg:-mt-8 overflow-hidden bg-muted"
          style={{
            aspectRatio: '21 / 9',
            minHeight: 'clamp(380px, 48vh, 560px)',
          }}
        >
          <img
            src={profile!.coverPhoto!}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              objectPosition: `center ${coverPosition}%`,
              transform: `scale(${coverZoom})`,
              transformOrigin: 'center center',
            }}
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-background from-0% via-transparent via-60% to-transparent"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-background/10 via-transparent to-background/10"
            aria-hidden
          />

          <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 sm:p-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className={cn(
                'flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200',
                'bg-white/10 dark:bg-black/25 backdrop-blur-xl border border-white/20 dark:border-white/10',
                'hover:bg-white/20 dark:hover:bg-black/40 text-foreground'
              )}
              aria-label="Go back"
            >
              <ArrowLeft size={20} weight="bold" /> Back
            </button>
            {canEdit && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditOpen(true)}
                className={cn(
                  'gap-2 rounded-full',
                  'bg-white/10 dark:bg-black/25 backdrop-blur-xl border-white/20 dark:border-white/10',
                  'hover:bg-white/20 dark:hover:bg-black/40 text-foreground'
                )}
              >
                <PencilSimple size={18} /> Edit profile
              </Button>
            )}
          </div>
        </div>

        {/* Profile card overlaps bottom of cover so cover extends behind it */}
        <div className="relative px-4 sm:px-6 lg:px-8 -mt-24 sm:-mt-28 lg:-mt-32 z-20 pb-4 sm:pb-6">
          {renderProfileCard(true)}
        </div>
        {renderContentSections()}
      {editOpen && (
        <ProfileEditModal
          employee={employee}
          onClose={() => setEditOpen(false)}
          onSaved={() => setEditOpen(false)}
        />
      )}
      </div>
    );
  }

  /* ----- Layout when user has NO cover photo: no hero, compact top bar + profile card ----- */
  return (
    <div className="min-h-full flex flex-col">
      {/* Compact top bar only (no hero) — responsive padding */}
      <div className="flex items-center justify-between gap-3 sm:gap-4 py-3 sm:py-4 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className={cn(
            'flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200',
            'bg-card/80 dark:bg-card/90 backdrop-blur-xl border border-border',
            'hover:bg-muted text-foreground'
          )}
          aria-label="Go back"
        >
          <ArrowLeft size={20} weight="bold" /> Back
        </button>
        {canEdit && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="gap-2 rounded-full"
          >
            <PencilSimple size={18} /> Edit profile
          </Button>
        )}
      </div>

      {/* Profile card: no overlap, avatar + details in one card */}
      <div className="px-0 pb-6">
        {renderProfileCard(false)}
      </div>
      {renderContentSections()}
      {editOpen && (
        <ProfileEditModal
          employee={employee}
          onClose={() => setEditOpen(false)}
          onSaved={() => setEditOpen(false)}
        />
      )}
    </div>
  );

  function renderProfileCard(overlapping: boolean) {
    return (
      <div
        className={cn(
          'rounded-2xl overflow-hidden',
          'bg-card/90 dark:bg-card/95 backdrop-blur-2xl',
          'border border-border/60 dark:border-white/10',
          'shadow-2xl shadow-black/5 dark:shadow-black/20',
          overlapping && 'mt-0',
          !overlapping && 'mx-4 sm:mx-6 lg:mx-8 max-w-4xl'
        )}
      >
        <div className="p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-5">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-5 flex-1 min-w-0">
              <div className="relative shrink-0 w-28 h-28 sm:w-36 sm:h-36 rounded-xl overflow-hidden bg-muted ring-4 ring-card shadow-xl shadow-black/10">
                {profile?.profilePicture ? (
                  <img
                    src={profile.profilePicture}
                    alt=""
                    className="w-full h-full object-cover aspect-square"
                    style={{
                      objectPosition: `${profilePosX}% ${profilePosY}%`,
                      transform: `scale(${profileZoom})`,
                      transformOrigin: 'center center',
                    }}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center aspect-square"
                    style={{
                      background: `linear-gradient(135deg, hsl(${hashToHue(employee.name)}, 65%, 55%), hsl(${hashToHue(employee.name)}, 65%, 40%))`,
                    }}
                  >
                    <span className="text-4xl sm:text-5xl font-bold text-white select-none">
                      {getInitials(employee.name)}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-0.5">
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                    {employee.name}
                  </h1>
                  <HierarchyBadge hierarchy={employee.hierarchy} size="sm" />
                </div>
                <p className="text-base text-muted-foreground font-medium">{employee.role}</p>
                {team && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center sm:justify-start gap-1.5">
                    <Buildings size={14} weight="duotone" className="opacity-70" /> {team.name}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3 text-xs">
                  {reports.length > 0 && (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <TreeStructure size={14} weight="duotone" />
                      {reports.length} direct report{reports.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {manager && (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <User size={14} weight="duotone" />
                      Reports to {manager.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {profile?.headline && (
            <p className="text-muted-foreground text-sm leading-relaxed mt-4 pt-4 border-t border-border/50">
              {profile.headline}
            </p>
          )}
        </div>
      </div>
    );
  }

  function renderContentSections() {
    return (
      <div className="relative px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8">
        {/* Content: compact strip + dense grid (no duplicate profile card) */}
        <div className="mt-4 sm:mt-5 space-y-4">
          {/* Compact details strip: Location, Email, Reports to, Direct reports in one card */}
          <div
            className={cn(
              'rounded-xl p-4 sm:p-5',
              'bg-card/70 dark:bg-card/80 backdrop-blur-xl',
              'border border-border/50 dark:border-white/10'
            )}
          >
            <div className="flex flex-wrap gap-x-6 gap-y-3 sm:gap-x-8">
              {profile?.location && (
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin size={16} weight="duotone" className="text-primary shrink-0 opacity-80" />
                  <span className="text-sm text-foreground font-medium truncate">{profile.location}</span>
                </div>
              )}
              {employee.email && (
                <div className="flex items-center gap-2 min-w-0">
                  <Envelope size={16} weight="duotone" className="text-primary shrink-0 opacity-80" />
                  <a
                    href={`mailto:${employee.email}`}
                    className="text-sm text-foreground font-medium hover:text-primary transition-colors truncate"
                  >
                    {employee.email}
                  </a>
                </div>
              )}
              {manager && (
                <div className="flex items-center gap-2 min-w-0">
                  <User size={16} weight="duotone" className="text-primary shrink-0 opacity-80" />
                  <span className="text-sm text-foreground font-medium truncate">Reports to {manager.name}</span>
                </div>
              )}
              {reports.length > 0 && (
                <div className="flex items-center gap-2 min-w-0">
                  <TreeStructure size={16} weight="duotone" className="text-primary shrink-0 opacity-80" />
                  <span className="text-sm text-foreground font-medium truncate">
                    {reports.length} direct report{reports.length !== 1 ? 's' : ''}: {reports.map((r) => r.name).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* About + Skills/Fun/Achievements in one dense grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {profile?.bio && (
              <section
                className={cn(
                  'rounded-xl p-4',
                  'bg-card/70 dark:bg-card/80 backdrop-blur-xl',
                  'border border-border/50 dark:border-white/10',
                  'lg:col-span-2'
                )}
              >
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <User size={14} weight="duotone" /> About
                </h2>
                <p className="text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap line-clamp-4 sm:line-clamp-none">
                  {profile.bio}
                </p>
              </section>
            )}

            <div className="space-y-4 lg:col-span-1">
              {(profile?.skills?.length ?? 0) > 0 && (
                <section
                  className={cn(
                    'rounded-xl p-4',
                    'bg-card/70 dark:bg-card/80 backdrop-blur-xl',
                    'border border-border/50 dark:border-white/10'
                  )}
                >
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Sparkle size={14} weight="duotone" /> Skills
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {profile!.skills!.map((s) => (
                      <SkillBadge key={s} label={s} />
                    ))}
                  </div>
                </section>
              )}

              {(profile?.funFacts?.length ?? 0) > 0 && (
                <section
                  className={cn(
                    'rounded-xl p-4',
                    'bg-card/70 dark:bg-card/80 backdrop-blur-xl',
                    'border border-border/50 dark:border-white/10'
                  )}
                >
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Sparkle size={14} weight="duotone" /> Fun facts
                  </h2>
                  <ul className="space-y-1 text-sm text-foreground/90">
                    {profile!.funFacts!.map((f, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-primary shrink-0">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {(profile?.achievements?.length ?? 0) > 0 && (
                <section
                  className={cn(
                    'rounded-xl p-4',
                    'bg-card/70 dark:bg-card/80 backdrop-blur-xl',
                    'border border-border/50 dark:border-white/10'
                  )}
                >
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Trophy size={14} weight="duotone" /> Achievements
                  </h2>
                  <ul className="space-y-1 text-sm text-foreground/90">
                    {profile!.achievements!.map((a, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-primary shrink-0">•</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
