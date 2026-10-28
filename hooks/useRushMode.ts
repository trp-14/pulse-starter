'use client';

import { useEffect, useState } from 'react';
import type { OrderSummary } from '@/types';
import { onRush } from '@/lib/client/events';
import { MOTION } from './useGsap';

export interface RushState {
  active: boolean;
  /** Bumps on every rush so effects can restart even if one was already running. */
  run: number;
  orders: OrderSummary[];
}

/** RUSH MODE lasts ~8 seconds after each successful "Simulate rush hour", then eases back. */
export function useRushMode(): RushState {
  const [state, setState] = useState<RushState>({ active: false, run: 0, orders: [] });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = onRush((orders) => {
      clearTimeout(timer);
      setState((previous) => ({ active: true, run: previous.run + 1, orders }));
      timer = setTimeout(() => setState((previous) => ({ ...previous, active: false })), MOTION.rushMs);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, []);

  return state;
}
