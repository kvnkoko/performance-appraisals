import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Eye, MagnifyingGlass, SignOut, ArrowsLeftRight } from 'phosphor-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useApp } from '@/contexts/app-context';
import { useUser, type ViewAsTarget } from '@/contexts/user-context';
import { useToast } from '@/contexts/toast-context';
import { getUsers } from '@/lib/storage';
import { LOCKING_STATUSES } from '@/types';
import type { Employee, User } from '@/types';
import { cn } from '@/lib/utils';

type Role = Employee['hierarchy'];

const ROLE_LABELS: Record<Role, string> = {
  chairman: 'Chairman',
  executive: 'Executive',
  'department-leader': 'Department leader',
  leader: 'Team leader',
  member: 'Member',
  hr: 'HR',
};

const ROLE_ORDER: Role[] = ['chairman', 'executive', 'department-leader', 'leader', 'hr', 'member'];

const ViewAsDialogContext = createContext<{ openViewAs: () => void }>({ openViewAs: () => {} });

export function useViewAsDialog() {
  return useContext(ViewAsDialogContext);
}

/** Admin-only "View as" picker plus the banner shown while viewing as someone else. */
export function ViewAsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <ViewAsDialogContext.Provider value={{ openViewAs: () => setOpen(true) }}>
      {children}
      <ViewAsBanner onSwitch={() => setOpen(true)} />
      {open && <ViewAsDialog onClose={() => setOpen(false)} />}
    </ViewAsDialogContext.Provider>
  );
}

function ViewAsBanner({ onSwitch }: { onSwitch: () => void }) {
  const { viewAs, stopViewAs } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!viewAs) return;
    document.body.style.paddingBottom = '5rem';
    return () => {
      document.body.style.paddingBottom = '';
    };
  }, [viewAs]);

  if (!viewAs) return null;

  const role = ROLE_LABELS[viewAs.employee.hierarchy] ?? viewAs.employee.hierarchy;
  const who =
    viewAs.mode === 'role' && viewAs.role
      ? `${ROLE_LABELS[viewAs.role]} (as ${viewAs.user.name})`
      : `${viewAs.user.name} (${viewAs.user.role === 'admin' ? 'Administrator' : role})`;

  const exit = async () => {
    await stopViewAs();
    navigate('/dashboard');
  };

  return createPortal(
    <>
      <div className="pointer-events-none fixed inset-0 z-[60] border-4 border-amber-500/80" aria-hidden />
      <div
        role="status"
        className="fixed bottom-4 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 items-center gap-3 rounded-xl border border-amber-500/60 bg-amber-50 px-4 py-3 text-amber-950 shadow-2xl dark:bg-amber-950 dark:text-amber-50"
      >
        <Eye size={22} weight="duotone" className="shrink-0" />
        <div className="min-w-0 flex-1 text-sm">
          <div className="truncate font-semibold">Viewing as {who}</div>
          <div className="truncate text-xs opacity-80">
            Read-only. Nothing can be saved or submitted.
            {!viewAs.hasLogin && ' This person has no login account yet.'}
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onSwitch} className="shrink-0">
          <ArrowsLeftRight size={16} className="mr-1.5" />
          Switch
        </Button>
        <Button type="button" size="sm" onClick={exit} className="shrink-0">
          <SignOut size={16} className="mr-1.5" />
          Exit
        </Button>
      </div>
    </>,
    document.body
  );
}

