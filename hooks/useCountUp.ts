'use client';

import { useRef, type RefObject } from 'react';
import { gsap, MOTION, useGSAP } from './useGsap';

/** Writes into the existing text node (React keeps owning it; replacing it would detach React). */
const writeText = (node: Text, value: string): void => {
  node.nodeValue = value;
};

/**
 * Tweens the number shown in `ref` from its previous value to `value`. It writes to the text node
 * React rendered (nodeValue), never replacing it, so React stays in control of the element.
 * Reduced motion: the number swaps immediately with a short opacity fade.
 */
export function useCountUp(
  ref: RefObject<HTMLElement | null>,
  value: number,
  format: (value: number) => string,
  reduced: boolean,
): void {
  const previous = useRef(value);
  const tween = useRef<gsap.core.Tween | null>(null);

  useGSAP(
    () => {
      const from = previous.current;
      previous.current = value;
      const element = ref.current;
      const text = element?.firstChild;
      if (from === value || !element || !(text instanceof Text)) return;

      tween.current?.kill();
      if (reduced) {
        tween.current = gsap.fromTo(element, { opacity: 0.35 }, { opacity: 1, duration: MOTION.fade });
        return;
      }
      const state = { current: from };
      writeText(text, format(from));
      tween.current = gsap.to(state, {
        current: value,
        duration: MOTION.count,
        ease: 'power2.out',
        onUpdate: () => {
          writeText(text, format(state.current));
        },
        onComplete: () => {
          writeText(text, format(value));
        },
      });
    },
    { dependencies: [value] },
  );
}
