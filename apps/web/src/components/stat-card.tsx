export function StatCard({
  label,
  value,
  tone = "neutral",
  footnote,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warn";
  footnote?: string;
}) {
  return (
    <article className={`stat-card ${tone}`}>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {footnote ? <p className="stat-footnote">{footnote}</p> : null}
    </article>
  );
}