function ViewAsDialog({ onClose }: { onClose: () => void }) {
  const { employees } = useApp();
  const { startViewAs, viewAs, realUser } = useUser();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'role' | 'employee'>(viewAs?.mode ?? 'role');
  const [users, setUsers] = useState<User[] | null>(null);
  const [role, setRole] = useState<Role | ''>(viewAs?.role ?? '');
  const [exampleId, setExampleId] = useState('');
  const [query, setQuery] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch((error) => {
        console.error('Could not load accounts for View as:', error);
        setUsers([]);
      });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const accountByEmployee = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of users ?? []) if (u.employeeId && u.active !== false) map.set(u.employeeId, u);
    return map;
  }, [users]);
  const accountsLoaded = users !== null;

  const candidates = useMemo(
    () =>
      employees
        .filter((e) => !LOCKING_STATUSES.includes(e.employmentStatus ?? 'permanent'))
        .filter((e) => e.id !== realUser?.employeeId)
        .sort((a, b) => a.name.trim().localeCompare(b.name.trim())),
    [employees, realUser]
  );

  const roles = ROLE_ORDER.map((r) => ({ role: r, people: candidates.filter((e) => e.hierarchy === r) })).filter(
    (r) => r.people.length > 0
  );

  const roleExamples = useMemo(() => {
    if (!role) return [];
    const people = candidates.filter((e) => e.hierarchy === role);
    // People with a staff sign-in show the most realistic view; admins see everything, so they go last.
    const rank = (e: Employee) => {
      const account = accountByEmployee.get(e.id);
      return !account ? 0 : account.role === 'admin' ? 1 : 2;
    };
    return [...people].sort((a, b) => rank(b) - rank(a));
  }, [role, candidates, accountByEmployee]);

  useEffect(() => {
    setExampleId(roleExamples[0]?.id ?? '');
  }, [roleExamples]);

  const q = query.trim().toLowerCase();
  const searchResults = q
    ? candidates.filter((e) => [e.name, e.role, e.email].some((v) => v?.toLowerCase().includes(q)))
    : candidates;

  const begin = async (target: ViewAsTarget) => {
    setStarting(true);
    try {
      await startViewAs(target);
      onClose();
      navigate('/my-dashboard');
    } catch (error) {
      toast({
        title: 'Could not start View as',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setStarting(false);
    }
  };

  const badge = (e: Employee) => {
    if (!accountsLoaded) return null;
    const account = accountByEmployee.get(e.id);
    if (!account) return <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">No login account</span>;
    if (account.role === 'admin') return <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[11px] text-primary">Admin account</span>;
    return null;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <Card className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden border-2 shadow-2xl" role="dialog" aria-modal aria-labelledby="view-as-title">
        <CardHeader className="flex-shrink-0 border-b bg-gradient-to-r from-amber-500/10 to-orange-500/10">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/20 p-2">
              <Eye size={24} weight="duotone" className="text-amber-600" />
            </div>
            <div>
              <CardTitle id="view-as-title" className="text-2xl">View as</CardTitle>
              <CardDescription className="mt-1">
                See the app exactly as someone else sees it. Read-only: nothing can be changed, and it is recorded in the audit log.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden pt-5">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist">
            {(['role', 'employee'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t === 'role' ? 'By role' : 'Specific employee'}
              </button>
            ))}
          </div>

          {tab === 'role' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="view-as-role">Role</Label>
                <Select id="view-as-role" value={role} onChange={(e) => setRole(e.target.value as Role | '')}>
                  <option value="">Choose a role…</option>
                  {roles.map((r) => (
                    <option key={r.role} value={r.role}>
                      {ROLE_LABELS[r.role]} ({r.people.length})
                    </option>
                  ))}
                </Select>
              </div>
              {role && (
                <div className="space-y-2">
                  <Label htmlFor="view-as-example">Show it through</Label>
                  <Select id="view-as-example" value={exampleId} onChange={(e) => setExampleId(e.target.value)}>
                    {roleExamples.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name.trim()}
                        {!accountsLoaded || accountByEmployee.has(e.id) ? '' : ' (no login account)'}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    What someone sees depends on their own forms and results, so the view uses one real person with this role.
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!role || !exampleId || !accountsLoaded || starting}
                  onClick={() => role && begin({ mode: 'role', role, employeeId: exampleId })}
                >
                  {starting ? 'Starting…' : 'Start viewing'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="relative">
                <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, job title, or email"
                  className="pl-9"
                  aria-label="Search employees"
                />
              </div>
              <ul className="min-h-0 flex-1 divide-y divide-border/50 overflow-y-auto rounded-lg border border-border/50">
                {searchResults.length === 0 && <li className="p-4 text-sm text-muted-foreground">No active employees match.</li>}
                {searchResults.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      disabled={starting}
                      onClick={() => begin({ mode: 'employee', employeeId: e.id })}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60 disabled:opacity-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{e.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {ROLE_LABELS[e.hierarchy] ?? e.hierarchy} · {e.role}
                        </div>
                      </div>
                      {badge(e)}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>,
    document.body
  );
}
