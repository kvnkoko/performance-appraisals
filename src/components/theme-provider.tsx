import { createContext, useContext, useEffect, useState } from 'react';
import { getSettings, saveSettings } from '@/lib/storage';
import { applyAccentColor } from '@/lib/utils';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (t: Theme) => Promise<void>;
  accentColor: string;
  setAccentColor: (color: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Light/dark is a per-device preference; the company setting is only the default. */
const THEME_STORAGE_KEY = 'theme';

function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : null;
  } catch {
    return null;
  }
}

function applyThemeToDOM(newTheme: Theme): 'light' | 'dark' {
  const root = document.documentElement;
  const resolved =
    newTheme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : newTheme;

  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  return resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme() ?? 'system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => applyThemeToDOM(readStoredTheme() ?? 'system'));
  const [accentColor, setAccentColorState] = useState<string>('#3B82F6');

  useEffect(() => {
    getSettings()
      .then((settings) => {
        if (!readStoredTheme() && settings.theme) {
          setThemeState(settings.theme);
          setResolvedTheme(applyThemeToDOM(settings.theme));
        }
        setAccentColorState(settings.accentColor ?? '#3B82F6');
        if (settings.accentColor) {
          applyAccentColor(settings.accentColor);
        }
      })
      .catch((error) => console.error('Could not load theme settings:', error));
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        const resolved = applyThemeToDOM('system');
        setResolvedTheme(resolved);
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    setResolvedTheme(applyThemeToDOM(newTheme));
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // storage unavailable (private mode); the choice still applies for this visit
    }
  };

  const setAccentColor = async (color: string) => {
    setAccentColorState(color);
    applyAccentColor(color);
    const settings = await getSettings();
    await saveSettings({ ...settings, accentColor: color });
  };

  const value: ThemeContextValue = {
    theme,
    resolvedTheme,
    setTheme,
    accentColor,
    setAccentColor,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return ctx;
}
