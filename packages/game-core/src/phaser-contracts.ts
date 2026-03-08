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

export interface MatchRuntimeResult {
  matchSeed: string;
  result: MatchResult;
  endReason: MatchEndReason;
  durationSeconds: number;
  homeGoals: number;
  awayGoals: number;
  events: MatchChanceEvent[];
  summary: {
    scoreline: string;
    totalGoals: number;
  };
}
