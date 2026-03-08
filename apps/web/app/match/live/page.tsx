"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { MatchRuntimeResult, SubmitMatchRequest } from "../../../../../packages/game-core/src";
import { useSubmitMatchMutation } from "../../../src/state/apis/gameApi";
import { readApiErrorMessage } from "../../../src/lib/api-error";
import type { RootState } from "../../../src/state/store";
import { setMatchEvents, setMatchSubmission } from "../../../src/state/slices/matchSlice";

type MountedPhaserMatch = {
  destroy: () => void;
  getResult: () => MatchRuntimeResult;
};

export default function MatchLivePage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const prep = useSelector((state: RootState) => state.match.matchPrep);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountedSimRef = useRef<MountedPhaserMatch | null>(null);
  const [simulation, setSimulation] = useState<MatchRuntimeResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const [submitMatch, submitState] = useSubmitMatchMutation();

  useEffect(() => {
    return () => {
      mountedSimRef.current?.destroy();
      mountedSimRef.current = null;
    };
  }, []);

  if (!prep) {
    return (
      <main className="page-panel">
        <h2 className="page-title">Match Live</h2>
        <p className="feedback error">No active match prep found. Start from match prep first.</p>
        <div className="inline">
          <Link href="/match/prep" className="btn">
            Open Match Prep
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-panel">
      <h2 className="page-title">Match Live</h2>
      <p className="page-copy">Phaser mini-sim powered by shared match engine, then validated via `/api/match/submit`.</p>

      <div className="inline" style={{ marginBottom: 12 }}>
        <span className="label-pill">Opponent: {prep.opponentName}</span>
        <span className="label-pill">Rank: #{prep.opponentRank}</span>
        <span className="label-pill">Strength: {prep.yourTeamOverall} vs {prep.opponentTeamOverall}</span>
        <span className="label-pill">Attack: {prep.yourArcadeRatings.attack} vs {prep.opponentArcadeRatings.attack}</span>
        <span className="label-pill">Defense: {prep.yourArcadeRatings.defense} vs {prep.opponentArcadeRatings.defense}</span>
      </div>

      <div className="inline" style={{ marginBottom: 12 }}>
        <button
          type="button"
          onClick={async () => {
            mountedSimRef.current?.destroy();
            mountedSimRef.current = null;
            setSimulation(null);
            setIsRunning(true);

            if (!containerRef.current) {
              setIsRunning(false);
              return;
            }

            const { mountPhaserMatchSimulation } = await import("../../../src/match/phaser-match-simulation");

            const mounted = mountPhaserMatchSimulation(
              containerRef.current,
              {
                matchSeed: prep.matchSeed,
                homeTeam: {
                  name: "Your Team",
                  strength: prep.yourTeamOverall,
                  attackRating: prep.yourArcadeRatings.attack,
                  defenseRating: prep.yourArcadeRatings.defense,
                  controlRating: prep.yourArcadeRatings.control,
                  goalkeepingRating: prep.yourArcadeRatings.goalkeeping,
                  staminaRating: prep.yourArcadeRatings.stamina,
                },
                awayTeam: {
                  name: prep.opponentName,
                  strength: prep.opponentTeamOverall,
                  attackRating: prep.opponentArcadeRatings.attack,
                  defenseRating: prep.opponentArcadeRatings.defense,
                  controlRating: prep.opponentArcadeRatings.control,
                  goalkeepingRating: prep.opponentArcadeRatings.goalkeeping,
                  staminaRating: prep.opponentArcadeRatings.stamina,
                },
              },
              {
                width: 390,
                height: 780,
                onResolved: (resolved) => {
                  setSimulation(resolved);
                  dispatch(setMatchEvents(resolved.events));
                  setIsRunning(false);
                },
              }
            );

            mountedSimRef.current = mounted;
          }}
          disabled={isRunning}
        >
          {isRunning ? "Match In Progress..." : simulation ? "Re-Simulate Match" : "Run Simulation"}
        </button>

        <button
          type="button"
          disabled={!simulation || isRunning || submitState.isLoading}
          onClick={async () => {
            if (!simulation) return;

            const payload: SubmitMatchRequest = {
              matchSeed: prep.matchSeed,
              opponentClubId: prep.opponentClubId,
              clubGoals: simulation.homeGoals,
              opponentGoals: simulation.awayGoals,
              durationSeconds: simulation.durationSeconds,
              endReason: simulation.endReason,
              simulationPayload: {
                events: simulation.events,
                result: simulation.result,
                summary: simulation.summary,
              },
            };

            const submission = await submitMatch(payload).unwrap();
            dispatch(setMatchSubmission(submission));
            router.push("/match/result");
          }}
        >
          {submitState.isLoading ? "Submitting..." : "Submit Match Result"}
        </button>
      </div>

      <div ref={containerRef} className="match-sim-root" />

      {isRunning ? <p className="feedback">Match running. Wait for full-time before submission.</p> : null}
      {simulation ? (
        <p className="feedback">
          Simulated: {simulation.homeGoals}-{simulation.awayGoals} ({simulation.result}) ending via {simulation.endReason}.
        </p>
      ) : null}

      {submitState.isError ? (
        <p className="feedback error">
          Match submission failed: {readApiErrorMessage(submitState.error) || "Server validation rejected payload."}
        </p>
      ) : null}
    </main>
  );
}
