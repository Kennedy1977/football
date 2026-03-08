"use client";

import { useGetLeagueTableQuery } from "../../src/state/apis/gameApi";

export default function LeaguePage() {
  const { data, isLoading, error, refetch } = useGetLeagueTableQuery();

  return (
    <main className="page-panel">
      <h2 className="page-title">League Table</h2>
      <p className="page-copy">Condensed table view (9 teams around your rank) with points and movement context.</p>

      <div className="inline" style={{ marginBottom: 10 }}>
        <span className="label-pill">League: {data?.league || "-"}</span>
        <span className="label-pill">Your Rank: {data?.userRank || "-"}</span>
        <button type="button" onClick={() => refetch()}>
          Refresh
        </button>
      </div>

      {isLoading && <p className="feedback">Loading league table...</p>}
      {error && <p className="feedback error">Unable to load league table.</p>}

      {data?.table?.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Club</th>
                <th>P</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                <th>GD</th>
                <th>GF</th>
              </tr>
            </thead>
            <tbody>
              {data.table.map((row) => (
                <tr key={row.clubId}>
                  <td>{row.rank}</td>
                  <td>{row.clubName}</td>
                  <td>{row.points}</td>
                  <td>{row.wins}</td>
                  <td>{row.draws}</td>
                  <td>{row.losses}</td>
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
