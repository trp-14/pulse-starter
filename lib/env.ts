import 'server-only';
import { z } from 'zod';

// Empty strings count as "not set" so a copied .env.example (all blank) means mock mode.
const optional = <T extends z.ZodType<string>>(schema: T) =>
  z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), schema.optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: optional(
    z
      .string()
      .max(2048)
      .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// or postgresql:// connection string'),
  ),
  UPSTASH_REDIS_REST_URL: optional(z.url({ protocol: /^https$/ }).max(2048)),
  UPSTASH_REDIS_REST_TOKEN: optional(z.string().min(10).max(4096)),
});

export type DataMode = 'real' | 'mock';

export interface ServerEnv {
  nodeEnv: 'development' | 'production' | 'test';
  db: { mode: 'real'; url: string } | { mode: 'mock' };
  redis: { mode: 'real'; url: string; token: string } | { mode: 'mock' };
}

function loadEnv(): ServerEnv {
  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  if (!parsed.success) {
    // Only variable names and rule messages: never the values themselves.
    const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration. ${problems}. See .env.example.`);
  }

  const { NODE_ENV, DATABASE_URL, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = parsed.data;

  return {
    nodeEnv: NODE_ENV,
    db: DATABASE_URL ? { mode: 'real', url: DATABASE_URL } : { mode: 'mock' },
    redis:
      UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN
        ? { mode: 'real', url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN }
        : { mode: 'mock' },
  };
}

export const env: ServerEnv = loadEnv();
