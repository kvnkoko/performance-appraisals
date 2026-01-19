import { Link, useLocation } from 'react-router-dom';
import { 
  SquaresFour,
  FileText,
  Users,
  Link as LinkIcon,
  ChartBar,
  Gear,
  Calendar,
  Clock,
  List,
  X,
  Moon,
  Sun
} from 'phosphor-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { useApp } from '@/contexts/app-context';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: SquaresFour },
  { path: '/templates', label: 'Templates', icon: FileText },
  { path: '/employees', label: 'Employees', icon: Users },
  { path: '/links', label: 'Appraisal Links', icon: LinkIcon },
  { path: '/periods', label: 'Review Periods', icon: Calendar },
  { path: '/reviews', label: 'Reviews', icon: ChartBar },
  { path: '/historical', label: 'Historical Reviews', icon: Clock },
  { path: '/settings', label: 'Settings', icon: Gear },
];

export function Sidebar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const { settings } = useApp();
  
  // Get user email from localStorage or use default
  const userEmail = localStorage.getItem('userEmail') || 'admin@example.com';

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 hover:bg-accent/30 transition-all shadow-soft"
      >
        {mobileOpen ? <X size={20} weight="duotone" /> : <List size={20} weight="duotone" />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-60 bg-background border-r border-border/30 transition-transform duration-300',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Left gradient border - subtle reddish-pink gradient */}
        <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-pink-500/30 via-rose-500/20 to-transparent opacity-60" />
        
        <div className="flex h-full flex-col">
          {/* Header with logo and theme toggle */}
          <div className="px-6 pt-6 pb-4 border-b border-border/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {/* Logo */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">A</span>
                </div>
                <h1 className="text-lg font-semibold text-foreground">
                  {settings.name || 'Appraisals'}
                  <span className="text-xs text-muted-foreground ml-1">®</span>
                </h1>
              </div>
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                aria-label="Toggle theme"
              >
                {resolvedTheme === 'dark' ? (
                  <Moon size={18} weight="duotone" className="text-foreground" />
                ) : (
                  <Sun size={18} weight="duotone" className="text-foreground" />
                )}
              </button>
            </div>
            {/* User email */}
            <div className="text-sm text-muted-foreground">
              {userEmail}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative',
                    isActive
                      ? 'bg-purple-500/20 text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <div className="absolute left-0 top-1 bottom-1 w-1 bg-purple-500 rounded-r" />
                  )}
                  <Icon 
                    size={20} 
                    weight={isActive ? 'duotone' : 'regular'}
                    className={cn(
                      'relative z-10',
                      isActive ? 'text-purple-500' : ''
                    )} 
                  />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
