import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '@/lib/storage';
import { applyAccentColor } from '@/lib/utils';

export function useTheme() {
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [accentColor, setAccentColorState] = useState<string>('#3B82F6');

  useEffect(() => {
    getSettings().then((settings) => {
      setThemeState(settings.theme);
      setAccentColorState(settings.accentColor);
      applyTheme(settings.theme);
      if (settings.accentColor) {
        applyAccentColor(settings.accentColor);
      }
    });
  }, []);

  const applyTheme = (newTheme: 'light' | 'dark' | 'system') => {
    const root = document.documentElement;
    const resolved = newTheme === 'system' 
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : newTheme;

    setResolvedTheme(resolved);
    
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  const setTheme = async (newTheme: 'light' | 'dark' | 'system') => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    const settings = await getSettings();
    await saveSettings({ ...settings, theme: newTheme });
  };

  const setAccentColor = async (color: string) => {
    setAccentColorState(color);
    applyAccentColor(color);
    const settings = await getSettings();
    await saveSettings({ ...settings, accentColor: color });
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return { theme, resolvedTheme, setTheme, accentColor, setAccentColor };
}
