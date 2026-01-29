import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Template, Employee, Appraisal, AppraisalLink, CompanySettings, ReviewPeriod, Team, AppraisalAssignment, EmployeeProfile } from '@/types';
import { getTemplates, getEmployees, getAppraisals, getLinks, getSettings, getReviewPeriods, getActiveReviewPeriods, getTeams, getAppraisalAssignments, getEmployeeProfiles } from '@/lib/storage';
import { getDepartmentLeaderId } from '@/lib/org-chart-utils';
import { applyAccentColor } from '@/lib/utils';

interface AppContextType {
  templates: Template[];
  employees: Employee[];
  appraisals: Appraisal[];
  links: AppraisalLink[];
  assignments: AppraisalAssignment[];
  settings: CompanySettings;
  reviewPeriods: ReviewPeriod[];
  activePeriods: ReviewPeriod[];
  teams: Team[];
  employeeProfiles: EmployeeProfile[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [appraisals, setAppraisals] = useState<Appraisal[]>([]);
  const [links, setLinks] = useState<AppraisalLink[]>([]);
  const [settings, setSettings] = useState<CompanySettings>({
    name: 'Your Company',
    adminPin: '1234',
    accentColor: '#3B82F6',
    theme: 'system',
  });
  const [reviewPeriods, setReviewPeriods] = useState<ReviewPeriod[]>([]);
  const [activePeriods, setActivePeriods] = useState<ReviewPeriod[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [assignments, setAssignments] = useState<AppraisalAssignment[]>([]);
  const [employeeProfiles, setEmployeeProfiles] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      // Load data with individual error handling to prevent one failure from breaking everything
      const results = await Promise.allSettled([
        getTemplates(),
        getEmployees(),
        getAppraisals(),
        getLinks(),
        getSettings(),
        getReviewPeriods(),
        getActiveReviewPeriods(),
        getTeams(),
        getAppraisalAssignments(),
        getEmployeeProfiles(),
      ]);
      
      if (results[0].status === 'fulfilled') setTemplates(results[0].value);
      if (results[1].status === 'fulfilled') {
        const next = results[1].value;
        // Auto-set Reports to = department leader when not set (in memory for app state)
        const normalized = next.map((e) => {
          if (e.teamId && !e.reportsTo) {
            const leaderId = getDepartmentLeaderId(e.teamId, next);
            if (leaderId && leaderId !== e.id) return { ...e, reportsTo: leaderId };
          }
          return e;
        });
        setEmployees((prev) => (normalized.length > 0 ? normalized : prev.length > 0 ? prev : normalized));
      }
      if (results[2].status === 'fulfilled') setAppraisals(results[2].value);
      if (results[3].status === 'fulfilled') setLinks(results[3].value);
      if (results[4].status === 'fulfilled') {
        const loadedSettings = results[4].value;
        setSettings(loadedSettings);
        // Apply accent color when settings are loaded
        if (loadedSettings.accentColor) {
          applyAccentColor(loadedSettings.accentColor);
        }
      }
      if (results[5].status === 'fulfilled') setReviewPeriods(results[5].value);
      if (results[6].status === 'fulfilled') setActivePeriods(results[6].value);
      if (results[7].status === 'fulfilled') setTeams(results[7].value);
      if (results[8].status === 'fulfilled') setAssignments(results[8].value);
      if (results[9].status === 'fulfilled') {
        const next = results[9].value;
        // Never replace with empty when we already have profiles (keeps directory visible)
        setEmployeeProfiles((prev) => (next.length > 0 ? next : prev.length > 0 ? prev : next));
      }
      
      // Log any failures for debugging
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Error loading data at index ${index}:`, result.reason);
        }
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    
    // Listen for data change events to refresh context
    const handleDataChange = () => {
      console.log('Data change event received, refreshing app context...');
      refresh();
    };
    
    // Listen for specific entity events
    window.addEventListener('employeeCreated', handleDataChange);
    window.addEventListener('employeeUpdated', handleDataChange);
    window.addEventListener('userCreated', handleDataChange);
    window.addEventListener('userUpdated', handleDataChange);
    window.addEventListener('teamCreated', handleDataChange);
    window.addEventListener('teamUpdated', handleDataChange);
    window.addEventListener('employeeProfileUpdated', handleDataChange);
    
    return () => {
      window.removeEventListener('employeeCreated', handleDataChange);
      window.removeEventListener('employeeUpdated', handleDataChange);
      window.removeEventListener('userCreated', handleDataChange);
      window.removeEventListener('userUpdated', handleDataChange);
      window.removeEventListener('teamCreated', handleDataChange);
      window.removeEventListener('teamUpdated', handleDataChange);
      window.removeEventListener('employeeProfileUpdated', handleDataChange);
    };
  }, [refresh]);

  return (
    <AppContext.Provider value={{ templates, employees, appraisals, links, assignments, settings, reviewPeriods, activePeriods, teams, employeeProfiles, loading, refresh }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
