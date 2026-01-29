import { MapPin, Buildings, PencilSimple } from 'phosphor-react';
import { Avatar, getInitials, hashToHue } from '@/components/ui/avatar';
import { HierarchyBadge } from '@/components/shared/hierarchy-badge';
import { SkillBadge } from '@/components/ui/skill-badge';
import { Button } from '@/components/ui/button';
import { AnimatedCard } from '@/components/ui/animated-card';
import { useApp } from '@/contexts/app-context';
import { useUser } from '@/contexts/user-context';
import type { Employee, EmployeeProfile } from '@/types';
import { cn } from '@/lib/utils';

const MAX_SKILLS = 3;

interface ProfileCardProps {
  employee: Employee;
  profile?: EmployeeProfile | null;
  onClick: () => void;
  onEdit?: () => void;
  variant?: 'grid' | 'list' | 'compact';
  index?: number;
}

export function ProfileCard({ employee, profile, onClick, onEdit, variant = 'grid', index = 0 }: ProfileCardProps) {
  const { teams } = useApp();
  const { user, isAdmin } = useUser();
  const team = employee.teamId ? teams.find((t) => t.id === employee.teamId) : undefined;
  const isOwnProfile = user?.employeeId === employee.id;
  const canEdit = isOwnProfile || isAdmin();
  const headline = profile?.headline || profile?.bio?.slice(0, 80) || employee.role;
  const skills = profile?.skills?.slice(0, MAX_SKILLS) ?? [];
  const extraSkills = (profile?.skills?.length ?? 0) - MAX_SKILLS;

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex items-center gap-3 w-full rounded-lg border border-border bg-card p-3 text-left transition-all hover:bg-muted/50 hover:shadow-card'
        )}
      >
        <Avatar src={profile?.profilePicture} name={employee.name} size="sm" hierarchy={employee.hierarchy} showRing={false} />
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{employee.name}</p>
          <p className="text-xs text-muted-foreground truncate">{employee.role}</p>
        </div>
        <HierarchyBadge hierarchy={employee.hierarchy} size="sm" />
      </button>
    );
  }

  if (variant === 'list') {
    return (
      <AnimatedCard delay={index * 0.03}>
        <button type="button" onClick={onClick} className="flex w-full items-center gap-4 text-left">
          <Avatar src={profile?.profilePicture} name={employee.name} size="lg" hierarchy={employee.hierarchy} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground">{employee.name}</h3>
              <HierarchyBadge hierarchy={employee.hierarchy} size="sm" />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{employee.role}</p>
            {team && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Buildings size={12} /> {team.name}
              </p>
            )}
            {headline && <p className="text-sm mt-2 line-clamp-2 text-muted-foreground">{headline}</p>}
          </div>
          {canEdit && onEdit && (
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="shrink-0" title={isAdmin() ? 'Edit profile (admin)' : 'Edit profile'}>
              <PencilSimple size={18} />
            </Button>
          )}
        </button>
      </AnimatedCard>
    );
  }

  return (
    <AnimatedCard delay={index * 0.03}>
      <div className="flex flex-col h-full rounded-2xl border border-border bg-card overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.02]">
        <button type="button" onClick={onClick} className="flex flex-col flex-1 text-left">
          {/* Hero: profile image – object-contain so portrait and landscape both show fully */}
          <div className="relative w-full aspect-[4/5] min-h-[200px] rounded-t-2xl overflow-hidden bg-muted flex items-center justify-center">
            {profile?.profilePicture ? (
              <img
                src={profile.profilePicture}
                alt=""
                className="max-w-full max-h-full w-auto h-auto object-contain object-center"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, hsl(${hashToHue(employee.name)}, 65%, 55%), hsl(${hashToHue(employee.name)}, 65%, 40%))`,
                }}
              >
                <span className="text-5xl font-semibold text-white select-none">
                  {getInitials(employee.name)}
                </span>
              </div>
            )}
            {canEdit && onEdit && (
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2 shrink-0 bg-card/90 hover:bg-card border border-border"
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                title={isAdmin() ? 'Edit profile (admin)' : 'Edit profile'}
              >
                <PencilSimple size={16} />
              </Button>
            )}
          </div>
          <div className="p-4 flex flex-col flex-1">
            <h3 className="font-semibold text-foreground truncate w-full text-lg">{employee.name}</h3>
            <p className="text-sm text-muted-foreground truncate w-full mt-0.5">{employee.role}</p>
            {team && (
              <span className="mt-2 rounded-full px-2.5 py-0.5 text-xs bg-muted/80 text-muted-foreground w-fit">
                {team.name}
              </span>
            )}
            {headline && (
              <p className="text-sm text-muted-foreground mt-3 line-clamp-2 flex-1">{headline}</p>
            )}
            {profile?.location && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <MapPin size={12} /> {profile.location}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {skills.map((s) => (
                <SkillBadge key={s} label={s} />
              ))}
              {extraSkills > 0 && <SkillBadge label={`+${extraSkills}`} />}
            </div>
          </div>
        </button>
        <div className="px-4 pb-4 pt-0">
          <Button variant="outline" size="sm" className="w-full" onClick={onClick}>
            View profile
          </Button>
        </div>
      </div>
    </AnimatedCard>
  );
}
