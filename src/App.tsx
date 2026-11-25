import React, { Suspense, lazy, useEffect, useState, type ComponentType } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@/contexts/app-context';
import { UserProvider } from '@/contexts/user-context';
import { ToastProvider } from '@/contexts/toast-context';
import { ThemeProvider } from '@/components/theme-provider';
import { MainLayout } from '@/components/layout/main-layout';
import { initDB } from '@/lib/storage';
import { getEmployees, getTemplates, saveEmployee, saveTemplate } from '@/lib/storage';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useUser } from '@/contexts/user-context';
import { ViewAsProvider } from '@/components/view-as/view-as';

const RELOADED_FOR_UPDATE = 'reloadedForUpdate';

/**
 * Load a page only when it is first opened. A tab left open across a deploy asks for files that
 * no longer exist; reloading once picks up the new version instead of showing a blank page.
 */
function lazyPage<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(async () => {
    try {
      const page = (await load())[name];
      sessionStorage.removeItem(RELOADED_FOR_UPDATE);
      return { default: page };
    } catch (error) {
      if (!sessionStorage.getItem(RELOADED_FOR_UPDATE)) {
        sessionStorage.setItem(RELOADED_FOR_UPDATE, '1');
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw error;
    }
  });
}

const AuthPage = lazyPage(() => import('@/pages/auth'), 'AuthPage');
const Dashboard = lazyPage(() => import('@/pages/dashboard'), 'Dashboard');
const TemplatesPage = lazyPage(() => import('@/pages/templates'), 'TemplatesPage');
const LinksPage = lazyPage(() => import('@/pages/links'), 'LinksPage');
const PeriodsPage = lazyPage(() => import('@/pages/periods'), 'PeriodsPage');
const ReviewsPage = lazyPage(() => import('@/pages/reviews'), 'ReviewsPage');
const SubmissionTrackerPage = lazyPage(() => import('@/pages/submission-tracker'), 'SubmissionTrackerPage');
const SettingsPage = lazyPage(() => import('@/pages/settings'), 'SettingsPage');
const AppraisalFormPage = lazyPage(() => import('@/pages/appraisal-form'), 'AppraisalFormPage');
const AppraisalFormByAssignmentPage = lazyPage(() => import('@/pages/appraisal-form-by-assignment'), 'AppraisalFormByAssignmentPage');
const TeamsPage = lazyPage(() => import('@/pages/teams'), 'TeamsPage');
const EmployeeDashboardPage = lazyPage(() => import('@/pages/employee-dashboard'), 'EmployeeDashboardPage');
const MyAppraisalsPage = lazyPage(() => import('@/pages/my-appraisals'), 'MyAppraisalsPage');
const MyPerformancePage = lazyPage(() => import('@/pages/my-performance'), 'MyPerformancePage');
const DirectoryPage = lazyPage(() => import('@/pages/directory/DirectoryPage'), 'DirectoryPage');
const OrgChartPage = lazyPage(() => import('@/pages/org-chart/OrgChartPage'), 'OrgChartPage');
const ProfilePage = lazyPage(() => import('@/pages/profile/ProfilePage'), 'ProfilePage');
const OrganizationAnalyticsPage = lazyPage(() => import('@/pages/organization-analytics/OrganizationAnalyticsPage'), 'OrganizationAnalyticsPage');

function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[320px]">
      <p className="text-muted-foreground text-sm font-medium">Loading…</p>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactElement }) {
  const { user, loading } = useUser();

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return user ? children : <Navigate to="/auth" replace />;
}

// Admin-only route wrapper
function AdminRoute({ children }: { children: React.ReactElement }) {
  const { user, loading } = useUser();
  
  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  
  if (user?.role !== 'admin') {
    return <Navigate to="/my-dashboard" replace />;
  }
  
  return children;
}

