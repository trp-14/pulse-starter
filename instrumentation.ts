// Runs once when the server starts: validate the environment so a misconfiguration fails fast
// with a clear message, instead of on the first request.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./lib/env');
  }
}
