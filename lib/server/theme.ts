import 'server-only';
import { cookies } from 'next/headers';
import { THEME_COOKIE, themeSchema, type Theme } from '@/lib/theme';

/** The explicit theme choice from the cookie, or null to follow prefers-color-scheme. */
export async function getServerTheme(): Promise<Theme | null> {
  const parsed = themeSchema.safeParse((await cookies()).get(THEME_COOKIE)?.value);
  return parsed.success ? parsed.data : null;
}
