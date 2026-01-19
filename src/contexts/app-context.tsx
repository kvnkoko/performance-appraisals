import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Template, Employee, Appraisal, AppraisalLink, CompanySettings, ReviewPeriod } from '@/types';
import { getTemplates, getEmployees, getAppraisals, getLinks, getSettings, getReviewPeriods, getActiveReviewPeriods } from '@/lib/storage';

interface AppContextType {
  templates: Template[];
  employees: Employee[];
  appraisals: Appraisal[];
  links: AppraisalLink[];
  settings: CompanySettings;
  reviewPeriods: ReviewPeriod[];
  activePeriods: ReviewPeriod[];
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
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
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
      ]);
      
      if (results[0].status === 'fulfilled') setTemplates(results[0].value);
      if (results[1].status === 'fulfilled') setEmployees(results[1].value);
      if (results[2].status === 'fulfilled') setAppraisals(results[2].value);
      if (results[3].status === 'fulfilled') setLinks(results[3].value);
      if (results[4].status === 'fulfilled') setSettings(results[4].value);
      if (results[5].status === 'fulfilled') setReviewPeriods(results[5].value);
      if (results[6].status === 'fulfilled') setActivePeriods(results[6].value);
      
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
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AppContext.Provider value={{ templates, employees, appraisals, links, settings, reviewPeriods, activePeriods, loading, refresh }}>
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
