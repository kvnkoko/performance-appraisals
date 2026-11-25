import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { useUser } from '@/contexts/user-context';
import type { Template, Employee, Appraisal, AppraisalLink, CompanySettings, ReviewPeriod, Team, AppraisalAssignment, EmployeeProfile, MyPeriodResult } from '@/types';
import { getTemplates, getEmployees, getAppraisals, getLinks, getSettings, getReviewPeriods, getTeams, getAppraisalAssignments, getEmployeeProfiles, getMyResults } from '@/lib/storage';
import { getDepartmentLeaderId } from '@/lib/org-chart-utils';
import { effectiveAssignments, isLinkDone } from '@/lib/appraisal-status';
import { applyAccentColor } from '@/lib/utils';

/**
 * Data is reloaded in groups so a change only re-downloads what it affects:
 * people = employees and teams, profiles = directory profiles (with photos),
 * work = templates, periods, forms, links and appraisals, settings = company settings.
 */
export type DataGroup = 'people' | 'profiles' | 'work' | 'settings';
const ALL_GROUPS: DataGroup[] = ['people', 'profiles', 'work', 'settings'];

/** Coming back to the tab reloads data only if it is at least this old. */
const STALE_AFTER_MS = 60_000;

interface AppContextType {
  templates: Template[];
  employees: Employee[];
  appraisals: Appraisal[];
  links: AppraisalLink[];
  assignments: AppraisalAssignment[];
  /** The signed-in person's own results per period, as summaries (empty without a linked employee). */
  myResults: MyPeriodResult[];
  settings: CompanySettings;
  reviewPeriods: ReviewPeriod[];
  activePeriods: ReviewPeriod[];
  teams: Team[];
  employeeProfiles: EmployeeProfile[];
  /** False until profiles have been loaded once; editing a profile before that would start from a blank copy. */
  profilesLoaded: boolean;
  loading: boolean;
  /** Reload the given groups (all by default). Calls made while a reload runs are combined into one follow-up. */
  refresh: (groups?: DataGroup[]) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function settle<T>(promise: Promise<T>, label: string): Promise<T | undefined> {
  return promise.catch((error) => {
    console.error(`Error loading ${label}:`, error);
    return undefined;
  });
}

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
  const [teams, setTeams] = useState<Team[]>([]);
  const [assignments, setAssignments] = useState<AppraisalAssignment[]>([]);
  const [employeeProfiles, setEmployeeProfiles] = useState<EmployeeProfile[]>([]);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const lastLoadedAt = useRef(0);

  const load = useCallback(async (groups: Set<DataGroup>) => {
    const tasks: Promise<void>[] = [];
    // Photos fill in after the page is shown; they are the largest download.
    let profiles: Promise<void> = Promise.resolve();

    if (groups.has('people')) {
      tasks.push(
        settle(getEmployees(), 'employees').then((next) => {
          if (!next) return;
          // Auto-set Reports to = department leader when not set (in memory for app state)
          const normalized = next.map((e) => {
            if (e.teamId && !e.reportsTo) {
              const leaderId = getDepartmentLeaderId(e.teamId, next);
              if (leaderId && leaderId !== e.id) return { ...e, reportsTo: leaderId };
            }
            return e;
          });
          setEmployees((prev) => (normalized.length > 0 ? normalized : prev.length > 0 ? prev : normalized));
        }),
        settle(getTeams(), 'teams').then((next) => next && setTeams(next))
      );
    }

    if (groups.has('profiles')) {
      profiles = settle(getEmployeeProfiles(), 'employee profiles').then((next) => {
        // Never replace with empty when we already have profiles (keeps directory visible)
        if (!next) return;
        setEmployeeProfiles((prev) => (next.length > 0 ? next : prev.length > 0 ? prev : next));
        setProfilesLoaded(true);
      });
    }

    if (groups.has('work')) {
      tasks.push(
        settle(getTemplates(), 'templates').then((next) => next && setTemplates(next)),
        settle(getReviewPeriods(), 'review periods').then((next) => next && setReviewPeriods(next)),
        Promise.all([
          settle(getAppraisals(), 'appraisals'),
          settle(getLinks(), 'appraisal links'),
          settle(getAppraisalAssignments(), 'appraisal forms'),
        ]).then(([loadedAppraisals, loadedLinks, loadedAssignments]) => {
          if (loadedAppraisals) setAppraisals(loadedAppraisals);
          const known = loadedAppraisals ?? [];
          if (loadedLinks) {
            const appraisalIds = new Set(known.map((a) => a.id));
            setLinks(loadedLinks.map((l) => (isLinkDone(l, appraisalIds) ? { ...l, used: true } : l)));
          }
          if (loadedAssignments) setAssignments(effectiveAssignments(loadedAssignments, known));
        })
      );
    }

    if (groups.has('settings')) {
      tasks.push(
        settle(getSettings(), 'settings').then((loadedSettings) => {
          if (!loadedSettings) return;
          setSettings(loadedSettings);
          if (loadedSettings.accentColor) applyAccentColor(loadedSettings.accentColor);
        })
      );
    }

    await Promise.all(tasks);
    setLoading(false);
    await profiles;
    if (groups.size === ALL_GROUPS.length) lastLoadedAt.current = Date.now();
  }, []);

