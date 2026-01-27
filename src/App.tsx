import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@/contexts/app-context';
import { UserProvider } from '@/contexts/user-context';
import { ToastProvider } from '@/contexts/toast-context';
import { ThemeProvider } from '@/components/theme-provider';
import { MainLayout } from '@/components/layout/main-layout';
import { AuthPage } from '@/pages/auth';
import { Dashboard } from '@/pages/dashboard';
import { initDB } from '@/lib/storage';
import { sampleEmployees, sampleTemplates } from '@/lib/sample-data';
import { getEmployees, getTemplates, saveEmployee, saveTemplate } from '@/lib/storage';

// Import pages directly for now (can be lazy loaded later if needed)
import { TemplatesPage } from '@/pages/templates';
import { EmployeesPage } from '@/pages/employees';
import { UsersPage } from '@/pages/users';
import { LinksPage } from '@/pages/links';
import { PeriodsPage } from '@/pages/periods';
import { ReviewsPage } from '@/pages/reviews';
import { HistoricalReviewsPage } from '@/pages/historical-reviews';
import { SettingsPage } from '@/pages/settings';
import { AppraisalFormPage } from '@/pages/appraisal-form';
import { TeamsPage } from '@/pages/teams';
import { EmployeeDashboardPage } from '@/pages/employee-dashboard';
import { MyAppraisalsPage } from '@/pages/my-appraisals';
import { MyPerformancePage } from '@/pages/my-performance';
import { useUser } from '@/contexts/user-context';

function PrivateRoute({ children }: { children: React.ReactElement }) {
  const { user, loading } = useUser();

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const authenticated = localStorage.getItem('authenticated') === 'true';
  
  return authenticated ? children : <Navigate to="/auth" replace />;
}

// Admin-only route wrapper
function AdminRoute({ children }: { children: React.ReactElement }) {
  const { user, loading } = useUser();
  
  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  
  const userRole = user?.role || localStorage.getItem('userRole');
  
  if (userRole !== 'admin') {
    return <Navigate to="/my-dashboard" replace />;
  }
  
  return children;
}

// Smart redirect based on user role
function RoleBasedRedirect() {
  const userRole = localStorage.getItem('userRole');
  
  if (userRole === 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Navigate to="/my-dashboard" replace />;
}

// If admin hits /my-dashboard (e.g. bookmark or back), send to admin dashboard so Vercel and localhost match
function MyDashboardOrRedirect() {
  const { user, loading } = useUser();
  const userRole = user?.role || localStorage.getItem('userRole');
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (userRole === 'admin') return <Navigate to="/dashboard" replace />;
  return <EmployeeDashboardPage />;
}

function App() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function initialize() {
      try {
        await initDB();
        
        // Load sample data if database is empty
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
    <ThemeProvider>
      <ToastProvider>
        <UserProvider>
          <AppProvider>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/appraisal/:token" element={<AppraisalFormPage />} />
              <Route
                path="/*"
                element={
                  <PrivateRoute>
                    <MainLayout>
                      <Routes>
                        {/* Admin routes */}
                        <Route path="/dashboard" element={<AdminRoute><Dashboard /></AdminRoute>} />
                        <Route path="/templates" element={<AdminRoute><TemplatesPage /></AdminRoute>} />
                        <Route path="/employees" element={<AdminRoute><EmployeesPage /></AdminRoute>} />
                        <Route path="/teams" element={<AdminRoute><TeamsPage /></AdminRoute>} />
                        <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
                        <Route path="/links" element={<AdminRoute><LinksPage /></AdminRoute>} />
                        <Route path="/periods" element={<AdminRoute><PeriodsPage /></AdminRoute>} />
                        <Route path="/reviews" element={<AdminRoute><ReviewsPage /></AdminRoute>} />
                        <Route path="/historical" element={<AdminRoute><HistoricalReviewsPage /></AdminRoute>} />
                        
                        {/* Employee routes — admins always see admin dashboard instead */}
                        <Route path="/my-dashboard" element={<MyDashboardOrRedirect />} />
                        <Route path="/my-appraisals" element={<MyAppraisalsPage />} />
                        <Route path="/my-performance" element={<MyPerformancePage />} />
                        
                        {/* Shared routes */}
                        <Route path="/settings" element={<SettingsPage />} />
                        
                        {/* Smart redirect based on role */}
                        <Route path="/" element={<RoleBasedRedirect />} />
                        
                        {/* Catch-all route for unmatched paths */}
                        <Route path="*" element={<RoleBasedRedirect />} />
                      </Routes>
                    </MainLayout>
                  </PrivateRoute>
                }
              />
            </Routes>
          </AppProvider>
        </UserProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
