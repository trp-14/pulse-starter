'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/hooks/useGsap';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useRushMode } from '@/hooks/useRushMode';

const RUSH_TIME_SCALE = 2.4;

/**
 * Decorative atmosphere: sky band, clouds, glossy bubbles, grass glow. The bubbles' slow drift
 * (8–10s, ease-in-out, alternate) is the only ambient loop; RUSH MODE speeds it up temporarily.
 * Reduced motion: no drift at all.
 */
export function Sky() {
  const skyRef = useRef<HTMLDivElement>(null);
  const drift = useRef<gsap.core.Tween[]>([]);
  const reduced = useReducedMotion();
  const rush = useRushMode();

  useGSAP(
    () => {
      drift.current = [];
      if (reduced) return;
      gsap.utils.toArray<HTMLElement>('[data-bubble]').forEach((bubble, index) => {
        drift.current.push(
          gsap.to(bubble, {
            y: -(14 + index * 6),
            x: index % 2 === 0 ? 6 : -6,
            duration: gsap.utils.random(8, 10),
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            delay: index * 0.7,
          }),
        );
      });
    },
    { dependencies: [reduced], scope: skyRef, revertOnUpdate: true },
  );

  useGSAP(
    () => {
      for (const tween of drift.current) {
        gsap.to(tween, { timeScale: rush.active ? RUSH_TIME_SCALE : 1, duration: 1.2, ease: 'sine.inOut' });
      }
    },
    { dependencies: [rush.active] },
  );

  return (
    <div className="sky" ref={skyRef} aria-hidden="true">
      <span className="cloud cloud-1" />
      <span className="cloud cloud-2" />
      <span className="cloud cloud-3" />
      <span className="grass" />
      <span className="bubble bubble-1" data-bubble />
      <span className="bubble bubble-2" data-bubble />
      <span className="bubble bubble-3" data-bubble />
      <span className="bubble bubble-4" data-bubble />
    </div>
  );
}
