import 'server-only';

type Level = 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

const SENSITIVE_KEY = /token|secret|password|authorization|cookie|database_url|connection/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (depth > 4 || value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, depth + 1));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [key, SENSITIVE_KEY.test(key) ? '[redacted]' : sanitize(inner, depth + 1)]),
  );
}

function write(level: Level, message: string, requestId: string, fields: Fields): void {
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    requestId,
    message,
    ...(sanitize(fields) as Fields),
  });
  const stream = level === 'info' ? process.stdout : process.stderr;
  stream.write(`${line}\n`);
}

/** Structured JSON logger. Every entry carries a request ID; sensitive keys are redacted. */
export const logger = {
  info: (message: string, requestId: string, fields: Fields = {}) => write('info', message, requestId, fields),
  warn: (message: string, requestId: string, fields: Fields = {}) => write('warn', message, requestId, fields),
  error: (message: string, requestId: string, fields: Fields = {}) => write('error', message, requestId, fields),
};
