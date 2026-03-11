"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { MATCH_DURATION_SECONDS, type MatchChanceOutcome, type SubmitMatchResponse } from "../../../../../packages/game-core/src";
import { useClaimPromotionRewardMutation } from "../../../src/state/apis/gameApi";
import { readApiErrorMessage } from "../../../src/lib/api-error";
import type { RootState } from "../../../src/state/store";
import { clearMatchState } from "../../../src/state/slices/matchSlice";

type ResultTab = "timeline" | "lineups" | "stats";

interface TimelineEntry {
  id: string;
  minute: string;
  side: "HOME" | "AWAY";
  detail: string;
  isGoal: boolean;
}

interface TeamStatRow {
  label: string;
  home: string;
  away: string;
  winner: "HOME" | "AWAY" | "EVEN";
}

export default function MatchResultPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const prep = useSelector((state: RootState) => state.match.matchPrep);
  const result = useSelector((state: RootState) => state.match.lastSubmission);
  const runtimeResult = useSelector((state: RootState) => state.match.runtimeResult);
  const yourClubName = useSelector((state: RootState) => state.club.club?.name ?? "Your Club");
  const [claimPromotion, promotionState] = useClaimPromotionRewardMutation();
  const [activeTab, setActiveTab] = useState<ResultTab>("stats");

  const chanceOutcomes = runtimeResult?.chanceOutcomes ?? [];
  const homeBadgeCode = toClubCode(yourClubName);
  const awayBadgeCode = toClubCode(prep?.opponentName ?? "Opponent");
  const matchDateLabel = useMemo(() => formatUiDate(new Date()), []);

  useEffect(() => {
    setActiveTab("stats");
  }, [result?.goals.club, result?.goals.opponent, result?.result]);

  if (!prep || !result) {
    return (
      <main className="page-panel page-panel-portrait">
        <h2 className="page-title">Match Result</h2>
        <p className="feedback error">No submitted match result found. Complete a live match first.</p>
        <div className="inline">
          <Link href="/match/prep" className="btn no-hover-lift">
            Open Match Prep
          </Link>
        </div>
      </main>
    );
  }

  const homeGoalMoments = buildGoalMoments("HOME", chanceOutcomes, result.goals.club);
  const awayGoalMoments = buildGoalMoments("AWAY", chanceOutcomes, result.goals.opponent);
  const timeline = buildTimelineEntries(chanceOutcomes, result);
  const teamStats = buildTeamStats(prep, result, chanceOutcomes);

  return (
    <main className="page-panel page-panel-portrait fulltime-layout">
      <section className="onboarding-card section-pad fulltime-hero">
        <div className="fulltime-meta-row">
          <p className="fulltime-meta-copy">League Match · {matchDateLabel}</p>
          <p className="fulltime-status">Full-time</p>
        </div>

        <div className="fulltime-score-row">
          <div className="fulltime-team-block">
            <FakeClubBadge code={homeBadgeCode} side="HOME" />
            <p className="fulltime-team-name">{yourClubName}</p>
          </div>

          <div className="fulltime-scoreline" aria-label={`Final score ${result.goals.club} to ${result.goals.opponent}`}>
            <span>{result.goals.club}</span>
            <span className="fulltime-score-separator">-</span>
            <span>{result.goals.opponent}</span>
          </div>

          <div className="fulltime-team-block">
            <FakeClubBadge code={awayBadgeCode} side="AWAY" />
            <p className="fulltime-team-name">{prep.opponentName}</p>
          </div>
        </div>

        <p className="fulltime-round-copy">Rank #{prep.yourRank} vs Rank #{prep.opponentRank}</p>

        <div className="fulltime-goal-row">
          <div className="fulltime-goal-list">
            {homeGoalMoments.length ? (
              homeGoalMoments.map((minute, index) => (
                <p key={`home-goal-${minute}-${index}`}>{`Goal ${index + 1} ${minute}`}</p>
              ))
            ) : (
              <p>No goals</p>
            )}
          </div>

          <p className="fulltime-goal-label">Goals</p>

          <div className="fulltime-goal-list away">
            {awayGoalMoments.length ? (
              awayGoalMoments.map((minute, index) => (
                <p key={`away-goal-${minute}-${index}`}>{`Goal ${index + 1} ${minute}`}</p>
              ))
            ) : (
              <p>No goals</p>
            )}
          </div>
        </div>
      </section>

      <div className="fulltime-tab-row" role="tablist" aria-label="Result detail tabs">
        <button
          type="button"
          className={`fulltime-tab-button ${activeTab === "timeline" ? "is-active" : ""}`}
          onClick={() => setActiveTab("timeline")}
          role="tab"
          aria-selected={activeTab === "timeline"}
        >
          Timeline
        </button>
        <button
          type="button"
          className={`fulltime-tab-button ${activeTab === "lineups" ? "is-active" : ""}`}
          onClick={() => setActiveTab("lineups")}
          role="tab"
          aria-selected={activeTab === "lineups"}
        >
          Lineups
        </button>
        <button
          type="button"
          className={`fulltime-tab-button ${activeTab === "stats" ? "is-active" : ""}`}
          onClick={() => setActiveTab("stats")}
          role="tab"
          aria-selected={activeTab === "stats"}
        >
          Stats
        </button>
      </div>

      {activeTab === "timeline" ? (
        <section className="onboarding-card section-pad">
          <h3>Timeline</h3>
          <ul className="fulltime-timeline-list">
            {timeline.map((entry) => (
              <li key={entry.id} className={`fulltime-timeline-item ${entry.isGoal ? "is-goal" : ""}`}>
                <span className="fulltime-timeline-minute">{entry.minute}</span>
                <span className="fulltime-timeline-side">{entry.side === "HOME" ? "You" : "Opp"}</span>
                <span className="fulltime-timeline-detail">{entry.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activeTab === "lineups" ? (
        <section className="onboarding-card section-pad">
          <h3>Lineups</h3>
          <p className="feedback">Detailed lineups replay is not available yet. Placeholder uses current team ratings.</p>
          <div className="fulltime-lineup-placeholder">
            <div>
              <strong>{yourClubName}</strong>
              <span>Overall {prep.yourTeamOverall}</span>
            </div>
            <div>
              <strong>{prep.opponentName}</strong>
              <span>Overall {prep.opponentTeamOverall}</span>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "stats" ? (
        <section className="onboarding-card section-pad">
          <div className="fulltime-stats-head">
            <FakeClubBadge code={homeBadgeCode} side="HOME" compact />
            <h3>Team Stats</h3>
            <FakeClubBadge code={awayBadgeCode} side="AWAY" compact />
          </div>
          <div className="fulltime-stats-table">
            {teamStats.map((row) => (
              <div key={row.label} className="fulltime-stats-row">
                <span className={`fulltime-stats-value home ${row.winner === "HOME" ? "is-leading" : ""}`}>{row.home}</span>
                <span className="fulltime-stats-label">{row.label}</span>
                <span className={`fulltime-stats-value away ${row.winner === "AWAY" ? "is-leading" : ""}`}>{row.away}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {result.promotionEligible ? (
        <section className="onboarding-card section-pad">
          <h3>Promotion Reward</h3>
          <p className="feedback">Threshold reached. Claim promotion reward to advance league tier.</p>
          <div className="inline">
            <button
              type="button"
              className="no-hover-lift"
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

      <section className="onboarding-card section-pad">
        <h3>Rewards</h3>
        <div className="fulltime-reward-grid">
          <div className="fulltime-reward-tile">
            <span>Coins</span>
            <strong>+{result.rewards.coins}</strong>
          </div>
          <div className="fulltime-reward-tile">
            <span>League Points</span>
            <strong>+{result.rewards.points}</strong>
          </div>
          <div className="fulltime-reward-tile">
            <span>Manager EXP</span>
            <strong>+{result.rewards.managerExp}</strong>
          </div>
          <div className="fulltime-reward-tile">
            <span>Starter EXP</span>
            <strong>+{result.rewards.starterExp}</strong>
          </div>
        </div>
      </section>

      <div className="inline" style={{ marginTop: 2 }}>
        <button
          type="button"
          className="no-hover-lift"
          onClick={() => {
            dispatch(clearMatchState());
            router.push("/match/prep");
          }}
        >
          Play Next Match
        </button>
        <Link href="/home" className="btn no-hover-lift">
          Back To Dashboard
        </Link>
      </div>
    </main>
  );
}

function FakeClubBadge({
  code,
  side,
  compact = false,
}: {
  code: string;
  side: "HOME" | "AWAY";
  compact?: boolean;
}) {
  return (
    <span className={`fulltime-fake-badge ${side === "HOME" ? "is-home" : "is-away"} ${compact ? "is-compact" : ""}`} aria-hidden="true">
      {code}
    </span>
  );
}

function buildGoalMoments(side: "HOME" | "AWAY", outcomes: MatchChanceOutcome[], fallbackGoalCount: number): string[] {
  const goals = outcomes
    .filter((entry) => entry.attackingSide === side && entry.scored)
    .sort((a, b) => a.second - b.second)
    .map((entry) => formatMatchMinute(entry.second));

  if (goals.length) {
    return goals;
  }

  if (fallbackGoalCount <= 0) {
    return [];
  }

  return Array.from({ length: fallbackGoalCount }, (_, index) => {
    const minute = Math.round(((index + 1) * 90) / (fallbackGoalCount + 1));
    return `${minute}'`;
  });
}

function buildTimelineEntries(outcomes: MatchChanceOutcome[], result: SubmitMatchResponse): TimelineEntry[] {
  const mapped = outcomes
    .slice()
    .sort((a, b) => a.second - b.second)
    .map((entry, index) => ({
      id: `tl-${entry.eventIndex}-${entry.second}-${index}`,
      minute: formatMatchMinute(entry.second),
      side: entry.attackingSide,
      detail: entry.scored ? `${readChanceTypeLabel(entry.chanceType)} converted` : `${readChanceTypeLabel(entry.chanceType)} saved`,
      isGoal: entry.scored,
    }));

  if (mapped.length) {
    return mapped;
  }

  if (result.goals.club === 0 && result.goals.opponent === 0) {
    return [
      {
        id: "tl-no-events",
        minute: "90'",
        side: "HOME",
        detail: "No major chances recorded",
        isGoal: false,
      },
    ];
  }

  const fallbackHome = buildGoalMoments("HOME", [], result.goals.club).map((minute, index) => ({
    id: `tl-fallback-home-${index}`,
    minute,
    side: "HOME" as const,
    detail: "Goal",
    isGoal: true,
  }));

  const fallbackAway = buildGoalMoments("AWAY", [], result.goals.opponent).map((minute, index) => ({
    id: `tl-fallback-away-${index}`,
    minute,
    side: "AWAY" as const,
    detail: "Goal",
    isGoal: true,
  }));

  return [...fallbackHome, ...fallbackAway].sort((a, b) => toMinuteValue(a.minute) - toMinuteValue(b.minute));
}

function buildTeamStats(prep: NonNullable<RootState["match"]["matchPrep"]>, result: SubmitMatchResponse, outcomes: MatchChanceOutcome[]): TeamStatRow[] {
  const homeGoals = result.goals.club;
  const awayGoals = result.goals.opponent;

  const homeShots = outcomes.filter((entry) => entry.attackingSide === "HOME").length || homeGoals;
  const awayShots = outcomes.filter((entry) => entry.attackingSide === "AWAY").length || awayGoals;

  const homeOnTarget = Math.min(homeShots, Math.max(homeGoals, Math.round(homeShots * 0.7)));
  const awayOnTarget = Math.min(awayShots, Math.max(awayGoals, Math.round(awayShots * 0.7)));

  const homeXg = outcomes
    .filter((entry) => entry.attackingSide === "HOME")
    .reduce((sum, entry) => sum + Number(entry.scoreProbability || 0), 0);
  const awayXg = outcomes
    .filter((entry) => entry.attackingSide === "AWAY")
    .reduce((sum, entry) => sum + Number(entry.scoreProbability || 0), 0);

  const homeControl = prep.yourArcadeRatings.control;
  const awayControl = prep.opponentArcadeRatings.control;
  const controlTotal = Math.max(1, homeControl + awayControl);
  const homePossession = clampInt(18, 82, Math.round((homeControl / controlTotal) * 100));
  const awayPossession = 100 - homePossession;

  const homePasses = Math.max(120, Math.round(homePossession * 5.6 + prep.yourTeamOverall * 2.2));
  const awayPasses = Math.max(120, Math.round(awayPossession * 5.6 + prep.opponentTeamOverall * 2.2));

  const homePassAccuracy = clampInt(
    61,
    95,
    Math.round(57 + prep.yourArcadeRatings.control * 0.35 + prep.yourArcadeRatings.stamina * 0.18 - prep.opponentArcadeRatings.defense * 0.11)
  );
  const awayPassAccuracy = clampInt(
    61,
    95,
    Math.round(57 + prep.opponentArcadeRatings.control * 0.35 + prep.opponentArcadeRatings.stamina * 0.18 - prep.yourArcadeRatings.defense * 0.11)
  );

  const homeCorners = Math.max(0, Math.round(homeShots * 0.38 + homeGoals * 0.4));
  const awayCorners = Math.max(0, Math.round(awayShots * 0.38 + awayGoals * 0.4));

  const homeBigChances = outcomes.filter((entry) => entry.attackingSide === "HOME" && Number(entry.scoreProbability || 0) >= 0.5).length;
  const awayBigChances = outcomes.filter((entry) => entry.attackingSide === "AWAY" && Number(entry.scoreProbability || 0) >= 0.5).length;

  return [
    { label: "Shots", home: String(homeShots), away: String(awayShots), winner: pickHigher(homeShots, awayShots) },
    { label: "Shots on target", home: String(homeOnTarget), away: String(awayOnTarget), winner: pickHigher(homeOnTarget, awayOnTarget) },
    { label: "Possession", home: `${homePossession}%`, away: `${awayPossession}%`, winner: pickHigher(homePossession, awayPossession) },
    { label: "xG", home: homeXg.toFixed(2), away: awayXg.toFixed(2), winner: pickHigher(homeXg, awayXg) },
    { label: "Passes", home: String(homePasses), away: String(awayPasses), winner: pickHigher(homePasses, awayPasses) },
    { label: "Pass accuracy", home: `${homePassAccuracy}%`, away: `${awayPassAccuracy}%`, winner: pickHigher(homePassAccuracy, awayPassAccuracy) },
    { label: "Big chances", home: String(homeBigChances), away: String(awayBigChances), winner: pickHigher(homeBigChances, awayBigChances) },
    { label: "Corners", home: String(homeCorners), away: String(awayCorners), winner: pickHigher(homeCorners, awayCorners) },
  ];
}

function formatUiDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

function formatMatchMinute(seconds: number): string {
  const totalVirtualSeconds = toVirtualSeconds(seconds);
  const minute = Math.max(1, Math.min(90, Math.ceil(totalVirtualSeconds / 60)));
  return `${minute}'`;
}

function toVirtualSeconds(seconds: number): number {
  const clamped = Math.max(0, Math.min(seconds, MATCH_DURATION_SECONDS));
  return Math.round((clamped / Math.max(1, MATCH_DURATION_SECONDS)) * 90 * 60);
}

function toMinuteValue(label: string): number {
  const raw = Number(label.replace("'", ""));
  return Number.isFinite(raw) ? raw : 999;
}

function pickHigher(home: number, away: number): "HOME" | "AWAY" | "EVEN" {
  if (home > away) return "HOME";
  if (away > home) return "AWAY";
  return "EVEN";
}

function toClubCode(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "FC";
  }

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  const initials = words.slice(0, 3).map((word) => word[0] || "");
  return initials.join("").toUpperCase();
}

function clampInt(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function readChanceTypeLabel(type: string): string {
  switch (type) {
    case "CENTRAL_SHOT":
      return "Central Shot";
    case "ANGLED_SHOT":
      return "Angled Shot";
    case "CLOSE_RANGE":
      return "Close-Range";
    case "ONE_ON_ONE":
      return "One-on-One";
    default:
      return type;
  }
}
