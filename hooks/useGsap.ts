'use client';

// Single place where GSAP and its plugins are registered. Components import from here, and all
// animation code runs inside useGSAP (automatic cleanup via gsap.context on unmount/re-run).
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(useGSAP, Flip);

/** Durations shared by every animation (seconds). */
export const MOTION = {
  reveal: 0.4,
  revealStagger: 0.06,
  fade: 0.3,
  count: 0.9,
  flip: 0.6,
  rushMs: 8_000,
} as const;

export { Flip, gsap, useGSAP };
