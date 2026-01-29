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

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  if (variant === 'list') {
    return (
      <AnimatedCard delay={index * 0.03}>
        <div
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={handleCardKeyDown}
          className="flex w-full items-center gap-4 text-left cursor-pointer rounded-lg hover:bg-muted/50 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
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
        </div>
      </AnimatedCard>
    );
  }

  return (
    <AnimatedCard delay={index * 0.03} className="p-0 overflow-hidden rounded-2xl aspect-square">
      <div className="relative flex flex-col h-full w-full rounded-2xl border border-border bg-card overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.02]">
        {/* Edit button top right */}
        {canEdit && onEdit && (
          <div className="absolute top-2 right-2 z-10">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0 bg-black/40 hover:bg-black/60 border-0 text-white backdrop-blur-sm"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
              title={isAdmin() ? 'Edit profile (admin)' : 'Edit profile'}
            >
              <PencilSimple size={16} />
            </Button>
          </div>
        )}
        <button
          type="button"
          onClick={onClick}
          className="relative flex flex-col h-full w-full text-left rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border-0 bg-transparent p-0 cursor-pointer overflow-hidden"
        >
          {/* Image fills square; object-cover so no blank areas */}
          <div className="absolute inset-0 rounded-2xl overflow-hidden bg-muted">
            {profile?.profilePicture ? (
              <img
                src={profile.profilePicture}
                alt=""
                className="w-full h-full object-cover object-center"
                loading="lazy"
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
          </div>
          {/* Gradient overlay + name, title, department on top of image */}
          <div
            className="absolute inset-x-0 bottom-0 z-[1] pt-16 pb-4 px-4 rounded-b-2xl"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)',
            }}
          >
            <h3 className="font-bold text-white text-lg leading-tight drop-shadow-sm truncate">
              {employee.name}
            </h3>
            <p className="text-white/95 text-sm mt-0.5 truncate">{employee.role}</p>
            {team && (
              <p className="text-white/80 text-xs mt-1 flex items-center gap-1 truncate">
                <Buildings size={12} weight="duotone" className="shrink-0" /> {team.name}
              </p>
            )}
            <span className="inline-block mt-2 text-white/90 text-xs font-medium">
              View profile →
            </span>
          </div>
        </button>
      </div>
    </AnimatedCard>
  );
}
