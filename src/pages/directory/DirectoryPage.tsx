import { useState, useMemo, useEffect, useRef } from 'react';
import { Users, UserCircle } from 'phosphor-react';
import { useApp } from '@/contexts/app-context';
import { useUser } from '@/contexts/user-context';
import { DirectoryFilters } from './DirectoryFilters';
import { DirectoryGrid } from './DirectoryGrid';
import { ProfileModal } from './ProfileModal';
import { ProfileEditModal } from './ProfileEditModal';
import type { Employee, EmployeeProfile, DirectoryFilters as DirectoryFiltersType } from '@/types';
import { cn } from '@/lib/utils';
import { getEmployees } from '@/lib/storage';

const defaultFilters: DirectoryFiltersType = {
  search: '',
  department: null,
  hierarchy: null,
  location: null,
  skills: [],
};

type ViewMode = 'grid' | 'list' | 'compact';
type SortOption = 'name' | 'department' | 'recent';

export function DirectoryPage() {
  const { employees, employeeProfiles, settings, loading, refresh } = useApp();
  const { user, isAdmin } = useUser();
  const [filters, setFilters] = useState<DirectoryFiltersType>(defaultFilters);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sort, setSort] = useState<SortOption>('name');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const recoveryAttempted = useRef(false);

  // If context shows no employees after load, try once to recover from storage (IndexedDB) so directory shows
  useEffect(() => {
    if (loading || employees.length > 0 || recoveryAttempted.current) return;
    recoveryAttempted.current = true;
    getEmployees().then((list) => {
      if (list.length > 0) refresh();
    });
  }, [loading, employees.length, refresh]);

  const selectedProfile = useMemo(() => {
    if (!selectedEmployee) return null;
    return employeeProfiles.find((p) => p.employeeId === selectedEmployee.id) ?? null;
  }, [selectedEmployee, employeeProfiles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <p className="text-muted-foreground text-sm font-medium">Loading directory…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 sm:pb-10 lg:pb-12">
      <header
        className={cn(
          'relative rounded-2xl overflow-hidden px-6 py-10',
          'bg-gradient-to-br from-accent/15 via-accent/5 to-transparent',
          'border border-border/60'
        )}
      >
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            {settings.name || 'Our People'}
          </h1>
          <p className="text-muted-foreground mt-1">Meet the team</p>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users size={24} weight="duotone" />
              <span className="text-2xl font-semibold text-foreground">{employees.length}</span>
              <span>people</span>
            </div>
          </div>
        </div>
      </header>

      <section>
        <DirectoryFilters
          filters={filters}
          onFiltersChange={setFilters}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sort={sort}
          onSortChange={setSort}
        />
      </section>

      <section>
        {employees.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
            <UserCircle size={48} weight="duotone" className="mx-auto text-muted-foreground" />
            <p className="text-muted-foreground mt-4">No employees in the directory yet.</p>
          </div>
        ) : (
          <DirectoryGrid
            filters={filters}
            viewMode={viewMode}
            sort={sort}
            employeeProfiles={employeeProfiles}
            onCardClick={setSelectedEmployee}
            onEditClick={(emp) => {
              if (user?.employeeId === emp.id || isAdmin()) setEditEmployee(emp);
            }}
          />
        )}
      </section>

      {selectedEmployee && (
        <ProfileModal
          employee={selectedEmployee}
          profile={selectedProfile}
          onClose={() => setSelectedEmployee(null)}
          onEdit={() => {
            setSelectedEmployee(null);
            setEditEmployee(selectedEmployee);
          }}
        />
      )}
      {editEmployee && (user?.employeeId === editEmployee.id || isAdmin()) && (
        <ProfileEditModal
          employee={editEmployee}
          onClose={() => setEditEmployee(null)}
          onSaved={() => setEditEmployee(null)}
        />
      )}
    </div>
  );
}
