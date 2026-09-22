'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';

type Theme = 'light' | 'dark';

function preferredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('questify_theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const nextTheme = preferredTheme();
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem('questify_theme', nextTheme);
  };

  return (
    <button type="button" onClick={toggleTheme} className={`theme-toggle ${compact ? 'compact' : ''}`} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
      {theme === 'light' ? <Icon name="moon" size={16} /> : <Icon name="sun" size={16} />}
      {!compact && <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>}
      <style jsx>{`
        .theme-toggle { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 36px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; color: var(--muted-strong); font-size: 13px; text-align: left; }
        .theme-toggle:hover { background: var(--surface-muted); color: var(--foreground); }
        .theme-toggle.compact { display: grid; place-items: center; width: 31px; height: 31px; min-height: 31px; padding: 0; }
      `}</style>
    </button>
  );
}
