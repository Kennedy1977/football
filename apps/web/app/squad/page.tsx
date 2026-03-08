"use client";

import { useMemo, useState } from "react";
import { useGetSquadQuery, useSellPlayerMutation } from "../../src/state/apis/gameApi";

export default function SquadPage() {
  const { data, isLoading, error, refetch } = useGetSquadQuery();
  const [sellPlayer, sellState] = useSellPlayerMutation();
  const [sellingId, setSellingId] = useState<number | null>(null);

  const startersCount = useMemo(
    () => (data?.players || []).filter((player) => player.isStarting).length,
    [data?.players]
  );

  return (
    <main className="page-panel">
      <h2 className="page-title">Squad Management</h2>
      <p className="page-copy">Starting 11, bench, stamina states, and player sell controls.</p>

      <div className="inline" style={{ marginBottom: 10 }}>
        <span className="label-pill">Squad Size: {data?.squadSize ?? "-"}</span>
        <span className="label-pill">Starters: {startersCount}</span>
        <span className="label-pill">Formation: {data?.lineup?.formation || "-"}</span>
      </div>

      {isLoading && <p className="feedback">Loading squad...</p>}
      {error && <p className="feedback error">Unable to load squad.</p>}

      {data?.players?.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Pos</th>
                <th>Rare</th>
                <th>Ovr</th>
                <th>Stamina</th>
                <th>Lineup</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.players.map((player) => (
                <tr key={player.id}>
                  <td>{player.name}</td>
                  <td>{player.position}</td>
                  <td>{player.rarity}</td>
                  <td>{player.overall}</td>
                  <td>{player.stamina}</td>
                  <td>{player.isStarting ? "Starting XI" : player.isBench ? "Bench" : "Reserve"}</td>
                  <td>
                    <button
                      type="button"
                      disabled={sellState.isLoading}
                      onClick={async () => {
                        setSellingId(player.id);
                        try {
                          await sellPlayer({ playerId: player.id }).unwrap();
                          await refetch();
                        } finally {
                          setSellingId(null);
                        }
                      }}
                    >
                      {sellState.isLoading && sellingId === player.id ? "Selling..." : "Sell"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {sellState.isError && <p className="feedback error">Sell action failed. Rules may block this sale.</p>}
      {sellState.isSuccess && <p className="feedback">Player sold and coin reward granted.</p>}
    </main>
  );
}
