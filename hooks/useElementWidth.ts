'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Tracks an element's content width. Starts at `fallback` (also what the server renders) with
 * `measured = false`, then follows the real width, so SVG text stays at its true size everywhere.
 * Callers hide size-dependent drawing until `measured` to avoid a visible jump.
 */
export function useElementWidth<T extends HTMLElement>(fallback: number): [RefObject<T | null>, number, boolean] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(0, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width ?? fallback, width !== null];
}
