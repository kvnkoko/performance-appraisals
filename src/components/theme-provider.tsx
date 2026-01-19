import { useEffect } from 'react';
import { getSettings } from '@/lib/storage';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    async function initTheme() {
      const settings = await getSettings();
      const root = document.documentElement;
      const resolved = settings.theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        : settings.theme;

      if (resolved === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
    initTheme();
  }, []);

  return <>{children}</>;
}