  const pending = useRef(new Set<DataGroup>());
  const scheduled = useRef<Promise<void> | null>(null);
  const running = useRef<Promise<void>>(Promise.resolve());

  const refresh = useCallback(
    (groups?: DataGroup[]) => {
      for (const group of Array.isArray(groups) ? groups : ALL_GROUPS) pending.current.add(group);
      if (scheduled.current) return scheduled.current;
      const next = running.current.then(async () => {
        scheduled.current = null;
        const batch = new Set(pending.current);
        pending.current.clear();
        await load(batch);
      });
      scheduled.current = next;
      running.current = next.catch(() => {});
      return next;
    },
    [load]
  );

  useEffect(() => {
    refresh();

    const on = (groups: DataGroup[]) => () => {
      refresh(groups);
    };
    // Renaming a person also renames them on their forms, so employee changes reload work data too.
    const listeners: Array<[string, () => void]> = [
      ['employeeCreated', on(['people', 'work'])],
      ['employeeUpdated', on(['people', 'work'])],
      ['userCreated', on(['people'])],
      ['userUpdated', on(['people'])],
      ['teamCreated', on(['people'])],
      ['teamUpdated', on(['people'])],
      ['employeeProfileUpdated', on(['profiles'])],
    ];
    for (const [event, handler] of listeners) window.addEventListener(event, handler);

    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoadedAt.current > STALE_AFTER_MS) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      for (const [event, handler] of listeners) window.removeEventListener(event, handler);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const activePeriods = useMemo(() => reviewPeriods.filter((p) => p.status === 'active'), [reviewPeriods]);

  // "View as" a staff member: show only the rows the database would return to them (mirrors the RLS policies).
  const { user, viewAs } = useUser();
  const scopeTo = viewAs && viewAs.user.role !== 'admin' ? viewAs.employee.id : null;
  const scoped = useMemo(() => {
    if (!scopeTo) return { appraisals, links, assignments };
    return {
      appraisals: appraisals.filter((a) => a.appraiserId === scopeTo),
      links: links.filter((l) => l.appraiserId === scopeTo),
      assignments: assignments.filter((a) => a.appraiserId === scopeTo),
    };
  }, [scopeTo, appraisals, links, assignments]);

  // Staff see their own results only as server-made summaries (no reviewers, no individual forms).
  const [myResults, setMyResults] = useState<MyPeriodResult[]>([]);
  const resultsFor = user?.employeeId ? (viewAs ? viewAs.employee.id : 'self') : null;
  useEffect(() => {
    if (!resultsFor) {
      setMyResults([]);
      return;
    }
    let cancelled = false;
    getMyResults(resultsFor === 'self' ? undefined : resultsFor)
      .then((results) => !cancelled && setMyResults(results))
      .catch((error) => console.error('Could not load your results:', error));
    return () => {
      cancelled = true;
    };
  }, [resultsFor, appraisals]);

  const value = useMemo(
    () => ({ templates, employees, ...scoped, myResults, settings, reviewPeriods, activePeriods, teams, employeeProfiles, profilesLoaded, loading, refresh }),
    [templates, employees, scoped, myResults, settings, reviewPeriods, activePeriods, teams, employeeProfiles, profilesLoaded, loading, refresh]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
