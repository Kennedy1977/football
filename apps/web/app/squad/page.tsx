"use client";

import { useEffect, useMemo, useState } from "react";
import { useGetSquadQuery, useSellPlayerMutation, useUpdateLineupMutation } from "../../src/state/apis/gameApi";
import { ProgressRow } from "../../src/components/progress-row";
import { readApiErrorMessage } from "../../src/lib/api-error";
import { toRarityFrame } from "../../src/lib/rarity-frame";

type Position = "GK" | "DEF" | "MID" | "ATT";
type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
type FormationCode = "4-4-2" | "4-3-3" | "4-5-1" | "4-2-3-1" | "3-5-2" | "5-3-2" | "4-2-4";

interface SquadPlayer {
  id: number;
  name: string;
  age: number;
  shirtNumber: number;
  position: Position;
  rarity: Rarity;
  overall: number;
  level: number;
  exp: number;
  stamina: number;
  isStarting: boolean;
  isBench: boolean;
}

interface SquadLineup {
  formation: string;
  startingPlayerIds: number[];
  benchPlayerIds: number[];
}

const FORMATION_CODES: FormationCode[] = ["4-4-2", "4-3-3", "4-5-1", "4-2-3-1", "3-5-2", "5-3-2", "4-2-4"];

export default function SquadPage() {
  const { data, isLoading, error, refetch } = useGetSquadQuery();
  const [updateLineup, updateLineupState] = useUpdateLineupMutation();
  const [sellPlayer, sellState] = useSellPlayerMutation();
  const [sellingId, setSellingId] = useState<number | null>(null);
  const [selectedFormation, setSelectedFormation] = useState<FormationCode>("4-4-2");
  const [selectedStartingIds, setSelectedStartingIds] = useState<number[]>([]);
  const [selectedBenchIds, setSelectedBenchIds] = useState<number[]>([]);
  const [lineupFeedback, setLineupFeedback] = useState<string | null>(null);

  const players = useMemo(() => (data?.players || []) as SquadPlayer[], [data?.players]);
  const unlockedFormations = useMemo(() => getUnlockedFormations(data?.unlockedFormations || []), [data?.unlockedFormations]);

  const persistedSelection = useMemo(() => {
    const formation = resolveFormationCode(data?.lineup?.formation, unlockedFormations[0] || "4-4-2");
    const { startingIds, benchIds } = buildInitialSelection(players, data?.lineup || null);
    return { formation, startingIds, benchIds };
  }, [players, data?.lineup, unlockedFormations]);

  useEffect(() => {
    if (!players.length) {
      setSelectedStartingIds([]);
      setSelectedBenchIds([]);
      setSelectedFormation("4-4-2");
      return;
    }

    setSelectedFormation(persistedSelection.formation);
    setSelectedStartingIds(persistedSelection.startingIds);
    setSelectedBenchIds(persistedSelection.benchIds);
    setLineupFeedback(null);
  }, [players.length, persistedSelection]);

  const startersCount = useMemo(
    () => selectedStartingIds.length,
    [selectedStartingIds]
  );
  const averageStamina = useMemo(() => {
    if (!players.length) return 0;
    return players.reduce((total, player) => total + player.stamina, 0) / players.length;
  }, [players]);
  const averageOverall = useMemo(() => {
    if (!players.length) return 0;
    return players.reduce((total, player) => total + player.overall, 0) / players.length;
  }, [players]);

  const playerMap = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const selectedStartingSet = useMemo(() => new Set(selectedStartingIds), [selectedStartingIds]);
  const selectedBenchSet = useMemo(() => new Set(selectedBenchIds), [selectedBenchIds]);

  const selectedStartingPlayers = useMemo(
    () => selectedStartingIds.map((id) => playerMap.get(id)).filter((player): player is SquadPlayer => Boolean(player)),
    [selectedStartingIds, playerMap]
  );

  const starterGkCount = useMemo(
    () => selectedStartingPlayers.filter((player) => player.position === "GK").length,
    [selectedStartingPlayers]
  );
  const unavailableStarters = useMemo(
    () => selectedStartingPlayers.filter((player) => player.stamina <= 0),
    [selectedStartingPlayers]
  );
  const lineupReady =
    startersCount === 11 && selectedBenchIds.length <= 5 && starterGkCount >= 1 && unavailableStarters.length === 0;
  const hasLineupChanges =
    selectedFormation !== persistedSelection.formation ||
    !sameIdSet(selectedStartingIds, persistedSelection.startingIds) ||
    !sameIdSet(selectedBenchIds, persistedSelection.benchIds);

  const lineupBlockingMessage = !players.length
    ? null
    : startersCount !== 11
      ? `Select exactly 11 starters (${startersCount}/11).`
      : starterGkCount < 1
        ? "Starting XI must include at least one goalkeeper."
        : selectedBenchIds.length > 5
          ? "Bench can contain at most 5 players."
          : unavailableStarters.length
            ? "One or more selected starters have red stamina and cannot start."
            : null;

  const handleToggleStarter = (player: SquadPlayer) => {
    setLineupFeedback(null);
    updateLineupState.reset();

    if (selectedStartingSet.has(player.id)) {
      setSelectedStartingIds((prev) => prev.filter((id) => id !== player.id));
      return;
    }

    if (player.stamina <= 0) {
      setLineupFeedback(`${player.name} is unavailable due to red stamina.`);
      return;
    }

    if (selectedStartingIds.length >= 11) {
      setLineupFeedback("Starting XI already contains 11 players. Remove one first.");
      return;
    }

    setSelectedBenchIds((prev) => prev.filter((id) => id !== player.id));
    setSelectedStartingIds((prev) => [...prev, player.id]);
  };

  const handleToggleBench = (player: SquadPlayer) => {
    setLineupFeedback(null);
    updateLineupState.reset();

    if (selectedBenchSet.has(player.id)) {
      setSelectedBenchIds((prev) => prev.filter((id) => id !== player.id));
      return;
    }

    if (selectedBenchIds.length >= 5) {
      setLineupFeedback("Bench already contains 5 players. Remove one first.");
      return;
    }

    setSelectedStartingIds((prev) => prev.filter((id) => id !== player.id));
    setSelectedBenchIds((prev) => [...prev, player.id]);
  };

  const handleResetSelection = () => {
    setSelectedFormation(persistedSelection.formation);
    setSelectedStartingIds(persistedSelection.startingIds);
    setSelectedBenchIds(persistedSelection.benchIds);
    setLineupFeedback("Lineup selection reset to saved state.");
    updateLineupState.reset();
  };

  const handleSaveLineup = async () => {
    if (!lineupReady) return;

    setLineupFeedback(null);

    try {
      await updateLineup({
        formation: selectedFormation,
        startingPlayerIds: selectedStartingIds,
        benchPlayerIds: selectedBenchIds,
      }).unwrap();
      await refetch();
      setLineupFeedback("Lineup updated.");
    } catch {
      // API message rendered below via updateLineupState.error
    }
  };

  return (
    <main className="page-panel page-panel-portrait">
      <h2 className="page-title">Squad Management</h2>
      <p className="page-copy">Starting XI, bench depth, stamina and squad tuning.</p>

      <div className="inline" style={{ marginBottom: 10 }}>
        <span className="label-pill">Squad Size: {data?.squadSize ?? "-"}</span>
        <span className="label-pill">Starters: {startersCount}</span>
        <span className="label-pill">Formation: {selectedFormation}</span>
      </div>

      {isLoading && <p className="feedback">Loading squad...</p>}
      {error && <p className="feedback error">Unable to load squad.</p>}

      {players.length ? (
        <section className="onboarding-card section-pad lineup-editor">
          <h3>Lineup Builder</h3>

          <div className="lineup-editor-head">
            <label className="field lineup-formation-field">
              <span>Formation</span>
              <select
                className="input"
                value={selectedFormation}
                onChange={(event) => {
                  setSelectedFormation(resolveFormationCode(event.target.value, selectedFormation));
                  setLineupFeedback(null);
                  updateLineupState.reset();
                }}
              >
                {unlockedFormations.map((formation) => (
                  <option key={formation} value={formation}>
                    {formation}
                  </option>
                ))}
              </select>
            </label>

            <div className="lineup-summary-grid">
              <div className={`lineup-summary-card ${startersCount === 11 ? "good" : "warn"}`}>
                <p>Starters</p>
                <strong>{startersCount}/11</strong>
              </div>
              <div className={`lineup-summary-card ${starterGkCount >= 1 ? "good" : "warn"}`}>
                <p>Goalkeepers</p>
                <strong>{starterGkCount}</strong>
              </div>
              <div className={`lineup-summary-card ${selectedBenchIds.length <= 5 ? "good" : "warn"}`}>
                <p>Bench</p>
                <strong>{selectedBenchIds.length}/5</strong>
              </div>
            </div>
          </div>

          <div className="lineup-actions">
            <button
              type="button"
              onClick={handleSaveLineup}
              disabled={updateLineupState.isLoading || !lineupReady || !hasLineupChanges}
            >
              {updateLineupState.isLoading ? "Saving..." : "Save Lineup"}
            </button>
            <button type="button" onClick={handleResetSelection} disabled={updateLineupState.isLoading || !hasLineupChanges}>
              Reset
            </button>
          </div>

          {lineupBlockingMessage ? <p className="feedback error">{lineupBlockingMessage}</p> : null}
          {updateLineupState.isError ? (
            <p className="feedback error">{readApiErrorMessage(updateLineupState.error) || "Lineup update failed."}</p>
          ) : null}
          {lineupFeedback ? <p className="feedback">{lineupFeedback}</p> : null}
        </section>
      ) : null}

      {players.length ? (
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

      {players.length ? (
        <div className="player-grid">
          {players.map((player) => {
            const isStarting = selectedStartingSet.has(player.id);
            const isBench = selectedBenchSet.has(player.id);
            return (
              <article
                key={player.id}
                className={`player-card rarity-${toRarityFrame(player.rarity)} ${isStarting ? "is-starting" : ""} ${isBench ? "is-bench" : ""}`}
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
                  <span className="label-pill">{isStarting ? "Starting XI" : isBench ? "Bench" : "Reserve"}</span>
                  <span className="label-pill">Lvl {player.level}</span>
                  {player.stamina <= 0 ? <span className="label-pill">Unavailable</span> : null}
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

                <div className="lineup-role-actions">
                  <button
                    type="button"
                    className={`lineup-role-button ${isStarting ? "active-starting" : ""}`}
                    onClick={() => handleToggleStarter(player)}
                    disabled={updateLineupState.isLoading}
                  >
                    {isStarting ? "Remove Starter" : "Set Starter"}
                  </button>
                  <button
                    type="button"
                    className={`lineup-role-button ${isBench ? "active-bench" : ""}`}
                    onClick={() => handleToggleBench(player)}
                    disabled={updateLineupState.isLoading}
                  >
                    {isBench ? "Remove Bench" : "Set Bench"}
                  </button>
                </div>

                <div className="inline">
                  <button
                    type="button"
                    disabled={sellState.isLoading || updateLineupState.isLoading}
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
            );
          })}
        </div>
      ) : null}

      {sellState.isError && <p className="feedback error">{readApiErrorMessage(sellState.error) || "Sell action failed. Rules may block this sale."}</p>}
      {sellState.isSuccess && <p className="feedback">Player sold and coin reward granted.</p>}
    </main>
  );
}

function getUnlockedFormations(values: string[]): FormationCode[] {
  const allowed = values.filter((value): value is FormationCode => FORMATION_CODES.includes(value as FormationCode));
  if (!allowed.length) {
    return ["4-4-2"];
  }

  return Array.from(new Set(allowed));
}

function resolveFormationCode(value: unknown, fallback: FormationCode): FormationCode {
  if (typeof value === "string" && FORMATION_CODES.includes(value as FormationCode)) {
    return value as FormationCode;
  }
  return fallback;
}

function buildInitialSelection(
  players: SquadPlayer[],
  lineup: SquadLineup | null
): { startingIds: number[]; benchIds: number[] } {
  const playerIdSet = new Set(players.map((player) => player.id));
  const validLineupStarting = uniqueIds(lineup?.startingPlayerIds || []).filter((id) => playerIdSet.has(id));
  const validLineupBench = uniqueIds(lineup?.benchPlayerIds || []).filter((id) => playerIdSet.has(id));

  let startingIds = validLineupStarting.length === 11 ? validLineupStarting : uniqueIds(players.filter((player) => player.isStarting).map((player) => player.id));

  if (startingIds.length !== 11) {
    const sorted = [...players].sort((a, b) => b.overall - a.overall);
    const replacement: number[] = [];
    const gk = sorted.find((player) => player.position === "GK");
    if (gk) replacement.push(gk.id);

    for (const player of sorted) {
      if (replacement.length >= 11) break;
      if (!replacement.includes(player.id)) {
        replacement.push(player.id);
      }
    }

    startingIds = replacement;
  }

  startingIds = uniqueIds(startingIds).slice(0, 11);

  if (!startingIds.some((id) => players.find((player) => player.id === id)?.position === "GK")) {
    const fallbackGk = players.find((player) => player.position === "GK" && !startingIds.includes(player.id));
    if (fallbackGk && startingIds.length) {
      startingIds = [...startingIds.slice(0, 10), fallbackGk.id];
    }
  }

  const defaultBench = uniqueIds(players.filter((player) => player.isBench).map((player) => player.id));
  const benchSource = validLineupBench.length ? validLineupBench : defaultBench;
  const benchIds = uniqueIds(benchSource)
    .filter((id) => !startingIds.includes(id))
    .slice(0, 5);

  return {
    startingIds,
    benchIds,
  };
}

function uniqueIds(values: number[]): number[] {
  return Array.from(new Set(values.filter((value) => Number.isInteger(value) && value > 0)));
}

function sameIdSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((id) => setA.has(id));
}
