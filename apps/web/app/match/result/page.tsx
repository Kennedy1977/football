"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { MATCH_DURATION_SECONDS, type MatchChanceOutcome, type SubmitMatchResponse } from "../../../../../packages/game-core/src";
import { useClaimPromotionRewardMutation, useGetDashboardSummaryQuery, useGetSquadQuery } from "../../../src/state/apis/gameApi";
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

interface GoalMoment {
  id: string;
  minute: string;
  scorer: string;
}

interface MatchNarrative {
  homeGoals: GoalMoment[];
  awayGoals: GoalMoment[];
  timeline: TimelineEntry[];
}

interface SquadPlayerLite {
  id: number;
  name: string;
  shirtNumber: number;
  position: string;
}

const EMPTY_MATCH_NARRATIVE: MatchNarrative = {
  homeGoals: [],
  awayGoals: [],
  timeline: [],
};

export default function MatchResultPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const prep = useSelector((state: RootState) => state.match.matchPrep);
  const result = useSelector((state: RootState) => state.match.lastSubmission);
  const runtimeResult = useSelector((state: RootState) => state.match.runtimeResult);
  const clubNameFromState = useSelector((state: RootState) => state.club.club?.name ?? null);
  const [claimPromotion, promotionState] = useClaimPromotionRewardMutation();
  const { data: squadData } = useGetSquadQuery();
  const { data: dashboardData } = useGetDashboardSummaryQuery();
  const [activeTab, setActiveTab] = useState<ResultTab>("stats");

  const yourClubName = clubNameFromState || dashboardData?.club?.name || "Home Club";
  const chanceOutcomes = runtimeResult?.chanceOutcomes ?? [];
  const homeBadgeCode = toClubCode(yourClubName);
  const awayBadgeCode = toClubCode(prep?.opponentName ?? "Opponent");
  const matchDateLabel = useMemo(() => formatUiDate(new Date()), []);

  const startingXi = useMemo(() => {
    const players = (squadData?.players ?? []) as SquadPlayerLite[];
    const lineup = squadData?.lineup;
    if (!lineup || !lineup.startingPlayerIds.length) {
      return [] as SquadPlayerLite[];
    }

    const playersById = new Map(players.map((player) => [player.id, player]));
    const positionOrder: Record<string, number> = { GK: 0, DEF: 1, MID: 2, ATT: 3 };

    return lineup.startingPlayerIds
      .map((id) => playersById.get(id))
      .filter((player): player is SquadPlayerLite => Boolean(player))
      .sort((a, b) => {
        const posDelta = (positionOrder[a.position] ?? 9) - (positionOrder[b.position] ?? 9);
        if (posDelta !== 0) {
          return posDelta;
        }
        return a.shirtNumber - b.shirtNumber;
      });
  }, [squadData?.lineup, squadData?.players]);

  const homeScorerPool = useMemo(() => buildHomeScorerPool(startingXi), [startingXi]);
  const awayScorerPool = useMemo(() => buildOpponentScorerPool(prep?.opponentName ?? "Opponent"), [prep?.opponentName]);

  const narrative = useMemo(() => {
    if (!result) {
      return EMPTY_MATCH_NARRATIVE;
    }
    return buildMatchNarrative(chanceOutcomes, result, homeScorerPool, awayScorerPool);
  }, [chanceOutcomes, result, homeScorerPool, awayScorerPool]);

  const teamStats = useMemo(() => {
    if (!prep || !result) {
      return [] as TeamStatRow[];
    }
    return buildTeamStats(prep, result, chanceOutcomes);
  }, [prep, result, chanceOutcomes]);

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
            {narrative.homeGoals.length ? (
              narrative.homeGoals.map((goal) => (
                <p key={goal.id}>
                  <span className="fulltime-goal-scorer">{goal.scorer}</span>
                  <span className="fulltime-goal-minute">{goal.minute}</span>
                </p>
              ))
            ) : (
              <p>No goals</p>
            )}
          </div>

          <p className="fulltime-goal-label">Goals</p>

          <div className="fulltime-goal-list away">
            {narrative.awayGoals.length ? (
              narrative.awayGoals.map((goal) => (
                <p key={goal.id}>
                  <span className="fulltime-goal-scorer">{goal.scorer}</span>
                  <span className="fulltime-goal-minute">{goal.minute}</span>
                </p>
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
            {narrative.timeline.map((entry) => (
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
          <p className="feedback">
            {squadData?.lineup?.formation
              ? `Formation ${String(squadData.lineup.formation)} · Opponent lineup is currently hidden in v1.`
              : "Saved lineup not found yet. Set your XI in Squad to populate this section."}
          </p>
          <div className="fulltime-lineup-placeholder">
            <div>
              <strong>{yourClubName}</strong>
              <span>Overall {prep.yourTeamOverall}</span>
              {startingXi.length ? (
                <ul className="fulltime-lineup-list">
                  {startingXi.map((player) => (
                    <li key={`lineup-${player.id}`}>
                      <span>#{player.shirtNumber}</span>
                      <span>{player.name}</span>
                      <span>{player.position}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div>
              <strong>{prep.opponentName}</strong>
              <span>Overall {prep.opponentTeamOverall}</span>
              <p className="fulltime-lineup-note">Opponent player list is not returned by the API yet.</p>
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

function buildMatchNarrative(
  outcomes: MatchChanceOutcome[],
  result: SubmitMatchResponse,
  homeScorers: string[],
  awayScorers: string[]
): MatchNarrative {
  const sortedOutcomes = outcomes.slice().sort((a, b) => (a.second !== b.second ? a.second - b.second : a.eventIndex - b.eventIndex));
  const homeGoals: GoalMoment[] = [];
  const awayGoals: GoalMoment[] = [];
  const timeline: TimelineEntry[] = [];
  let homeGoalIndex = 0;
  let awayGoalIndex = 0;

  for (const entry of sortedOutcomes) {
    const minute = formatMatchMinute(entry.second);
    if (!entry.scored) {
      timeline.push({
        id: `tl-${entry.eventIndex}-${entry.second}`,
        minute,
        side: entry.attackingSide,
        detail: `${readChanceTypeLabel(entry.chanceType)} saved`,
        isGoal: false,
      });
      continue;
    }

    if (entry.attackingSide === "HOME") {
      const scorer = pickScorer(homeScorers, "HOME", homeGoalIndex);
      homeGoals.push({
        id: `goal-home-${entry.eventIndex}-${homeGoalIndex}`,
        minute,
        scorer,
      });
      timeline.push({
        id: `tl-goal-home-${entry.eventIndex}-${homeGoalIndex}`,
        minute,
        side: "HOME",
        detail: `${scorer} scored (${readChanceTypeLabel(entry.chanceType)})`,
        isGoal: true,
      });
      homeGoalIndex += 1;
    } else {
      const scorer = pickScorer(awayScorers, "AWAY", awayGoalIndex);
      awayGoals.push({
        id: `goal-away-${entry.eventIndex}-${awayGoalIndex}`,
        minute,
        scorer,
      });
      timeline.push({
        id: `tl-goal-away-${entry.eventIndex}-${awayGoalIndex}`,
        minute,
        side: "AWAY",
        detail: `${scorer} scored (${readChanceTypeLabel(entry.chanceType)})`,
        isGoal: true,
      });
      awayGoalIndex += 1;
    }
  }

  for (let i = homeGoals.length; i < result.goals.club; i += 1) {
    const minute = makeFallbackMinute(i, result.goals.club);
    const scorer = pickScorer(homeScorers, "HOME", i);
    homeGoals.push({
      id: `goal-home-fallback-${i}`,
      minute,
      scorer,
    });
    timeline.push({
      id: `tl-goal-home-fallback-${i}`,
      minute,
      side: "HOME",
      detail: `${scorer} scored`,
      isGoal: true,
    });
  }

  for (let i = awayGoals.length; i < result.goals.opponent; i += 1) {
    const minute = makeFallbackMinute(i, result.goals.opponent);
    const scorer = pickScorer(awayScorers, "AWAY", i);
    awayGoals.push({
      id: `goal-away-fallback-${i}`,
      minute,
      scorer,
    });
    timeline.push({
      id: `tl-goal-away-fallback-${i}`,
      minute,
      side: "AWAY",
      detail: `${scorer} scored`,
      isGoal: true,
    });
  }

  if (timeline.length === 0) {
    timeline.push({
      id: "tl-no-events",
      minute: "90'",
      side: "HOME",
      detail: "No major chances recorded",
      isGoal: false,
    });
  }

  homeGoals.sort((a, b) => toMinuteValue(a.minute) - toMinuteValue(b.minute));
  awayGoals.sort((a, b) => toMinuteValue(a.minute) - toMinuteValue(b.minute));
  timeline.sort((a, b) => toMinuteValue(a.minute) - toMinuteValue(b.minute));

  return {
    homeGoals,
    awayGoals,
    timeline,
  };
}

function buildHomeScorerPool(players: SquadPlayerLite[]): string[] {
  if (!players.length) {
    return [];
  }

  const ordered = [
    ...players.filter((player) => player.position === "ATT"),
    ...players.filter((player) => player.position === "MID"),
    ...players.filter((player) => player.position === "DEF"),
    ...players.filter((player) => player.position === "GK"),
  ];

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const player of ordered) {
    if (!player.name || seen.has(player.name)) {
      continue;
    }
    seen.add(player.name);
    deduped.push(player.name);
  }

  return deduped;
}

function buildOpponentScorerPool(opponentName: string): string[] {
  const firstNames = ["Luca", "Mason", "Theo", "Noah", "Kai", "Evan", "Ruben", "Diego", "Finn", "Owen", "Enzo", "Leo"];
  const lastNames = ["Grant", "Nolan", "Santos", "Ryder", "Walsh", "Diaz", "Foster", "Byrne", "Parker", "Murphy", "Cole", "Reed"];
  const seed = hashString(opponentName);

  return Array.from({ length: 11 }, (_, index) => {
    const first = firstNames[(seed + index * 3) % firstNames.length];
    const last = lastNames[(seed + index * 5) % lastNames.length];
    return `${first} ${last}`;
  });
}

function pickScorer(pool: string[], side: "HOME" | "AWAY", index: number): string {
  if (pool.length) {
    return pool[index % pool.length];
  }
  return side === "HOME" ? `Home Player ${index + 1}` : `Away Player ${index + 1}`;
}

function makeFallbackMinute(goalIndex: number, totalGoals: number): string {
  const minute = Math.round(((goalIndex + 1) * 90) / Math.max(1, totalGoals + 1));
  return `${minute}'`;
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

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
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
