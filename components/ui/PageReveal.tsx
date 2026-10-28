'use client';

import { gsap, MOTION, useGSAP } from '@/hooks/useGsap';
import { prefersReducedMotion } from '@/hooks/useReducedMotion';

const markRevealed = (elements: HTMLElement[]) => {
  for (const element of elements) element.dataset.revealed = 'true';
};

/**
 * Page-load choreography, under 1s: [data-reveal] elements fade in with a 12px rise
 * (0.06s stagger, power3.out); glass sheens fade in last. Reduced motion → plain opacity fade.
 * CSS hides these until `data-revealed` is set; fromTo() first pins them at opacity 0 inline,
 * then the flag is set, so there is never a frame where they flash or vanish.
 */
export function PageReveal() {
  useGSAP(() => {
    const targets = gsap.utils.toArray<HTMLElement>('[data-reveal]');
    const sheens = gsap.utils.toArray<HTMLElement>('.glass-sheen');

    if (prefersReducedMotion()) {
      gsap.fromTo([...targets, ...sheens], { opacity: 0 }, { opacity: 1, duration: MOTION.fade, clearProps: 'opacity' });
    } else {
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .fromTo(
          targets,
          { opacity: 0, y: 12 },
          {
            opacity: 1,
            y: 0,
            duration: MOTION.reveal,
            stagger: MOTION.revealStagger,
            // Hand transform back to CSS afterwards (the hover lift uses it).
            clearProps: 'opacity,transform',
          },
        )
        .fromTo(sheens, { opacity: 0 }, { opacity: 1, duration: 0.25, clearProps: 'opacity' }, 0.7);
    }
    markRevealed([...targets, ...sheens]);
  });

  return null;
}