// Smart redirect based on user role
function RoleBasedRedirect() {
  const { user } = useUser();

  if (user?.role === 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Navigate to="/my-dashboard" replace />;
}

// Admins who are also people in the company have their own dashboard; admin-only accounts go to the overview.
function MyDashboardOrRedirect() {
  const { user, loading } = useUser();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (user?.role === 'admin' && !user.employeeId) return <Navigate to="/dashboard" replace />;
  return <EmployeeDashboardPage />;
}

function App() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function initialize() {
      try {
        await initDB();
        
        // Demo data is only for local use; never write fake people into the real database.
        if (!isSupabaseConfigured()) {
          const { sampleEmployees, sampleTemplates } = await import('@/lib/sample-data');
          const existingEmployees = await getEmployees();
          const existingTemplates = await getTemplates();

          if (existingEmployees.length === 0) {
            for (const employee of sampleEmployees) {
              await saveEmployee(employee);
            }
          }

          if (existingTemplates.length === 0) {
            for (const template of sampleTemplates) {
              await saveTemplate(template);
            }
          }
        }
      } catch (error) {
        console.error('Failed to initialize database:', error);
      } finally {
        setInitialized(true);
      }
    }

    initialize();
  }, []);

  if (!initialized) {
    return <div className="flex items-center justify-center h-screen">Initializing...</div>;
  }

  return (
    <div className="h-full min-h-screen min-h-[100dvh] flex flex-col overflow-x-hidden w-full max-w-full">
      <ThemeProvider>
        <ToastProvider>
          <UserProvider>
            <AppProvider>
              <ViewAsProvider>
              <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-x-hidden w-full max-w-full">
                <Suspense fallback={<PageLoading />}>
                <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/appraisal/assignment/:assignmentId" element={<PrivateRoute><AppraisalFormByAssignmentPage /></PrivateRoute>} />
              <Route path="/appraisal/:token" element={<AppraisalFormPage />} />
              <Route
                path="/*"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <Suspense fallback={<PageLoading />}>
                      <Routes>
                        {/* Admin routes */}
                        <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
                        <Route path="/templates" element={<AdminRoute><TemplatesPage /></AdminRoute>} />
                        <Route path="/employees" element={<Navigate to="/directory" replace />} />
                        <Route path="/teams" element={<AdminRoute><TeamsPage /></AdminRoute>} />
                        <Route path="/users" element={<Navigate to="/directory" replace />} />
                        <Route path="/links" element={<AdminRoute><LinksPage /></AdminRoute>} />
                        <Route path="/periods" element={<AdminRoute><PeriodsPage /></AdminRoute>} />
                        <Route path="/reviews" element={<AdminRoute><ReviewsPage /></AdminRoute>} />
                        <Route path="/historical" element={<Navigate to="/periods" replace />} />
                        <Route path="/submission-tracker" element={<AdminRoute><SubmissionTrackerPage /></AdminRoute>} />
                        
                        {/* Personal routes (staff, and admins who are people in the company) */}
                        <Route path="/my-dashboard" element={<MyDashboardOrRedirect />} />
                        <Route path="/my-appraisals" element={<MyAppraisalsPage />} />
                        <Route path="/my-performance" element={<MyPerformancePage />} />
                        
                        {/* Shared: Directory & Org Chart (admin + staff) */}
                        <Route path="/directory" element={<DirectoryPage />} />
                        <Route path="/org-chart" element={<OrgChartPage />} />
                        <Route path="/profile/:employeeId" element={<ProfilePage />} />
                        <Route path="/organization-analytics" element={<AdminRoute><OrganizationAnalyticsPage /></AdminRoute>} />
                        
                        {/* Shared routes */}
                        <Route path="/settings" element={<SettingsPage />} />
                        
                        {/* Smart redirect based on role */}
                        <Route path="/" element={<RoleBasedRedirect />} />
                        
                        {/* Catch-all route for unmatched paths */}
                        <Route path="*" element={<RoleBasedRedirect />} />
                      </Routes>
                      </Suspense>
                    </MainLayout>
                  </PrivateRoute>
                }
              />
                </Routes>
                </Suspense>
              </div>
              </ViewAsProvider>
            </AppProvider>
          </UserProvider>
        </ToastProvider>
      </ThemeProvider>
    </div>
  );
}

export default App;
