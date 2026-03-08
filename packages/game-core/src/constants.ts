import type { FormationCode, LeagueCode, Rarity } from "./types";

export const MAX_SQUAD_SIZE = 28;
export const MIN_STARTING_PLAYERS = 11;
export const MIN_GOALKEEPERS = 1;
export const STARTING_SQUAD_SPLIT = { GK: 2, DEF: 5, MID: 5, ATT: 3 } as const;

export const MATCH_DURATION_SECONDS = 180;
export const MAX_EVENT_GAP_SECONDS = 20;
export const MAX_TOTAL_GOALS = 10;
export const EARLY_FINISH_GOAL_LEAD = 3;

export const DAILY_REWARD_COINS = 200;
export const DAILY_REWARD_RESET_HOUR = 1;

export const PACK_PRICES = [250, 500, 1000, 2500, 5000, 10000] as const;

export const RARITY_CAPS: Record<Rarity, number> = {
  COMMON: 55,
  RARE: 75,
  EPIC: 90,
  LEGENDARY: 100,
};

export const FORMATIONS: FormationCode[] = ["4-4-2", "4-3-3", "4-5-1", "4-2-3-1", "3-5-2", "5-3-2", "4-2-4"];

export const FORMATION_UNLOCK_WINS: Partial<Record<FormationCode, number>> = {
  "4-3-3": 3,
  "4-5-1": 5,
};

export const LEAGUE_PROMOTION_THRESHOLDS: Partial<Record<LeagueCode, number>> = {
  BEGINNER_I: 25,
  BEGINNER_II: 50,
  BEGINNER_III: 75,
  BRONZE_I: 125,
  BRONZE_II: 175,
  BRONZE_III: 225,
  SILVER_I: 300,
  SILVER_II: 375,
  SILVER_III: 450,
  GOLD_I: 550,
  GOLD_II: 650,
  GOLD_III: 750,
  PLATINUM_I: 1000,
  PLATINUM_II: 1500,
  PLATINUM_III: 2000,
};
