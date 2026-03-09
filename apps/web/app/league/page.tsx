"use client";

import { useGetLeagueTableQuery } from "../../src/state/apis/gameApi";
import { ProgressRow } from "../../src/components/progress-row";

export default function LeaguePage() {
  const { data, isLoading, error, refetch } = useGetLeagueTableQuery();
  const leaderPoints = data?.table?.[0]?.points ?? 0;
  const userPoints = data?.table?.find((row) => row.rank === data.userRank)?.points ?? 0;

  return (
    <main className="page-panel page-panel-portrait">
      <h2 className="page-title">League Table</h2>
      <p className="page-copy">Full division standings with points, record and goal metrics.</p>

      <div className="inline" style={{ marginBottom: 10 }}>
        <span className="label-pill">League: {data?.league || "-"}</span>
        <span className="label-pill">Your Rank: {data?.userRank || "-"}</span>
        <span className="label-pill">Teams: {data?.table?.length || "-"}</span>
        <button type="button" onClick={() => refetch()}>
          Refresh
        </button>
      </div>

      {isLoading && <p className="feedback">Loading league table...</p>}
      {error && <p className="feedback error">Unable to load league table.</p>}

      {data?.table?.length ? (
        <section className="onboarding-card section-pad">
          <h3>League Pressure</h3>
          <div className="progress-stack">
            <ProgressRow
              label="Points Vs Leader"
              value={leaderPoints ? (userPoints / leaderPoints) * 100 : 0}
              valueText={`${userPoints} / ${leaderPoints}`}
              tone="gold"
            />
            <ProgressRow
              label="Promotion Push"
              value={Math.max(0, 100 - (data.userRank - 1) * 8)}
              valueText={`Rank #${data.userRank}`}
              tone="cyan"
            />
          </div>
        </section>
      ) : null}

      {data?.table?.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Club</th>
                <th>MP</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                <th>Pts</th>
                <th>GD</th>
                <th>GF</th>
              </tr>
            </thead>
            <tbody>
              {data.table.map((row) => (
                <tr key={row.clubId} className={row.rank === data.userRank ? "table-row-highlight" : ""}>
                  <td>{row.rank}</td>
                  <td>{row.clubName}{row.rank === data.userRank ? " (You)" : ""}</td>
                  <td>{row.matchesPlayed}</td>
                  <td>{row.wins}</td>
                  <td>{row.draws}</td>
                  <td>{row.losses}</td>
                  <td>{row.points}</td>
                  <td>{row.goalDifference}</td>
                  <td>{row.goalsFor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
