"use client";

import { useMemo, useState } from "react";
import { useGetSquadQuery, useSellPlayerMutation } from "../../src/state/apis/gameApi";
import { ProgressRow } from "../../src/components/progress-row";

export default function SquadPage() {
  const { data, isLoading, error, refetch } = useGetSquadQuery();
  const [sellPlayer, sellState] = useSellPlayerMutation();
  const [sellingId, setSellingId] = useState<number | null>(null);

  const startersCount = useMemo(
    () => (data?.players || []).filter((player) => player.isStarting).length,
    [data?.players]
  );
  const averageStamina = useMemo(() => {
    if (!data?.players?.length) return 0;
    return data.players.reduce((total, player) => total + player.stamina, 0) / data.players.length;
  }, [data?.players]);
  const averageOverall = useMemo(() => {
    if (!data?.players?.length) return 0;
    return data.players.reduce((total, player) => total + player.overall, 0) / data.players.length;
  }, [data?.players]);

  return (
    <main className="page-panel page-panel-portrait">
      <h2 className="page-title">Squad Management</h2>
      <p className="page-copy">Starting XI, bench depth, stamina and squad tuning.</p>

      <div className="inline" style={{ marginBottom: 10 }}>
        <span className="label-pill">Squad Size: {data?.squadSize ?? "-"}</span>
        <span className="label-pill">Starters: {startersCount}</span>
        <span className="label-pill">Formation: {data?.lineup?.formation || "-"}</span>
      </div>

      {isLoading && <p className="feedback">Loading squad...</p>}
      {error && <p className="feedback error">Unable to load squad.</p>}

      {data?.players?.length ? (
        <section className="onboarding-card section-pad">
          <h3>Squad Fitness Snapshot</h3>
          <div className="progress-stack">
            <ProgressRow label="Average Overall" value={averageOverall} valueText={averageOverall.toFixed(1)} tone="cyan" />
            <ProgressRow
              label="Average Stamina"
              value={averageStamina}
              valueText={`${Math.round(averageStamina)}%`}
              tone={averageStamina < 45 ? "red" : "green"}
            />
          </div>
        </section>
      ) : null}

      {data?.players?.length ? (
        <div className="player-grid">
          {data.players.map((player) => (
            <article
              key={player.id}
              className={`player-card ${player.isStarting ? "is-starting" : ""} ${player.isBench ? "is-bench" : ""}`}
            >
              <div className="player-card-head">
                <div>
                  <h3>{player.name}</h3>
                  <p>
                    #{player.shirtNumber} • {player.position} • {player.rarity}
                  </p>
                </div>
                <div className="player-overall">{player.overall.toFixed(1)}</div>
              </div>

              <div className="inline" style={{ marginBottom: 8 }}>
                <span className="label-pill">{player.isStarting ? "Starting XI" : player.isBench ? "Bench" : "Reserve"}</span>
                <span className="label-pill">Lvl {player.level}</span>
              </div>

              <div className="progress-stack compact">
                <ProgressRow label="Overall" value={player.overall} tone="cyan" />
                <ProgressRow
                  label="Stamina"
                  value={player.stamina}
                  valueText={`${Math.round(player.stamina)}%`}
                  tone={player.stamina < 45 ? "red" : "green"}
                />
              </div>

              <div className="inline">
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
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {sellState.isError && <p className="feedback error">Sell action failed. Rules may block this sale.</p>}
      {sellState.isSuccess && <p className="feedback">Player sold and coin reward granted.</p>}
    </main>
  );
}
