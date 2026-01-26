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
  X,
  Moon,
  Sun,
  House,
  ClipboardText,
  ChartLineUp,
  UsersThree,
  SignOut
} from 'phosphor-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useTheme } from '@/hooks/use-theme';
import { useApp } from '@/contexts/app-context';
import { useUser } from '@/contexts/user-context';

// Admin navigation items
const adminNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: SquaresFour },
  { path: '/templates', label: 'Templates', icon: FileText },
  { path: '/employees', label: 'Employees', icon: Users },
  { path: '/teams', label: 'Teams', icon: UsersThree },
  { path: '/users', label: 'Users', icon: UserCircle },
  { path: '/links', label: 'Appraisal Links', icon: LinkIcon },
  { path: '/periods', label: 'Review Periods', icon: Calendar },
  { path: '/reviews', label: 'Reviews', icon: ChartBar },
  { path: '/historical', label: 'Historical Reviews', icon: Clock },
  { path: '/settings', label: 'Settings', icon: Gear },
];

// Employee navigation items (non-admin users)
const employeeNavItems = [
  { path: '/my-dashboard', label: 'Dashboard', icon: House },
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
  const { user, logout } = useUser();
  
  // Get user info from context or localStorage
  const userName = user?.name || localStorage.getItem('userName') || 'Admin';
  const userEmail = user?.email || localStorage.getItem('userEmail') || user?.username || 'admin@example.com';
  const userRole = user?.role || localStorage.getItem('userRole') || 'admin';
  const employeeId = user?.employeeId || localStorage.getItem('employeeId');
  
  // Get employee info if linked
  const linkedEmployee = employeeId ? employees.find(e => e.id === employeeId) : null;
  
  // Determine if user is admin (either role is 'admin' or they logged in with PIN)
  const isAdmin = userRole === 'admin';
  
  // Use appropriate navigation based on role
  const navItems = isAdmin ? adminNavItems : employeeNavItems;

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };
  
  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  // Use accent color from settings or theme
  const currentAccentColor = settings.accentColor || accentColor || '#3B82F6';

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
        {/* Left gradient border - uses accent color */}
        <div 
          className="absolute left-0 top-0 bottom-0 w-[1px] opacity-60"
          style={{ 
            background: `linear-gradient(to bottom, ${currentAccentColor}50, ${currentAccentColor}30, transparent)` 
          }} 
        />
        
        <div className="flex h-full flex-col">
          {/* Header with logo and theme toggle */}
          <div className="px-6 pt-6 pb-4 border-b border-border/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {/* Logo - uses accent color */}
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ 
                    background: `linear-gradient(135deg, ${currentAccentColor}, ${currentAccentColor}CC)` 
                  }}
                >
                  <span className="text-white font-bold text-lg">
                    {settings.name ? settings.name.charAt(0).toUpperCase() : 'A'}
                  </span>
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
            {/* User info */}
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground">{userName}</div>
              <div className="text-xs text-muted-foreground">{userEmail}</div>
              {isAdmin ? (
                <div className="text-xs font-medium" style={{ color: currentAccentColor }}>
                  Administrator
                </div>
              ) : linkedEmployee ? (
                <div className="text-xs text-muted-foreground">
                  {linkedEmployee.hierarchy.charAt(0).toUpperCase() + linkedEmployee.hierarchy.slice(1)} • {linkedEmployee.role}
                </div>
              ) : null}
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
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                  style={isActive ? { 
                    backgroundColor: `${currentAccentColor}20`
                  } : undefined}
                >
                  {/* Active indicator bar - uses accent color */}
                  {isActive && (
                    <div 
                      className="absolute left-0 top-1 bottom-1 w-1 rounded-r"
                      style={{ backgroundColor: currentAccentColor }}
                    />
                  )}
                  <Icon 
                    size={20} 
                    weight={isActive ? 'duotone' : 'regular'}
                    className="relative z-10"
                    style={isActive ? { color: currentAccentColor } : undefined}
                  />
                  <span className="relative z-10">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          
          {/* Logout Button */}
          <div className="px-4 py-4 border-t border-border/30">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
            >
              <SignOut size={20} weight="duotone" />
              <span>Sign Out</span>
            </button>
          </div>
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
