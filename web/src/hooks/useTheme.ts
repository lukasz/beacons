import { useState, useEffect, useCallback } from 'react';
import { storage } from '../lib/storage';

type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  const stored = storage.read('theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark'; // Default: Geek Mode
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    storage.write('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
