import { useEffect } from 'react';
import { getSettings } from '@/lib/storage';
import { applyAccentColor } from '@/lib/utils';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    async function initTheme() {
      const settings = await getSettings();
      const root = document.documentElement;
      
      // Apply theme (light/dark)
      const resolved = settings.theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        : settings.theme;

      if (resolved === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      
      // Apply accent color
      if (settings.accentColor) {
        applyAccentColor(settings.accentColor);
      }
    }
    initTheme();
  }, []);

  return <>{children}</>;
}
