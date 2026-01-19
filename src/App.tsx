import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@/contexts/app-context';
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
import { LinksPage } from '@/pages/links';
import { PeriodsPage } from '@/pages/periods';
import { ReviewsPage } from '@/pages/reviews';
import { HistoricalReviewsPage } from '@/pages/historical-reviews';
import { SettingsPage } from '@/pages/settings';
import { AppraisalFormPage } from '@/pages/appraisal-form';

function PrivateRoute({ children }: { children: React.ReactElement }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthenticated(localStorage.getItem('authenticated') === 'true');
  }, []);

  if (authenticated === null) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return authenticated ? children : <Navigate to="/auth" replace />;
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
        <AppProvider>
          <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/appraisal/:token"
          element={<AppraisalFormPage />}
        />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <MainLayout>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/templates" element={<TemplatesPage />} />
                  <Route path="/employees" element={<EmployeesPage />} />
                  <Route path="/links" element={<LinksPage />} />
                  <Route path="/periods" element={<PeriodsPage />} />
                  <Route path="/reviews" element={<ReviewsPage />} />
                  <Route path="/historical" element={<HistoricalReviewsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </MainLayout>
            </PrivateRoute>
          }
        />
          </Routes>
        </AppProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
