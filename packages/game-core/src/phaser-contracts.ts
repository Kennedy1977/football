import type { MatchChanceEvent, MatchEndReason, MatchResult } from "./types";

export interface MatchRuntimeTeamConfig {
  name: string;
  strength: number;
  attackRating?: number;
  defenseRating?: number;
  controlRating?: number;
  goalkeepingRating?: number;
  staminaRating?: number;
  momentumBias?: number;
}

export interface MatchRuntimeRulesConfig {
  durationSeconds: number;
  maxTotalGoals: number;
  earlyFinishGoalLead: number;
  maxChanceGapSeconds: number;
}

export interface MatchRuntimeConfig {
  matchSeed: string;
  homeTeam: MatchRuntimeTeamConfig;
  awayTeam: MatchRuntimeTeamConfig;
  rules?: Partial<MatchRuntimeRulesConfig>;
}

export type MatchChanceType = "CENTRAL_SHOT" | "ANGLED_SHOT" | "CLOSE_RANGE" | "ONE_ON_ONE";
export type MatchTapQuality = "PERFECT" | "GOOD" | "POOR";

export interface MatchChanceOutcome {
  eventIndex: number;
  second: number;
  attackingSide: "HOME" | "AWAY";
  chanceType: MatchChanceType;
  tapQuality: MatchTapQuality;
  tapped: boolean;
  baseQuality: number;
  scoreProbability: number;
  scored: boolean;
}

export interface MatchRuntimeResult {
  matchSeed: string;
  result: MatchResult;
  endReason: MatchEndReason;
  durationSeconds: number;
  homeGoals: number;
  awayGoals: number;
  events: MatchChanceEvent[];
  chanceOutcomes: MatchChanceOutcome[];
  summary: {
    scoreline: string;
    totalGoals: number;
  };
}
