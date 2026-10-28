import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes one JSON line with level, time and request ID', () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    logger.info('Hello', 'req-1', { tile: 'kpis' });
    const line = String(stdout.mock.calls[0]?.[0]);
    expect(line.endsWith('\n')).toBe(true);
    expect(JSON.parse(line)).toMatchObject({ level: 'info', requestId: 'req-1', message: 'Hello', tile: 'kpis' });
  });

  it('redacts secret-looking keys at any depth and never prints their values', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    logger.error('Boom', 'req-2', {
      token: 'upstash-secret',
      nested: { DATABASE_URL: 'postgres://user:pw@host/db', authorization: 'Bearer abc', safe: 'ok' },
      list: [{ password: 'hunter2' }],
    });
    const line = String(stderr.mock.calls[0]?.[0]);
    for (const secret of ['upstash-secret', 'postgres://', 'Bearer abc', 'hunter2']) {
      expect(line).not.toContain(secret);
    }
    expect(JSON.parse(line)).toMatchObject({
      token: '[redacted]',
      nested: { DATABASE_URL: '[redacted]', authorization: '[redacted]', safe: 'ok' },
      list: [{ password: '[redacted]' }],
    });
  });

  it('serialises errors server-side only (name, message, stack)', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    logger.error('Failed', 'req-3', { error: new Error('db timeout') });
    expect(JSON.parse(String(stderr.mock.calls[0]?.[0])).error).toMatchObject({ name: 'Error', message: 'db timeout' });
  });
});
