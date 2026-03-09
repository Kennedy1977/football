"use client";

import type { CSSProperties, DragEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useGetSquadQuery, useSellPlayerMutation, useUpdateLineupMutation } from "../../src/state/apis/gameApi";
import { ProgressRow } from "../../src/components/progress-row";
import { readApiErrorMessage } from "../../src/lib/api-error";
import { toRarityFrame } from "../../src/lib/rarity-frame";
import { getPlayerCardArt } from "../../src/lib/player-card-art";

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

interface FormationSlot {
  key: string;
  role: Position;
  label: string;
  x: number;
  y: number;
}

const FORMATION_CODES: FormationCode[] = ["4-4-2", "4-3-3", "4-5-1", "4-2-3-1", "3-5-2", "5-3-2", "4-2-4"];
const FORMATION_POSITION_COUNTS: Record<FormationCode, { DEF: number; MID: number; ATT: number }> = {
  "4-4-2": { DEF: 4, MID: 4, ATT: 2 },
  "4-3-3": { DEF: 4, MID: 3, ATT: 3 },
  "4-5-1": { DEF: 4, MID: 5, ATT: 1 },
  "4-2-3-1": { DEF: 4, MID: 5, ATT: 1 },
  "3-5-2": { DEF: 3, MID: 5, ATT: 2 },
  "5-3-2": { DEF: 5, MID: 3, ATT: 2 },
  "4-2-4": { DEF: 4, MID: 2, ATT: 4 },
};

