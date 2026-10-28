'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { THEMES, type Theme } from '@/lib/theme';
import { currentTheme, setTheme, subscribeTheme, syncStoredTheme } from '@/lib/client/theme';

const themeLabel = (theme: Theme): string => (theme === 'day' ? 'Day' : 'Night');

/** Day / Night segmented control. `serverTheme` is what the server rendered (from the cookie). */
export function ThemeToggle({ serverTheme }: { serverTheme: Theme | null }) {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => serverTheme ?? 'day');

  useEffect(() => {
    syncStoredTheme();
  }, []);

  return (
    <fieldset className="segmented theme-toggle" aria-label="Colour theme">
      <legend className="sr-only">Colour theme</legend>
      {THEMES.map((option) => (
        <label key={option} className="segmented-option">
          <input
            type="radio"
            name="theme"
            value={option}
            checked={theme === option}
            onChange={() => setTheme(option)}
          />
          <span>{themeLabel(option)}</span>
        </label>
      ))}
    </fieldset>
  );
}
