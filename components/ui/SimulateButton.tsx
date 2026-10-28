'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiRequestError, fetchJson } from '@/lib/client/fetch-json';
import { announceRush, requestDashboardRefresh } from '@/lib/client/events';
import { simulateResultSchema } from '@/lib/validation/responses';
import { Toast, type ToastMessage } from './Toast';

const TOAST_MS = 6_000;

const formatCountdown = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** The server message carries the limit ("You can simulate 5 rushes a minute."), keeping one source of truth. */
function rateLimitToast(serverMessage: string, seconds: number): Omit<ToastMessage, 'id'> {
  return {
    title: 'That’s a lot of rush hours.',
    body: `${serverMessage} Try again in ${seconds}s…`,
  };
}

export function SimulateButton({ className = '' }: { className?: string }) {
  const [busy, setBusy] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const remaining = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000)) : 0;
  const coolingDown = remaining > 0;

  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= cooldownUntil) setCooldownUntil(null);
    }, 1_000);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (message: Omit<ToastMessage, 'id'>) => {
    clearTimeout(toastTimer.current);
    setToast({ ...message, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  const simulate = async () => {
    setBusy(true);
    try {
      const result = await fetchJson('/api/simulate', simulateResultSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      announceRush(result.orders);
      requestDashboardRefresh();
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 429) {
        const seconds = error.retryAfterSeconds ?? 60;
        setNow(Date.now());
        setCooldownUntil(Date.now() + seconds * 1000);
        showToast(rateLimitToast(error.message, seconds));
      } else {
        const reference = error instanceof ApiRequestError && error.requestId ? ` Request ID ${error.requestId}.` : '';
        showToast({ title: 'Rush hour didn’t start.', body: `Something went wrong. Please try again.${reference}` });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {coolingDown ? (
        <button type="button" className={`btn-cooldown ${className}`} disabled aria-live="polite">
          Cooling down · {formatCountdown(remaining)}
        </button>
      ) : (
        <button
          type="button"
          className={`btn-gloss btn-simulate ${className}`}
          onClick={() => void simulate()}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? 'Starting rush…' : 'Simulate rush hour'}
        </button>
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
