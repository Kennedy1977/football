function clampPct(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

export function ProgressRow({
  label,
  value,
  valueText,
  tone = "cyan",
}: {
  label: string;
  value: number;
  valueText?: string;
  tone?: "cyan" | "green" | "gold" | "red" | "violet";
}) {
  const pct = clampPct(value);
  return (
    <div className="progress-row">
      <div className="progress-row-head">
        <span>{label}</span>
        <strong>{valueText ?? `${Math.round(pct)}%`}</strong>
      </div>
      <div className="progress-track" aria-hidden>
        <span className={`progress-fill tone-${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
