import { useCallback } from 'react';
import { useApp } from '@/contexts/app-context';
import { saveEmployeeProfile, UserFacingError } from '@/lib/storage';
import type { EmployeeProfile } from '@/types';

export function useEmployeeProfiles() {
  const { employeeProfiles, profilesLoaded, refresh } = useApp();

  const getProfile = useCallback(
    (employeeId: string): EmployeeProfile | undefined => {
      return employeeProfiles.find((p) => p.employeeId === employeeId);
    },
    [employeeProfiles]
  );

  const getOrCreateProfile = useCallback(
    (employeeId: string): Partial<EmployeeProfile> & { employeeId: string; id: string } => {
      const existing = employeeProfiles.find((p) => p.employeeId === employeeId);
      if (existing) return existing;
      const now = new Date().toISOString();
      return {
        id: employeeId,
        employeeId,
        createdAt: now,
        updatedAt: now,
      };
    },
    [employeeProfiles]
  );

  const saveProfile = useCallback(
    async (profile: EmployeeProfile) => {
      // Saving writes every field, so it must start from the loaded profile, never a blank one.
      if (!profilesLoaded) throw new UserFacingError('Profiles are still loading. Please try again in a moment.');
      const toSave: EmployeeProfile = {
        ...profile,
        id: profile.id || profile.employeeId,
        updatedAt: new Date().toISOString(),
      };
      await saveEmployeeProfile(toSave);
      await refresh(['profiles']);
    },
    [profilesLoaded, refresh]
  );

  return { employeeProfiles, profilesLoaded, getProfile, getOrCreateProfile, saveProfile, refresh };
}
