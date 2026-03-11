"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { MatchRuntimeResult, SubmitMatchRequest } from "../../../../../packages/game-core/src";
import { ProgressRow } from "../../../src/components/progress-row";
import { readApiErrorMessage } from "../../../src/lib/api-error";
import { useGetDashboardSummaryQuery, useSubmitMatchMutation } from "../../../src/state/apis/gameApi";
import type { RootState } from "../../../src/state/store";
import { setMatchEvents, setMatchRuntimeResult, setMatchSubmission } from "../../../src/state/slices/matchSlice";

type MountedPhaserMatch = {
  destroy: () => void;
  getResult: () => MatchRuntimeResult;
};

export default function MatchLivePage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const prep = useSelector((state: RootState) => state.match.matchPrep);
  const clubNameFromState = useSelector((state: RootState) => state.club.club?.name ?? null);
  const { data: dashboardData } = useGetDashboardSummaryQuery();
  const yourClubName = clubNameFromState || dashboardData?.club?.name || "Home Club";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountedSimRef = useRef<MountedPhaserMatch | null>(null);
  const [simulation, setSimulation] = useState<MatchRuntimeResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [hasSessionStarted, setHasSessionStarted] = useState(false);

  const [submitMatch, submitState] = useSubmitMatchMutation();

  useEffect(() => {
    return () => {
      mountedSimRef.current?.destroy();
      mountedSimRef.current = null;
    };
  }, []);

  const submitSimulationResult = async (resolved: MatchRuntimeResult) => {
    if (!prep) return;

    const payload: SubmitMatchRequest = {
      matchSeed: prep.matchSeed,
      opponentClubId: prep.opponentClubId,
      clubGoals: resolved.homeGoals,
      opponentGoals: resolved.awayGoals,
      durationSeconds: resolved.durationSeconds,
      endReason: resolved.endReason,
      simulationPayload: {
        events: resolved.events,
        chanceOutcomes: resolved.chanceOutcomes,
        result: resolved.result,
        summary: resolved.summary,
      },
    };

    try {
      const submission = await submitMatch(payload).unwrap();
      dispatch(setMatchSubmission(submission));
      router.push("/match/result");
    } catch {
      // Error is rendered using submitState below.
    }
  };

  const startLiveMatch = async () => {
    if (!prep || isRunning || submitState.isLoading || hasSessionStarted) {
      return;
    }

    mountedSimRef.current?.destroy();
    mountedSimRef.current = null;
    setSimulation(null);
    setHasSessionStarted(true);
    setIsRunning(true);
    dispatch(setMatchRuntimeResult(null));
    await waitForNextFrame();

    if (!containerRef.current) {
      setIsRunning(false);
      setHasSessionStarted(false);
      return;
    }
    const dimensions = getSimulationViewport(containerRef.current);

    try {
      const { mountPhaserMatchSimulation } = await import("../../../src/match/phaser-match-simulation");

      const mounted = mountPhaserMatchSimulation(
        containerRef.current,
        {
          matchSeed: prep.matchSeed,
          homeTeam: {
            name: yourClubName,
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
          width: dimensions.width,
          height: dimensions.height,
          onResolved: (resolved) => {
            setSimulation(resolved);
            dispatch(setMatchEvents(resolved.events));
            dispatch(setMatchRuntimeResult(resolved));
            setIsRunning(false);
            void submitSimulationResult(resolved);
          },
        }
      );

      mountedSimRef.current = mounted;
    } catch {
      setIsRunning(false);
      setHasSessionStarted(false);
    }
  };

  if (!prep) {
    return (
      <main className="page-panel page-panel-portrait">
        <p className="feedback error">No active match prep found. Start from match prep first.</p>
        <div className="inline">
          <Link href="/match/prep" className="btn no-hover-lift">
            Open Match Prep
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-panel page-panel-portrait">
      {!hasSessionStarted ? (
        <section className="onboarding-card section-pad match-live-metrics-top">
          <div className="progress-stack compact">
            <ProgressRow label="Team Strength" value={prep.yourTeamOverall} valueText={`${prep.yourTeamOverall}`} tone="cyan" />
            <ProgressRow
              label="Attack Matchup"
              value={Math.max(0, Math.min(100, 50 + (prep.yourArcadeRatings.attack - prep.opponentArcadeRatings.defense) * 5))}
              tone="green"
            />
            <ProgressRow
              label="Defensive Matchup"
              value={Math.max(0, Math.min(100, 50 + (prep.yourArcadeRatings.defense - prep.opponentArcadeRatings.attack) * 5))}
              tone="gold"
            />
          </div>
        </section>
      ) : null}

      {!hasSessionStarted ? (
        <section className="onboarding-card section-pad">
          <div className="match-kickoff-pitch" role="img" aria-label="Kick-off pitch preview">
            <div className="match-kickoff-meta">
              <span className="label-pill">Club: {yourClubName}</span>
              <span className="label-pill">Opponent: {prep.opponentName}</span>
              <span className="label-pill">Rank: #{prep.opponentRank}</span>
            </div>
            <button
              type="button"
              className="match-kickoff-button"
              onClick={startLiveMatch}
              disabled={isRunning || submitState.isLoading}
            >
              {isRunning ? "Starting..." : "Kick Off"}
            </button>
          </div>
        </section>
      ) : null}

      <div className="match-sim-shell" style={{ marginTop: 12, display: hasSessionStarted ? "block" : "none" }}>
        <div ref={containerRef} className="match-sim-root" />
      </div>

      {submitState.isLoading ? <p className="feedback">Full-time reached. Submitting match result...</p> : null}
      {simulation && !submitState.isLoading ? (
        <p className="feedback">
          Simulated: {simulation.homeGoals}-{simulation.awayGoals} ({simulation.result}) via {simulation.endReason}.
        </p>
      ) : null}

      {submitState.isError ? (
        <p className="feedback error">
          Match submission failed: {readApiErrorMessage(submitState.error) || "Server validation rejected payload."}
        </p>
      ) : null}

      {submitState.isError ? (
        <div className="inline" style={{ marginTop: 10 }}>
          <Link href="/match/prep" className="btn no-hover-lift">
            Back To Match Prep
          </Link>
        </div>
      ) : null}
    </main>
  );
}

function getSimulationViewport(container: HTMLDivElement): { width: number; height: number } {
  const rect = container.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900;
  const topOffset = Math.floor(rect.top || 0);
  const availableHeight = Math.max(520, viewportHeight - topOffset - 18);

  return {
    width,
    height: availableHeight,
  };
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}
