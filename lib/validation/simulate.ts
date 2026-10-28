import './zod-config';
import { z } from 'zod';

export const MIN_RUSH_ORDERS = 10;
/** Hard cap on orders created per request. */
export const MAX_RUSH_ORDERS = 20;

export const simulateBodySchema = z
  .object({
    count: z.number().int().min(MIN_RUSH_ORDERS).max(MAX_RUSH_ORDERS).optional(),
  })
  .strict();

export type SimulateBody = z.infer<typeof simulateBodySchema>;
