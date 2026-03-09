"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  const runtimeResult = useSelector((state: RootState) => state.match.runtimeResult);
  const [claimPromotion, promotionState] = useClaimPromotionRewardMutation();
  const [stage, setStage] = useState(1);
  const chanceOutcomes = runtimeResult?.chanceOutcomes || [];
  const chanceCount = chanceOutcomes.length;
  const convertedChances = chanceOutcomes.filter((entry) => entry.scored).length;
  const conversionPct = chanceCount ? `${Math.round((convertedChances / chanceCount) * 100)}%` : "-";
  const perfectTaps = chanceOutcomes.filter((entry) => entry.tapQuality === "PERFECT").length;
  const goodTaps = chanceOutcomes.filter((entry) => entry.tapQuality === "GOOD").length;
  const poorTaps = chanceOutcomes.filter((entry) => entry.tapQuality === "POOR").length;

  useEffect(() => {
    setStage(1);
  }, [result?.goals.club, result?.goals.opponent, result?.result]);

  useEffect(() => {
    if (!result || stage >= 4) {
      return;
    }

    const timeout = setTimeout(() => {
      setStage((value) => Math.min(4, value + 1));
    }, 900);

    return () => clearTimeout(timeout);
  }, [result, stage]);

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
      <p className="page-copy">Rewards and progression are revealed in stages. Tap skip to show all immediately.</p>

      <div className="inline" style={{ marginBottom: 10 }}>
        <span className="label-pill">Stage {stage}/4</span>
        {stage < 4 ? (
          <button type="button" onClick={() => setStage(4)}>
            Skip Reveal
          </button>
        ) : null}
      </div>

      {stage >= 1 ? (
        <section className="grid cards" style={{ marginBottom: 12 }}>
          <StatCard label="Opponent" value={prep.opponentName} />
          <StatCard label="Result" value={result.result} tone={result.result === "WIN" ? "good" : result.result === "LOSS" ? "warn" : "neutral"} />
          <StatCard label="Score" value={`${result.goals.club} - ${result.goals.opponent}`} />
        </section>
      ) : null}

      {stage >= 2 ? (
        <section className="grid cards">
          <StatCard label="Coins Earned" value={String(result.rewards.coins)} tone="good" />
          <StatCard label="League Points" value={String(result.rewards.points)} />
          <StatCard label="Manager EXP" value={String(result.rewards.managerExp)} />
        </section>
      ) : null}

      {stage >= 3 ? (
        <section className="grid cards" style={{ marginTop: 12 }}>
          <StatCard label="Starter EXP" value={String(result.rewards.starterExp)} />
          <StatCard label="Team Overall" value={String(result.teamOverall)} />
          <StatCard label="League Movement" value={result.promotionEligible ? "Promotion Ready" : "Stay In Current Tier"} tone={result.promotionEligible ? "good" : "neutral"} />
        </section>
      ) : null}

      {stage >= 4 ? (
        <section className="grid cards" style={{ marginTop: 12 }}>
          <StatCard label="Chances" value={chanceCount ? String(chanceCount) : "-"} />
          <StatCard label="Converted Chances" value={chanceCount ? String(convertedChances) : "-"} />
          <StatCard label="Conversion Rate" value={conversionPct} tone={chanceCount ? "good" : "neutral"} />
          <StatCard label="Perfect Taps" value={chanceCount ? String(perfectTaps) : "-"} />
          <StatCard label="Good Taps" value={chanceCount ? String(goodTaps) : "-"} />
          <StatCard label="Poor Taps" value={chanceCount ? String(poorTaps) : "-"} tone={poorTaps > perfectTaps ? "warn" : "neutral"} />
        </section>
      ) : null}

      {stage >= 4 && result.promotionEligible ? (
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

      {stage >= 4 ? (
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
      ) : null}
      {stage < 4 ? (
        <div className="inline" style={{ marginTop: 14 }}>
          <span className="feedback">Auto-revealing next stage...</span>
        </div>
      ) : null}

      {stage < 4 ? (
        <div className="inline" style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={() => {
              setStage((value) => Math.min(4, value + 1));
            }}
          >
            Next Stage
          </button>
        </div>
      ) : null}
    </main>
  );
}
