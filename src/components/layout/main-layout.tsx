import { ReactNode, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { List, X } from 'phosphor-react';
import { Sidebar } from './sidebar';
import { ToastContainer } from '@/components/ui/toast';
import { useToast } from '@/contexts/toast-context';

const PATH_TO_TITLE: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/templates': 'Templates',
  '/employees': 'Employees',
  '/teams': 'Teams',
  '/users': 'Users',
  '/links': 'Send Appraisals',
  '/periods': 'Review Periods',
  '/reviews': 'Reviews',
  '/historical': 'Historical Reviews',
  '/submission-tracker': 'Submission Tracker',
  '/my-dashboard': 'My Dashboard',
  '/my-appraisals': 'My Appraisals',
  '/my-performance': 'My Performance',
  '/directory': 'Directory',
  '/org-chart': 'Organization chart',
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
  const { toasts, dismiss } = useToast();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pageTitle = getPageTitle(location.pathname);

  return (
    <>
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
      <main className="h-screen overflow-y-auto ml-0 lg:ml-60 bg-background text-foreground flex flex-col scrollbar-gutter-stable">
        <div className="flex-1 flex flex-col min-h-0 w-full pt-20 px-4 pb-10 sm:px-6 sm:pb-12 lg:pt-8 lg:px-8 lg:pb-16">
          {children}
        </div>
      </main>
      <ToastContainer toasts={toasts} onClose={dismiss} />
    </>
  );
}
