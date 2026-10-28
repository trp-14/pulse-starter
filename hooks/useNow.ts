'use client';

import { useEffect, useState } from 'react';

/**
 * A clock for relative timestamps. The first render uses `initial` (the server's
 * `generatedAt`), so server and client HTML match; afterwards it ticks every `intervalMs`.
 */
export function useNow(initial: number, intervalMs = 1_000): number {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
