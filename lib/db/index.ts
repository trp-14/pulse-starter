import 'server-only';
import { env } from '@/lib/env';
import { createMockRepository } from './mock-repository';
import { createNeonRepository } from './neon-repository';
import type { Repository } from './repository';

export type { Repository } from './repository';

let repository: Repository | undefined;

/** Neon when DATABASE_URL is set, otherwise the seeded in-memory store. Chosen by env, never by a flag. */
export function getRepository(): Repository {
  repository ??= env.db.mode === 'real' ? createNeonRepository(env.db.url) : createMockRepository();
  return repository;
}
