'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { gsap, useGSAP } from '@/hooks/useGsap';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ApiRequestError, fetchJson } from '@/lib/client/fetch-json';
import { announceRush, onSimulateRequest, requestDashboardRefresh } from '@/lib/client/events';
import { simulateResultSchema } from '@/lib/validation/responses';
import { Toast, type ToastMessage } from './Toast';

const TOAST_MS = 6_000;
const PRESS_MS = 120;
/** Magnetic hover: the button leans toward the cursor by this share of the offset, capped. */
const MAGNET_STRENGTH = 0.25;
const MAGNET_MAX_PX = 8;

const formatCountdown = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** The server message carries the limit ("You can simulate 5 rushes a minute."), keeping one source of truth. */
function rateLimitToast(serverMessage: string, seconds: number): Omit<ToastMessage, 'id'> {
  return {
    title: 'That’s a lot of rush hours.',
    body: `${serverMessage} Try again in ${seconds}s…`,
  };
}

const clamp = (value: number) => Math.max(-MAGNET_MAX_PX, Math.min(MAGNET_MAX_PX, value));

export function SimulateButton() {
  const [busy, setBusy] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const magnet = useRef<{ x: (value: number) => void; y: (value: number) => void } | null>(null);
  const reduced = useReducedMotion();

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

  useEffect(
    () => () => {
      clearTimeout(toastTimer.current);
      clearTimeout(pressTimer.current);
    },
    [],
  );

  useGSAP(
    () => {
      const button = wrapRef.current?.querySelector('button');
      magnet.current = null;
      if (reduced || !button) return;
      magnet.current = {
        x: gsap.quickTo(button, 'x', { duration: 0.35, ease: 'power3.out' }),
        y: gsap.quickTo(button, 'y', { duration: 0.35, ease: 'power3.out' }),
      };
    },
    { dependencies: [reduced, coolingDown], scope: wrapRef, revertOnUpdate: true },
  );

  const onPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    if (event.pointerType !== 'mouse') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    magnet.current?.x(clamp((event.clientX - bounds.left - bounds.width / 2) * MAGNET_STRENGTH));
    magnet.current?.y(clamp((event.clientY - bounds.top - bounds.height / 2) * MAGNET_STRENGTH));
  };

  const onPointerLeave = () => {
    magnet.current?.x(0);
    magnet.current?.y(0);
  };

  const showToast = (message: Omit<ToastMessage, 'id'>) => {
    clearTimeout(toastTimer.current);
    setToast({ ...message, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  };

  const simulate = async () => {
    if (busy) return;
    // Visible "press in" (raised → inset) for 120ms, also for keyboard activation.
    setPressed(true);
    clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => setPressed(false), PRESS_MS);
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

  // The command palette can trigger a rush too; always call the latest `simulate`.
  const simulateRef = useRef(simulate);
  useEffect(() => {
    simulateRef.current = simulate;
  });
  useEffect(() => onSimulateRequest(() => void simulateRef.current()), []);

  return (
    <>
      <span className="magnet" ref={wrapRef} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
        {coolingDown ? (
          <button type="button" className="btn-cooldown" disabled aria-live="polite">
            Cooling down · {formatCountdown(remaining)}
          </button>
        ) : (
          <button
            type="button"
            className={pressed ? 'btn-gloss btn-simulate is-pressed' : 'btn-gloss btn-simulate'}
            onClick={() => void simulate()}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? 'Starting rush…' : 'Simulate rush hour'}
          </button>
        )}
      </span>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