export default function SquadPage() {
  const { data, isLoading, error, refetch } = useGetSquadQuery();
  const [updateLineup, updateLineupState] = useUpdateLineupMutation();
  const [sellPlayer, sellState] = useSellPlayerMutation();
  const [sellingId, setSellingId] = useState<number | null>(null);
  const [selectedFormation, setSelectedFormation] = useState<FormationCode>("4-4-2");
  const [selectedStartingIds, setSelectedStartingIds] = useState<number[]>([]);
  const [selectedBenchIds, setSelectedBenchIds] = useState<number[]>([]);
  const [selectedReservePlayerId, setSelectedReservePlayerId] = useState<number | null>(null);
  const [draggingReservePlayerId, setDraggingReservePlayerId] = useState<number | null>(null);
  const [hoveredSlotIndex, setHoveredSlotIndex] = useState<number | null>(null);
  const [lineupFeedback, setLineupFeedback] = useState<string | null>(null);

  const players = useMemo(() => (data?.players || []) as SquadPlayer[], [data?.players]);
  const playerMap = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const unlockedFormations = useMemo(() => getUnlockedFormations(data?.unlockedFormations || []), [data?.unlockedFormations]);

  const persistedSelection = useMemo(() => {
    const formation = resolveFormationCode(data?.lineup?.formation, unlockedFormations[0] || "4-4-2");
    const { startingIds, benchIds } = buildInitialSelection(players, data?.lineup || null);
    const normalizedStarting = normalizeStarterOrderForFormation(startingIds, players, formation);

    return {
      formation,
      startingIds: normalizedStarting,
      benchIds: benchIds.filter((id) => !normalizedStarting.includes(id)),
    };
  }, [players, data?.lineup, unlockedFormations]);

  useEffect(() => {
    if (!players.length) {
      setSelectedStartingIds([]);
      setSelectedBenchIds([]);
      setSelectedFormation("4-4-2");
      setSelectedReservePlayerId(null);
      setDraggingReservePlayerId(null);
      setHoveredSlotIndex(null);
      return;
    }

    setSelectedFormation(persistedSelection.formation);
    setSelectedStartingIds(persistedSelection.startingIds);
    setSelectedBenchIds(persistedSelection.benchIds);
    setSelectedReservePlayerId(null);
    setDraggingReservePlayerId(null);
    setHoveredSlotIndex(null);
    setLineupFeedback(null);
  }, [players.length, persistedSelection]);

  const formationSlots = useMemo(() => buildFormationSlots(selectedFormation), [selectedFormation]);
  const selectedStartingSet = useMemo(() => new Set(selectedStartingIds), [selectedStartingIds]);
  const selectedBenchSet = useMemo(() => new Set(selectedBenchIds), [selectedBenchIds]);

  const selectedStartingPlayers = useMemo(
    () =>
      selectedStartingIds
        .map((id) => playerMap.get(id))
        .filter((player): player is SquadPlayer => Boolean(player)),
    [selectedStartingIds, playerMap]
  );

  const remainingPlayers = useMemo(
    () =>
      players
        .filter((player) => !selectedStartingSet.has(player.id))
        .sort((a, b) => {
          const aBench = selectedBenchSet.has(a.id) ? 1 : 0;
          const bBench = selectedBenchSet.has(b.id) ? 1 : 0;
          if (aBench !== bBench) {
            return bBench - aBench;
          }
          if (b.overall !== a.overall) {
            return b.overall - a.overall;
          }
          return a.name.localeCompare(b.name);
        }),
    [players, selectedStartingSet, selectedBenchSet]
  );

  const startersCount = selectedStartingIds.length;
  const averageStamina = useMemo(() => {
    if (!players.length) return 0;
    return players.reduce((total, player) => total + player.stamina, 0) / players.length;
  }, [players]);
  const averageOverall = useMemo(() => {
    if (!players.length) return 0;
    return players.reduce((total, player) => total + player.overall, 0) / players.length;
  }, [players]);

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
    !sameOrderedIds(selectedStartingIds, persistedSelection.startingIds) ||
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

  const activeReserveId = draggingReservePlayerId || selectedReservePlayerId;

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
    setSelectedReservePlayerId(null);
    setDraggingReservePlayerId(null);
    setHoveredSlotIndex(null);
    setLineupFeedback("Lineup selection reset to saved state.");
    updateLineupState.reset();
  };

  const handleAutoPickBestXi = () => {
    const picked = autoPickBestXi(players, selectedFormation);
    if (!picked) {
      setLineupFeedback("Auto-pick failed: not enough available players (need 11 with at least one GK).");
      return;
    }

    const orderedStarting = normalizeStarterOrderForFormation(picked.startingIds, players, selectedFormation);
    const benchCandidates = players
      .filter((player) => !orderedStarting.includes(player.id))
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 5)
      .map((player) => player.id);

    setSelectedStartingIds(orderedStarting);
    setSelectedBenchIds(benchCandidates);
    setSelectedReservePlayerId(null);
    setDraggingReservePlayerId(null);
    setHoveredSlotIndex(null);
    setLineupFeedback(`Auto-picked best XI for ${selectedFormation}.`);
    updateLineupState.reset();
  };

  const handlePlaceReserveInSlot = (slotIndex: number, reservePlayerId: number) => {
    const reserve = playerMap.get(reservePlayerId);
    if (!reserve) {
      return;
    }

    if (reserve.stamina <= 0) {
      setLineupFeedback(`${reserve.name} is unavailable due to red stamina.`);
      return;
    }

    if (slotIndex < 0 || slotIndex >= formationSlots.length) {
      return;
    }

    setLineupFeedback(null);
    updateLineupState.reset();

    setSelectedStartingIds((prev) => {
      const normalized = normalizeStarterOrderForFormation(prev, players, selectedFormation);
      const next = [...normalized];
      const existingIndex = next.indexOf(reservePlayerId);

      if (existingIndex >= 0) {
        const displaced = next[slotIndex];
        next[slotIndex] = reservePlayerId;
        next[existingIndex] = displaced;
      } else if (slotIndex < next.length) {
        next[slotIndex] = reservePlayerId;
      } else if (next.length < formationSlots.length) {
        next.push(reservePlayerId);
      }

      return next;
    });

    setSelectedBenchIds((prev) => prev.filter((id) => id !== reservePlayerId));
    setSelectedReservePlayerId(reservePlayerId);
    setDraggingReservePlayerId(null);
    setHoveredSlotIndex(null);
    setLineupFeedback(`${reserve.name} moved into the starting XI.`);
  };

  const handlePitchSlotDrop = (event: DragEvent<HTMLButtonElement>, slotIndex: number) => {
    event.preventDefault();
    const transferId = Number(event.dataTransfer.getData("text/plain"));
    const reserveId = Number.isInteger(transferId) && transferId > 0 ? transferId : draggingReservePlayerId;

    if (!reserveId) {
      return;
    }

    handlePlaceReserveInSlot(slotIndex, reserveId);
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
      <p className="page-copy">Interactive pitch editor with drag-and-drop starters.</p>

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
                  const nextFormation = resolveFormationCode(event.target.value, selectedFormation);
                  setSelectedFormation(nextFormation);
                  setSelectedStartingIds((prev) => normalizeStarterOrderForFormation(prev, players, nextFormation));
                  setSelectedReservePlayerId(null);
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
            <button type="button" onClick={handleAutoPickBestXi} disabled={updateLineupState.isLoading || players.length < 11}>
              Auto Pick Best XI
            </button>
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
        <section className="onboarding-card section-pad lineup-pitch-panel">
          <h3>Formation Pitch</h3>
          <p className="lineup-panel-copy">
            Drag a reserve card onto a position, or tap a reserve card then tap a pitch slot to replace that starter.
          </p>

          <div className="lineup-pitch-shell">
            <div className="lineup-pitch" role="img" aria-label={`Pitch view in ${selectedFormation} formation`}>
              {formationSlots.map((slot, index) => {
                const playerId = selectedStartingIds[index];
                const player = typeof playerId === "number" ? playerMap.get(playerId) : undefined;
                const art = player ? getPlayerCardArt(`${player.id}-${player.name}-${player.shirtNumber}`) : null;
                const slotStyle: CSSProperties = {
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                };
                const isDropTarget = hoveredSlotIndex === index && Boolean(activeReserveId);
                const canDrop = Boolean(activeReserveId);

                return (
                  <button
                    key={slot.key}
                    type="button"
                    className={`lineup-slot ${player ? "is-filled" : "is-empty"} ${isDropTarget ? "is-target" : ""}`}
                    style={slotStyle}
                    onDragOver={(event) => {
                      if (!activeReserveId) return;
                      event.preventDefault();
                      if (hoveredSlotIndex !== index) {
                        setHoveredSlotIndex(index);
                      }
                    }}
                    onDragEnter={() => {
                      if (activeReserveId) {
                        setHoveredSlotIndex(index);
                      }
                    }}
                    onDragLeave={() => {
                      if (hoveredSlotIndex === index) {
                        setHoveredSlotIndex(null);
                      }
                    }}
                    onDrop={(event) => handlePitchSlotDrop(event, index)}
                    onClick={() => {
                      if (activeReserveId) {
                        handlePlaceReserveInSlot(index, activeReserveId);
                      }
                    }}
                    aria-label={
                      player
                        ? `Slot ${slot.label}. Current player ${player.name}. ${canDrop ? "Tap to replace with selected reserve." : ""}`
                        : `Empty ${slot.label} slot`
                    }
                  >
                    {player && art ? (
                      <>
                        <span className="lineup-slot-head" style={{ backgroundPosition: art.facePosition }} aria-hidden />
                        <span className="lineup-slot-name">{shortStarterLabel(player.name)}</span>
                        <span className="lineup-slot-role">{slot.label}</span>
                      </>
                    ) : (
                      <>
                        <span className="lineup-slot-empty-role">{slot.label}</span>
                        <span className="lineup-slot-empty-copy">Drop</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {players.length ? (
        <section className="onboarding-card section-pad lineup-carousel-panel">
          <h3>Bench & Reserves</h3>
          <p className="lineup-panel-copy">Cards overlap for quick scanning. Drag one onto the pitch to swap in.</p>

          {remainingPlayers.length ? (
            <div className="lineup-carousel" role="list" aria-label="Bench and reserve players">
              {remainingPlayers.map((player) => {
                const art = getPlayerCardArt(`${player.id}-${player.name}-${player.shirtNumber}`);
                const shirtStyle: CSSProperties = { backgroundPosition: art.shirtPosition };
                const faceStyle: CSSProperties = { backgroundPosition: art.facePosition };
                const isBench = selectedBenchSet.has(player.id);
                const isSelectedReserve = selectedReservePlayerId === player.id;
                const isDraggingReserve = draggingReservePlayerId === player.id;

                return (
                  <article
                    key={player.id}
                    className={`lineup-carousel-card rarity-${toRarityFrame(player.rarity)} ${
                      isBench ? "is-bench" : ""
                    } ${isSelectedReserve ? "is-selected" : ""} ${isDraggingReserve ? "is-dragging" : ""}`}
                    role="listitem"
                    draggable={player.stamina > 0}
                    onClick={() => {
                      setSelectedReservePlayerId((prev) => (prev === player.id ? null : player.id));
                      setLineupFeedback(null);
                    }}
                    onDragStart={(event) => {
                      if (player.stamina <= 0) {
                        event.preventDefault();
                        return;
                      }
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", String(player.id));
                      setDraggingReservePlayerId(player.id);
                      setSelectedReservePlayerId(player.id);
                    }}
                    onDragEnd={() => {
                      setDraggingReservePlayerId(null);
                      setHoveredSlotIndex(null);
                    }}
                  >
                    <div className="lineup-carousel-avatar" aria-hidden>
                      <span className="lineup-carousel-shirt" style={shirtStyle} />
                      <span className="lineup-carousel-face" style={faceStyle} />
                    </div>

                    <div className="lineup-carousel-head">
                      <h4>{player.name}</h4>
                      <p>
                        #{player.shirtNumber} • {player.position}
                      </p>
                    </div>

                    <div className="lineup-carousel-meta">
                      <span className="label-pill">OVR {Math.round(player.overall)}</span>
                      <span className="label-pill">STA {Math.round(player.stamina)}%</span>
                    </div>

                    <div className="lineup-carousel-actions">
                      <button
                        type="button"
                        className={`lineup-role-button ${isBench ? "active-bench" : ""}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleToggleBench(player);
                        }}
                        disabled={updateLineupState.isLoading}
                      >
                        {isBench ? "Unbench" : "Bench"}
                      </button>
                      <button
                        type="button"
                        onClick={async (event) => {
                          event.stopPropagation();
                          setSellingId(player.id);
                          try {
                            await sellPlayer({ playerId: player.id }).unwrap();
                            await refetch();
                          } finally {
                            setSellingId(null);
                          }
                        }}
                        disabled={sellState.isLoading || updateLineupState.isLoading || selectedBenchSet.has(player.id)}
                      >
                        {sellState.isLoading && sellingId === player.id ? "Selling..." : "Sell"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="feedback">All players are currently in the starting XI.</p>
          )}
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

  let startingIds =
    validLineupStarting.length === 11 ? validLineupStarting : uniqueIds(players.filter((player) => player.isStarting).map((player) => player.id));

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

function sameOrderedIds(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
}

function sameIdSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((id) => setA.has(id));
}

function normalizeStarterOrderForFormation(startingIds: number[], players: SquadPlayer[], formation: FormationCode): number[] {
  const slots = buildFormationSlots(formation);
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const candidateIds = uniqueIds(startingIds).filter((id) => playerMap.has(id));
  const used = new Set<number>();
  const ordered: number[] = [];

  for (const slot of slots) {
    const options = candidateIds
      .map((id) => playerMap.get(id))
      .filter((player): player is SquadPlayer => Boolean(player))
      .filter((player) => !used.has(player.id));

    if (!options.length) {
      break;
    }

    const byRoleFit = options.filter((player) => canPlaySlot(slot.role, player.position));
    const ranked = (byRoleFit.length ? byRoleFit : options).sort((a, b) => scoreForSlot(slot.role, b) - scoreForSlot(slot.role, a));
    const chosen = ranked[0];

    ordered.push(chosen.id);
    used.add(chosen.id);
  }

  return ordered;
}

function buildFormationSlots(formation: FormationCode): FormationSlot[] {
  const slots: FormationSlot[] = [
    {
      key: "GK-1",
      role: "GK",
      label: "GK",
      x: 50,
      y: 87,
    },
  ];

  const pushRow = (
    role: Exclude<Position, "GK">,
    count: number,
    y: number,
    labelPrefix: string,
    xMin = 16,
    xMax = 84
  ) => {
    const xValues = spreadX(count, xMin, xMax);
    xValues.forEach((x, index) => {
      slots.push({
        key: `${role}-${labelPrefix}-${index + 1}`,
        role,
        label: `${labelPrefix}${index + 1}`,
        x,
        y,
      });
    });
  };

  switch (formation) {
    case "4-4-2":
      pushRow("DEF", 4, 72, "D");
      pushRow("MID", 4, 53, "M");
      pushRow("ATT", 2, 34, "A", 30, 70);
      break;
    case "4-3-3":
      pushRow("DEF", 4, 72, "D");
      pushRow("MID", 3, 53, "M", 24, 76);
      pushRow("ATT", 3, 34, "A", 24, 76);
      break;
    case "4-5-1":
      pushRow("DEF", 4, 72, "D");
      pushRow("MID", 5, 53, "M");
      pushRow("ATT", 1, 34, "A");
      break;
    case "4-2-3-1":
      pushRow("DEF", 4, 72, "D");
      pushRow("MID", 2, 59, "DM", 35, 65);
      pushRow("MID", 3, 47, "AM", 24, 76);
      pushRow("ATT", 1, 33, "A");
      break;
    case "3-5-2":
      pushRow("DEF", 3, 72, "D", 24, 76);
      pushRow("MID", 5, 53, "M");
      pushRow("ATT", 2, 34, "A", 30, 70);
      break;
    case "5-3-2":
      pushRow("DEF", 5, 72, "D");
      pushRow("MID", 3, 53, "M", 24, 76);
      pushRow("ATT", 2, 34, "A", 30, 70);
      break;
    case "4-2-4":
      pushRow("DEF", 4, 72, "D");
      pushRow("MID", 2, 56, "M", 35, 65);
      pushRow("ATT", 4, 34, "A");
      break;
    default:
      pushRow("DEF", 4, 72, "D");
      pushRow("MID", 4, 53, "M");
      pushRow("ATT", 2, 34, "A", 30, 70);
      break;
  }

  return slots;
}

function spreadX(count: number, min: number, max: number): number[] {
  if (count <= 1) {
    return [50];
  }

  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, index) => min + step * index);
}

function shortStarterLabel(name: string): string {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (normalized.length <= 12) {
    return normalized;
  }

  const parts = normalized.split(" ");
  if (parts.length < 2) {
    return normalized.slice(0, 12);
  }

  const firstInitial = `${parts[0].charAt(0).toUpperCase()}.`;
  const lastName = parts[parts.length - 1];
  const compact = `${firstInitial} ${lastName}`;

  if (compact.length <= 12) {
    return compact;
  }

  return `${firstInitial} ${lastName.slice(0, 8)}`;
}

function autoPickBestXi(players: SquadPlayer[], formation: FormationCode): { startingIds: number[] } | null {
  const available = players.filter((player) => player.stamina > 0).sort((a, b) => b.overall - a.overall);

  if (available.length < 11) {
    return null;
  }

  const slotCounts = FORMATION_POSITION_COUNTS[formation];
  const slots: Position[] = [
    "GK",
    ...Array.from({ length: slotCounts.DEF }, () => "DEF" as const),
    ...Array.from({ length: slotCounts.MID }, () => "MID" as const),
    ...Array.from({ length: slotCounts.ATT }, () => "ATT" as const),
  ];

  const pickedIds: number[] = [];
  const used = new Set<number>();

  for (const slot of slots) {
    const options = available.filter((candidate) => !used.has(candidate.id) && canPlaySlot(slot, candidate.position));
    if (!options.length) {
      return null;
    }

    options.sort((a, b) => scoreForSlot(slot, b) - scoreForSlot(slot, a));
    const best = options[0];
    pickedIds.push(best.id);
    used.add(best.id);
  }

  if (pickedIds.length !== 11) {
    return null;
  }

  return { startingIds: pickedIds };
}

function canPlaySlot(slot: Position, playerPosition: Position): boolean {
  if (slot === "GK") return playerPosition === "GK";
  if (playerPosition === "GK") return false;
  return true;
}

function scoreForSlot(slot: Position, player: SquadPlayer): number {
  const fit = getPositionFitMultiplier(slot, player.position);
  return player.overall * fit + player.stamina * 0.035;
}

function getPositionFitMultiplier(slot: Position, playerPosition: Position): number {
  if (slot === playerPosition) return 1;
  if (slot === "GK" || playerPosition === "GK") return 0;

  if (slot === "DEF" && playerPosition === "MID") return 0.86;
  if (slot === "MID" && (playerPosition === "DEF" || playerPosition === "ATT")) return 0.84;
  if (slot === "ATT" && playerPosition === "MID") return 0.86;
  if ((slot === "ATT" && playerPosition === "DEF") || (slot === "DEF" && playerPosition === "ATT")) return 0.62;

  return 0.8;
}
