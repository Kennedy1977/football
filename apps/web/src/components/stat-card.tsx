export function StatCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "warn" }) {
  return (
    <article className={`stat-card ${tone}`}>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
    </article>
  );
}
