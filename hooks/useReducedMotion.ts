'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(listener: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

const getSnapshot = (): boolean => window.matchMedia(QUERY).matches;

/**
 * True when the user asked for reduced motion. The server assumes "reduce" so nothing ever
 * animates before we know; motion is then enabled on the client if allowed.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}

/** Non-hook check for event handlers and GSAP callbacks. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
