"use client";

import { useEffect, useRef, useState } from "react";
import type { MatchSimulationOutput, SubmitMatchRequest } from "../../../../../packages/game-core/src";
import { useStartMatchMutation, useSubmitMatchMutation } from "../../../src/state/apis/gameApi";

type MountedPhaserMatch = {
  result: MatchSimulationOutput;
  destroy: () => void;
};

export default function MatchLivePage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountedSimRef = useRef<MountedPhaserMatch | null>(null);
  const [simulation, setSimulation] = useState<MatchSimulationOutput | null>(null);
  const [opponentClubId, setOpponentClubId] = useState<number | null>(null);
  const [matchSeed, setMatchSeed] = useState<string | null>(null);

  const [startMatch, startState] = useStartMatchMutation();
  const [submitMatch, submitState] = useSubmitMatchMutation();

  useEffect(() => {
    return () => {
      mountedSimRef.current?.destroy();
      mountedSimRef.current = null;
    };
  }, []);

  return (
    <main className="page-panel">
      <h2 className="page-title">Match Live</h2>
      <p className="page-copy">Phaser mini-sim powered by shared match engine, then validated via `/api/match/submit`.</p>

      <div className="inline" style={{ marginBottom: 12 }}>
        <button
          type="button"
          disabled={startState.isLoading}
          onClick={async () => {
            const start = await startMatch().unwrap();

            mountedSimRef.current?.destroy();
            mountedSimRef.current = null;

            if (!containerRef.current) {
              return;
            }

            const { mountPhaserMatchSimulation } = await import("../../../src/match/phaser-match-simulation");

            const mounted = mountPhaserMatchSimulation(
              containerRef.current,
              {
                seed: start.matchSeed,
                homeTeamStrength: start.yourClub.teamOverall,
                awayTeamStrength: start.opponent.teamOverall,
              },
              {
                homeName: "Your Team",
                awayName: start.opponent.name,
                width: 390,
                height: 780,
              }
            );

            mountedSimRef.current = mounted;
            setSimulation(mounted.result);
            setOpponentClubId(start.opponent.clubId);
            setMatchSeed(start.matchSeed);
          }}
        >
          {startState.isLoading ? "Starting..." : "Start Match"}
        </button>

        <button
          type="button"
          disabled={!simulation || !matchSeed || submitState.isLoading}
          onClick={async () => {
            if (!simulation || !matchSeed) return;

            const payload: SubmitMatchRequest = {
              matchSeed,
              opponentClubId: opponentClubId || undefined,
              clubGoals: simulation.homeGoals,
              opponentGoals: simulation.awayGoals,
              durationSeconds: simulation.durationSeconds,
              endReason: simulation.endReason,
              simulationPayload: {
                events: simulation.events,
                result: simulation.result,
              },
            };

            await submitMatch(payload).unwrap();
          }}
        >
          {submitState.isLoading ? "Submitting..." : "Submit Match Result"}
        </button>
      </div>

      <div ref={containerRef} className="match-sim-root" />

      {startState.isError && <p className="feedback error">Match start failed. Validate lineup and stamina in Squad screen.</p>}

      {simulation ? (
        <p className="feedback">
          Simulated: {simulation.homeGoals}-{simulation.awayGoals} ({simulation.result}) ending via {simulation.endReason}.
        </p>
      ) : null}

      {submitState.isSuccess ? <p className="feedback">Match result submitted and progression applied.</p> : null}
      {submitState.isError ? <p className="feedback error">Match submission failed validation on server.</p> : null}
    </main>
  );
}
