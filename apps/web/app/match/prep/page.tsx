"use client";

import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { useStartMatchMutation } from "../../../src/state/apis/gameApi";
import { ProgressRow } from "../../../src/components/progress-row";
import { readApiErrorMessage } from "../../../src/lib/api-error";
import type { RootState } from "../../../src/state/store";
import { setMatchPrep } from "../../../src/state/slices/matchSlice";

export default function MatchPrepPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const prep = useSelector((state: RootState) => state.match.matchPrep);
  const [startMatch, startState] = useStartMatchMutation();

  return (
    <main className="page-panel page-panel-portrait">
      <h2 className="page-title">Match Day</h2>
      <p className="page-copy">3-minute arcade simulation with server-validated result.</p>

      {prep ? (
        <section className="onboarding-card section-pad">
          <h3>Pre-Match</h3>
          <div className="grid cards">
            <div className="stat-card">
              <p className="stat-label">Opponent</p>
              <p className="stat-value">{prep.opponentName}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Your Rank</p>
              <p className="stat-value">#{prep.yourRank}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Opponent Rank</p>
              <p className="stat-value">#{prep.opponentRank}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Strength</p>
              <p className="stat-value">{prep.yourTeamOverall} vs {prep.opponentTeamOverall}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Formation</p>
              <p className="stat-value">{prep.yourFormation} vs {prep.opponentFormation}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Attack</p>
              <p className="stat-value">{prep.yourArcadeRatings.attack} vs {prep.opponentArcadeRatings.attack}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Defense</p>
              <p className="stat-value">{prep.yourArcadeRatings.defense} vs {prep.opponentArcadeRatings.defense}</p>
            </div>
          </div>
          <div className="progress-stack" style={{ marginTop: 10 }}>
            <ProgressRow
              label="Formation Fit"
              value={Math.max(0, Math.min(100, 50 + (prep.yourTeamOverall - prep.opponentTeamOverall) * 2))}
              tone="cyan"
            />
            <ProgressRow
              label="Stamina Edge"
              value={Math.max(0, Math.min(100, 50 + (prep.yourArcadeRatings.stamina - prep.opponentArcadeRatings.stamina) * 4))}
              tone="green"
            />
            <ProgressRow
              label="Momentum"
              value={Math.max(0, Math.min(100, 50 + (prep.yourArcadeRatings.control - prep.opponentArcadeRatings.control) * 4))}
              tone="gold"
            />
          </div>
          <div className="inline" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="no-hover-lift"
              onClick={() => {
                router.push("/match/live");
              }}
            >
              Continue To Live Match
            </button>
          </div>
        </section>
      ) : null}

      <section className="onboarding-card section-pad">
        <h3>Find Opponent</h3>
        <p className="feedback">Server validates lineup and stamina before generating matchup.</p>
        <div className="inline">
          <button
            type="button"
            className="no-hover-lift"
            disabled={startState.isLoading}
            onClick={async () => {
              const started = await startMatch().unwrap();
              dispatch(setMatchPrep(started));
              router.push("/match/live");
            }}
          >
            {startState.isLoading ? "Finding..." : "Start New Match"}
          </button>
        </div>
        {startState.isError ? (
          <p className="feedback error">
            {readApiErrorMessage(startState.error) || "Unable to start match. Check Squad lineup and stamina."}
          </p>
        ) : null}
      </section>
    </main>
  );
}
