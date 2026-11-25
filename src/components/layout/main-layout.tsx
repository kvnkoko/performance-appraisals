import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { List, WarningCircle, X } from 'phosphor-react';
import { Sidebar } from './sidebar';
import { useUser } from '@/contexts/user-context';

const PATH_TO_TITLE: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/templates': 'Templates',
  '/teams': 'Teams',
  '/links': 'Send Appraisals',
  '/periods': 'Review Periods',
  '/reviews': 'Reviews',
  '/submission-tracker': 'Submission Tracker',
  '/my-dashboard': 'My Dashboard',
  '/my-appraisals': 'My Appraisals',
  '/my-performance': 'My Performance',
  '/directory': 'Directory',
  '/org-chart': 'Organization chart',
  '/profile': 'Profile',
  '/organization-analytics': 'Organization Analytics',
  '/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  if (PATH_TO_TITLE[pathname]) return PATH_TO_TITLE[pathname];
  const base = pathname.slice(1).split('/')[0] || '';
  const fallback = base.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (PATH_TO_TITLE[`/${base}`] ?? fallback) || 'App';
}

export function MainLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAdmin: checkIsAdmin } = useUser();
  const pageTitle =
    location.pathname === '/directory' && checkIsAdmin()
      ? 'People'
      : getPageTitle(location.pathname);
  const [cloudSyncError, setCloudSyncError] = useState(false);

  useEffect(() => {
    const onError = () => setCloudSyncError(true);
    window.addEventListener('cloudSyncError', onError);
    return () => window.removeEventListener('cloudSyncError', onError);
  }, []);

  return (
    <div className="flex-1 min-h-0 min-h-screen min-h-[100dvh] w-full max-w-full min-w-0 flex flex-col overflow-x-hidden">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      {/* Mobile top bar: hamburger + page title so content doesn't shift and title is never covered */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center gap-3 px-4 bg-background border-b border-border/60 shadow-sm"
        aria-label="Page header"
      >
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex-shrink-0 p-2.5 -ml-1 rounded-lg hover:bg-muted text-foreground transition-colors"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X size={22} weight="duotone" /> : <List size={22} weight="duotone" />}
        </button>
        <h1 className="text-lg font-semibold text-foreground truncate flex-1 min-w-0">
          {pageTitle}
        </h1>
      </header>
      <main className="flex-1 min-h-0 min-w-0 w-full lg:w-[calc(100%-15rem)] lg:ml-60 overflow-y-auto overflow-x-hidden bg-background text-foreground flex flex-col scrollbar-gutter-stable overflow-anchor-none">
        <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full max-w-full pt-20 px-4 pb-10 sm:px-6 sm:pb-12 lg:pt-8 lg:px-8 lg:pb-16 overflow-x-hidden">
          {cloudSyncError && (
            <div role="alert" className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              <WarningCircle size={20} weight="duotone" className="mt-0.5 shrink-0 text-amber-600" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">Couldn't reach the server</p>
                <p className="text-muted-foreground">
                  You're seeing the last saved copy, which may be out of date. Changes can't be saved until the connection is back.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-foreground hover:bg-amber-500/20"
              >
                Retry
              </button>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
