export type Position = "GK" | "DEF" | "MID" | "ATT";
export type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
export type MatchResult = "WIN" | "DRAW" | "LOSS";
export type MatchEndReason = "THREE_GOAL_LEAD" | "TEN_TOTAL_GOALS" | "TIMER_EXPIRED";

export interface StatBlock {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  strength: number;
  goalkeeping: number;
}

export interface PlayerCard {
  id: string;
  name: string;
  position: Position;
  rarity: Rarity;
  overall: number;
  level: number;
  exp: number;
  stamina: number;
  isStarting: boolean;
  stats: StatBlock;
}

export interface Lineup {
  formation: FormationCode;
  startingPlayerIds: string[];
  benchPlayerIds: string[];
}

export interface ManagerProfile {
  id: string;
  name: string;
  level: number;
  exp: number;
  wins: number;
}

export interface ClubSummary {
  id: string;
  managerId: string;
  clubName: string;
  city: string;
  stadiumName: string;
  coins: number;
  teamOverall: number;
  leagueCode: LeagueCode;
}

export type FormationCode = "4-4-2" | "4-3-3" | "4-5-1" | "4-2-3-1" | "3-5-2" | "5-3-2" | "4-2-4";

export type LeagueCode =
  | "BEGINNER_I"
  | "BEGINNER_II"
  | "BEGINNER_III"
  | "BRONZE_I"
  | "BRONZE_II"
  | "BRONZE_III"
  | "SILVER_I"
  | "SILVER_II"
  | "SILVER_III"
  | "GOLD_I"
  | "GOLD_II"
  | "GOLD_III"
  | "PLATINUM_I"
  | "PLATINUM_II"
  | "PLATINUM_III"
  | "LEGENDS";

export interface MatchSimulationInput {
  seed: string;
  homeTeamStrength: number;
  awayTeamStrength: number;
  homeMomentumBias?: number;
  awayMomentumBias?: number;
}

export interface MatchChanceEvent {
  second: number;
  attackingSide: "HOME" | "AWAY";
  quality: number;
  scored: boolean;
}

export interface MatchSimulationOutput {
  result: MatchResult;
  endReason: MatchEndReason;
  durationSeconds: number;
  homeGoals: number;
  awayGoals: number;
  events: MatchChanceEvent[];
}
