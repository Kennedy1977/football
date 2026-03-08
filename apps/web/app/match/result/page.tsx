"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { useClaimPromotionRewardMutation } from "../../../src/state/apis/gameApi";
import { readApiErrorMessage } from "../../../src/lib/api-error";
import type { RootState } from "../../../src/state/store";
import { clearMatchState } from "../../../src/state/slices/matchSlice";
import { StatCard } from "../../../src/components/stat-card";

export default function MatchResultPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const prep = useSelector((state: RootState) => state.match.matchPrep);
  const result = useSelector((state: RootState) => state.match.lastSubmission);
  const [claimPromotion, promotionState] = useClaimPromotionRewardMutation();

  if (!prep || !result) {
    return (
      <main className="page-panel">
        <h2 className="page-title">Match Result</h2>
        <p className="feedback error">No submitted match result found. Complete a live match first.</p>
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
      <h2 className="page-title">Match Result</h2>
      <p className="page-copy">Rewards and progression from the latest submitted match.</p>

      <section className="grid cards" style={{ marginBottom: 12 }}>
        <StatCard label="Opponent" value={prep.opponentName} />
        <StatCard label="Result" value={result.result} tone={result.result === "WIN" ? "good" : result.result === "LOSS" ? "warn" : "neutral"} />
        <StatCard label="Score" value={`${result.goals.club} - ${result.goals.opponent}`} />
      </section>

      <section className="grid cards">
        <StatCard label="Coins Earned" value={String(result.rewards.coins)} tone="good" />
        <StatCard label="League Points" value={String(result.rewards.points)} />
        <StatCard label="Manager EXP" value={String(result.rewards.managerExp)} />
        <StatCard label="Starter EXP" value={String(result.rewards.starterExp)} />
        <StatCard label="Team Overall" value={String(result.teamOverall)} />
        <StatCard label="Promotion" value={result.promotionEligible ? "Eligible" : "Not Yet"} tone={result.promotionEligible ? "good" : "neutral"} />
      </section>

      {result.promotionEligible ? (
        <section className="onboarding-card">
          <h3>Promotion Reward</h3>
          <p className="feedback">Threshold reached. Claim promotion reward to advance league tier.</p>
          <div className="inline">
            <button
              type="button"
              disabled={promotionState.isLoading}
              onClick={async () => {
                await claimPromotion().unwrap();
              }}
            >
              {promotionState.isLoading ? "Claiming..." : "Claim Promotion Reward"}
            </button>
          </div>
          {promotionState.isError ? (
            <p className="feedback error">{readApiErrorMessage(promotionState.error) || "Promotion claim failed."}</p>
          ) : null}
          {promotionState.isSuccess ? (
            <p className="feedback">
              Promotion claimed: {promotionState.data.fromLeague} to {promotionState.data.toLeague}.
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="inline" style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={() => {
            dispatch(clearMatchState());
            router.push("/match/prep");
          }}
        >
          Play Next Match
        </button>
        <Link href="/home" className="btn">
          Back To Dashboard
        </Link>
      </div>
    </main>
  );
}
