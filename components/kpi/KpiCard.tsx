'use client';

import { useRef, type PointerEvent } from 'react';
import { useCountUp } from '@/hooks/useCountUp';
import { gsap, useGSAP } from '@/hooks/useGsap';

interface KpiCardProps {
  label: string;
  value: number;
  format: (value: number) => string;
  hint: string;
  reduced: boolean;
  hero?: boolean;
  /** RUSH MODE: the glow behind the hero card brightens for its duration. */
  rush?: boolean;
}

export function KpiCard({ label, value, format, hint, reduced, hero = false, rush = false }: KpiCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const specularRef = useRef<HTMLSpanElement>(null);
  const moveSpecular = useRef<{ x: (value: number) => void; y: (value: number) => void } | null>(null);
  const previousValue = useRef(value);
  const formatted = format(value);

  useCountUp(valueRef, value, format, reduced);

  // Brief aqua glow behind the card whenever the number changes (opacity only).
  useGSAP(
    () => {
      const changed = previousValue.current !== value;
      previousValue.current = value;
      if (!changed || !glowRef.current) return;
      gsap.fromTo(glowRef.current, { opacity: 0 }, { opacity: 0.85, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut' });
    },
    { dependencies: [value] },
  );

  // RUSH MODE: hold the hero glow bright, then ease back.
  useGSAP(
    () => {
      if (!hero || !glowRef.current) return;
      gsap.to(glowRef.current, { opacity: rush ? 1 : 0, duration: rush ? 0.6 : 1.2, ease: 'sine.inOut' });
    },
    { dependencies: [rush, hero] },
  );

  // Specular highlight that follows the cursor: transform only, via quickTo.
  useGSAP(
    () => {
      if (reduced || !specularRef.current) return;
      moveSpecular.current = {
        x: gsap.quickTo(specularRef.current, 'x', { duration: 0.45, ease: 'power3.out' }),
        y: gsap.quickTo(specularRef.current, 'y', { duration: 0.45, ease: 'power3.out' }),
      };
    },
    { dependencies: [reduced], scope: cardRef },
  );

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    moveSpecular.current?.x(event.clientX - bounds.left);
    moveSpecular.current?.y(event.clientY - bounds.top);
  };

  return (
    <article
      ref={cardRef}
      className={hero ? 'kpi kpi-hero glass has-sheen' : 'kpi glass has-sheen'}
      aria-label={label}
      data-reveal
      onPointerMove={onPointerMove}
    >
      <span className="glass-sheen" aria-hidden="true" />
      <span className="kpi-glow" ref={glowRef} aria-hidden="true" />
      <span className="specular" ref={specularRef} aria-hidden="true" />
      <h2 className="kpi-label">{label}</h2>
      <p className="kpi-value tabular-nums">
        <span ref={valueRef} aria-hidden="true">
          {formatted}
        </span>
        <span className="sr-only">{formatted}</span>
      </p>
      <p className="kpi-hint">{hint}</p>
    </article>
  );
}
