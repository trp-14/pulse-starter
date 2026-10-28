import { z } from 'zod';

export const THEMES = ['day', 'night'] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = 'pulse-theme';

/** Cookie values are user-controlled input: only an exact theme name is accepted. */
export const themeSchema = z.enum(THEMES);
