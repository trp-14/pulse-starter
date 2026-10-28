// Day/Night theme. The choice lives in localStorage (spec) and is mirrored in a cookie so the
// server can render <html data-theme> on the next visit: no flash and no inline script.
// With no stored choice the CSS follows prefers-color-scheme (see app/styles/tokens.css).
import { THEMES, THEME_COOKIE, type Theme } from '@/lib/theme';

const STORAGE_KEY = 'pulse-theme';
const CHANGE_EVENT = 'pulse:theme';
const ONE_YEAR_SECONDS = 31_536_000;

const isTheme = (value: unknown): value is Theme => typeof value === 'string' && THEMES.some((theme) => theme === value);

function readStored(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
}

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  // A UI preference, not a credential: readable by JS by design, SameSite=Lax.
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}

/** The theme currently on screen. */
export function currentTheme(): Theme {
  const attribute = document.documentElement.dataset.theme;
  return isTheme(attribute) ? attribute : systemTheme();
}

export function setTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode / blocked storage: the cookie and the attribute still carry the choice.
  }
  apply(theme);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export const toggleTheme = (): void => setTheme(currentTheme() === 'night' ? 'day' : 'night');

/** If localStorage has a choice the server didn't know about (cookie cleared), restore it. */
export function syncStoredTheme(): void {
  const stored = readStored();
  if (stored && document.documentElement.dataset.theme !== stored) {
    apply(stored);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function subscribeTheme(listener: () => void): () => void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('storage', listener);
  media.addEventListener('change', listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('storage', listener);
    media.removeEventListener('change', listener);
  };
}
