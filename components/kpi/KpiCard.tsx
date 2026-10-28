interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  hero?: boolean;
}

export function KpiCard({ label, value, hint, hero = false }: KpiCardProps) {
  return (
    <article className={hero ? 'kpi kpi-hero' : 'kpi'} aria-label={label}>
      <h2 className="kpi-label">{label}</h2>
      <p className="kpi-value tabular-nums">{value}</p>
      {hint ? <p className="kpi-hint">{hint}</p> : null}
    </article>
  );
}
