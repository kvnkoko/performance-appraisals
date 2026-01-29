import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  SquaresFour,
  FileText,
  Users,
  UserCircle,
  Link as LinkIcon,
  ChartBar,
  Gear,
  Calendar,
  Clock,
  List,
  ListChecks,
  X,
  Moon,
  Sun,
  House,
  ClipboardText,
  ChartLineUp,
  UsersThree,
  SignOut,
  AddressBook,
  TreeStructure,
  ChartPieSlice
} from 'phosphor-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { useApp } from '@/contexts/app-context';
import { useUser } from '@/contexts/user-context';

// Shared navigation (Directory & Org Chart — admin + staff)
const sharedNavItems = [
  { path: '/directory', label: 'Directory', icon: AddressBook },
  { path: '/org-chart', label: 'Org Chart', icon: TreeStructure },
];

// Admin navigation items (Overview = system-wide dashboard)
const adminNavItems = [
  { path: '/dashboard', label: 'Overview', icon: SquaresFour },
  ...sharedNavItems,
  { path: '/templates', label: 'Templates', icon: FileText },
  { path: '/employees', label: 'Employees', icon: Users },
  { path: '/teams', label: 'Teams', icon: UsersThree },
  { path: '/users', label: 'Users', icon: UserCircle },
  { path: '/links', label: 'Appraisal Links', icon: LinkIcon },
  { path: '/periods', label: 'Review Periods', icon: Calendar },
  { path: '/reviews', label: 'Reviews', icon: ChartBar },
  { path: '/historical', label: 'Historical Reviews', icon: Clock },
  { path: '/submission-tracker', label: 'Submission Tracker', icon: ListChecks },
  { path: '/organization-analytics', label: 'Organization Analytics', icon: ChartPieSlice },
  { path: '/settings', label: 'Settings', icon: Gear },
];

// Employee navigation items (non-admin users)
const employeeNavItems = [
  { path: '/my-dashboard', label: 'My Dashboard', icon: House },
  ...sharedNavItems,
  { path: '/my-appraisals', label: 'My Appraisals', icon: ClipboardText },
  { path: '/my-performance', label: 'My Performance', icon: ChartLineUp },
  { path: '/settings', label: 'Settings', icon: Gear },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { resolvedTheme, setTheme, accentColor } = useTheme();
  const { settings, employees } = useApp();
  const { user, employee, logout, isAdmin: checkIsAdmin } = useUser();
  
  // Get user info from context or localStorage
  const userName = user?.name || localStorage.getItem('userName') || 'Admin';
  const userEmail = user?.email || localStorage.getItem('userEmail') || user?.username || 'admin@example.com';
  
  // Use the isAdmin helper from context, which properly checks both user.role and localStorage
  const isAdmin = checkIsAdmin();
  
  // Get employee info if linked (prefer context, fallback to finding in employees list)
  const linkedEmployee = employee || (user?.employeeId ? employees.find(e => e.id === user.employeeId) : null);
  
  // Use appropriate navigation based on role
  const navItems = isAdmin ? adminNavItems : employeeNavItems;
  
  // Ensure sidebar updates when user context changes
  useEffect(() => {
    // Force re-render when user or employee changes
  }, [user, employee, isAdmin]);

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };
  
  const handleLogout = () => {
    logout();
    navigate('/auth');
  };
  
  const handleNavClick = (path: string, e: React.MouseEvent) => {
    // Prevent navigation to admin-only routes for non-admin users.
    // Allow routes that appear in both admin and employee nav (e.g. Settings).
    const isAdminRoute = adminNavItems.some(item => item.path === path);
    const isEmployeeRoute = employeeNavItems.some(item => item.path === path);
    if (isAdminRoute && !isEmployeeRoute && !isAdmin) {
      e.preventDefault();
      navigate('/my-dashboard');
      return;
    }
    setMobileOpen(false);
  };

  // Use accent color from settings or theme
  const currentAccentColor = settings.accentColor || accentColor || '#3B82F6';

  return (
    <>
      {/* Mobile menu button – minimal, striking */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-card border border-border shadow-card hover:bg-surface transition-all duration-200"
      >
        {mobileOpen ? <X size={20} weight="duotone" /> : <List size={20} weight="duotone" />}
      </button>

      {/* Sidebar – Holo/Finvero-style: crisp, minimal active state */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-60 bg-card border-r border-border/40 transition-transform duration-300 shadow-dropdown',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header: logo + theme toggle */}
          <div className="px-5 pt-6 pb-5 border-b border-border/50">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold text-sm"
                  style={{ background: currentAccentColor }}
                >
                  {settings.name ? settings.name.charAt(0).toUpperCase() : 'A'}
                </div>
                <h1 className="text-base font-semibold text-foreground tracking-tight">
                  {settings.name || 'Appraisals'}
                </h1>
              </div>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-surface hover:bg-muted text-muted-foreground hover:text-foreground transition-colors duration-200"
                aria-label="Toggle theme"
              >
                {resolvedTheme === 'dark' ? (
                  <Moon size={18} weight="duotone" />
                ) : (
                  <Sun size={18} weight="duotone" />
                )}
              </button>
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-medium text-foreground">{userName}</div>
              <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
              {isAdmin ? (
                <div className="text-xs font-medium" style={{ color: currentAccentColor }}>
                  Administrator
                </div>
              ) : linkedEmployee ? (
                <div className="text-xs text-muted-foreground">
                  {linkedEmployee.hierarchy.charAt(0).toUpperCase() + linkedEmployee.hierarchy.slice(1)} · {linkedEmployee.role}
                </div>
              ) : null}
            </div>
          </div>

          {/* Navigation – active: left bar + tint like Holo/Finvero */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={(e) => handleNavClick(item.path, e)}
                  className={cn(
                    'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative',
                    isActive
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:bg-surface hover:text-foreground'
                  )}
                  style={isActive ? {
                    backgroundColor: `${currentAccentColor}18`,
                  } : undefined}
                >
                  {isActive && (
                    <div
                      className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
                      style={{ backgroundColor: currentAccentColor }}
                    />
                  )}
                  <Icon
                    size={20}
                    weight={isActive ? 'duotone' : 'regular'}
                    className="relative z-10 ml-0.5"
                    style={isActive ? { color: currentAccentColor } : undefined}
                  />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="px-3 py-4 border-t border-border/50">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-200"
            >
              <SignOut size={20} weight="duotone" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
