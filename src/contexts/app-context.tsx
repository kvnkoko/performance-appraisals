import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Template, Employee, Appraisal, AppraisalLink, CompanySettings, ReviewPeriod, Team, AppraisalAssignment } from '@/types';
import { getTemplates, getEmployees, getAppraisals, getLinks, getSettings, getReviewPeriods, getActiveReviewPeriods, getTeams, getAppraisalAssignments } from '@/lib/storage';
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
      ]);
      
      if (results[0].status === 'fulfilled') setTemplates(results[0].value);
      if (results[1].status === 'fulfilled') setEmployees(results[1].value);
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
    
    return () => {
      window.removeEventListener('employeeCreated', handleDataChange);
      window.removeEventListener('employeeUpdated', handleDataChange);
      window.removeEventListener('userCreated', handleDataChange);
      window.removeEventListener('userUpdated', handleDataChange);
      window.removeEventListener('teamCreated', handleDataChange);
      window.removeEventListener('teamUpdated', handleDataChange);
    };
  }, [refresh]);

  return (
    <AppContext.Provider value={{ templates, employees, appraisals, links, assignments, settings, reviewPeriods, activePeriods, teams, loading, refresh }}>
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
