import type { ArcadeTeamRatings, FormationCode, LeagueCode, MatchEndReason, MatchResult, Position, Rarity } from "./types";

export interface ApiManagerSummary {
  id: number;
  name: string;
  level: number;
  exp: number;
}

export interface ApiClubSummary {
  id: number;
  name: string;
  city: string;
  stadiumName: string;
  coins: number;
  teamOverall: number;
  league: LeagueCode | string;
}

export interface ApiPlayerSummary {
  id: number;
  name: string;
  age: number;
  shirtNumber: number;
  position: Position;
  rarity: Rarity;
  overall: number;
  level: number;
  exp: number;
  stamina: number;
  isStarting: boolean;
  isBench: boolean;
}

export interface CreateManagerRequest {
  email?: string;
  name: string;
  age?: number;
  gender?: string;
  avatar?: Record<string, unknown>;
}

export interface CreateManagerResponse {
  created: boolean;
  manager: ApiManagerSummary;
}

export interface SyncAuthSessionRequest {
  clerkUserId?: string;
  email?: string;
  confirmLink?: boolean;
}

export interface SyncAuthSessionResponse {
  synced: true;
  created: boolean;
  linkedExistingEmail: boolean;
  account: {
    id: number;
    clerkUserId: string;
    email: string;
  };
}

export interface ClubIdentityPayload {
  clubName: string;
  city: string;
  stadiumName: string;
  badge?: Record<string, unknown>;
  homeKit?: Record<string, unknown>;
  awayKit?: Record<string, unknown>;
}

export interface CreateOrResetClubResponse {
  created?: boolean;
  reset?: boolean;
  retainedCoins?: number;
  club: {
    id: number;
    clubName: string;
    city: string;
    stadiumName: string;
    coins: number;
    teamOverall: number;
    league: LeagueCode | string;
    squadSize: number;
    formation: FormationCode;
  };
}

export interface DashboardSummaryResponse {
  onboardingComplete: boolean;
  manager: ApiManagerSummary;
  club: ApiClubSummary | null;
  dailyReward?: {
    coins: number;
    claimed: boolean;
    nextResetAt: string;
  };
}

export interface SquadResponse {
  squadSize: number;
  players: ApiPlayerSummary[];
  lineup: {
    formation: FormationCode | string;
    startingPlayerIds: number[];
    benchPlayerIds: number[];
  } | null;
  unlockedFormations: string[];
}

export interface UpdateLineupRequest {
  formation: FormationCode;
  startingPlayerIds: number[];
  benchPlayerIds: number[];
}

export interface UpdateLineupResponse {
  updated: boolean;
  lineup: UpdateLineupRequest;
  teamOverall: number;
}

export interface SellPlayerRequest {
  playerId: number;
}

export interface SellPlayerResponse {
  sold: boolean;
  player: {
    id: number;
    name: string;
    rarity: Rarity;
    overall: number;
    wasStarter: boolean;
  };
  coinsAwarded: number;
  warning: string | null;
}

export interface StartMatchResponse {
  matchSeed: string;
  rules: {
    maxDurationSeconds: number;
    maxTotalGoals: number;
    earlyFinishGoalLead: number;
  };
  yourClub: {
    clubId: number;
    teamOverall: number;
    rank: number;
    arcadeRatings: ArcadeTeamRatings;
  };
  opponent: {
    clubId: number;
    name: string;
    teamOverall: number;
    rank: number;
    arcadeRatings: ArcadeTeamRatings;
  };
}

export interface SubmitMatchRequest {
  matchSeed: string;
  opponentClubId?: number;
  clubGoals: number;
  opponentGoals: number;
  durationSeconds: number;
  endReason: MatchEndReason;
  simulationPayload?: unknown;
}

export interface SubmitMatchResponse {
  accepted: boolean;
  result: MatchResult;
  goals: {
    club: number;
    opponent: number;
  };
  rewards: {
    coins: number;
    managerExp: number;
    starterExp: number;
    points: number;
  };
  teamOverall: number;
  promotionEligible: boolean;
}

export interface PackDefinition {
  id: number;
  code: string;
  name: string;
  priceCoins: number;
  rewardCount: number;
  rarityHint: string;
  rewardFocus: string;
  odds: unknown;
}

export interface GetPacksResponse {
  packs: PackDefinition[];
}

export interface PurchasePackRequest {
  packCode?: string;
  packId?: number;
}

export interface PurchasePackResponse {
  purchased: boolean;
  pack: {
    id: number;
    code: string;
    name: string;
    priceCoins: number;
  };
  purchaseId: number;
  remainingCoins: number;
  rewards: Array<{
    rewardId: number;
    type: "PLAYER";
    player: {
      name: string;
      age: number;
      position: Position;
      rarity: Rarity;
      overall: number;
      shirtNumber: number;
      stats: {
        pace: number;
        shooting: number;
        passing: number;
        dribbling: number;
        defending: number;
        strength: number;
        goalkeeping: number;
      };
    };
    keepAvailable: boolean;
    convertCoins: number;
    convertExp: number;
  }>;
}

export interface RewardDecisionRequest {
  rewardId: number;
  decision: "KEEP" | "CONVERT_COINS" | "CONVERT_EXP";
  targetPlayerId?: number;
}

export type RewardDecisionResponse =
  | {
      resolved: true;
      decision: "KEEP";
      rewardId: number;
      player: {
        id: number;
        name: string;
        age: number;
        position: Position;
        rarity: Rarity;
        overall: number;
        shirtNumber: number;
      };
    }
  | {
      resolved: true;
      decision: "CONVERT_COINS";
      rewardId: number;
      coinsAwarded: number;
      clubCoins: number;
    }
  | {
      resolved: true;
      decision: "CONVERT_EXP";
      rewardId: number;
      expAwarded: number;
      targetPlayer: {
        id: number;
        overall: number;
        level: number;
        exp: number;
      };
    };

export interface DailyClaimResponse {
  claimed: boolean;
  rewardDate?: string;
  coinsAwarded?: number;
  clubCoins?: number;
  nextResetAt: string;
  message?: string;
}

export interface PromotionClaimResponse {
  claimed: boolean;
  fromLeague: LeagueCode | string;
  toLeague: LeagueCode | string;
  rewards: {
    coins: number;
    managerExp: number;
  };
}

export interface LeagueTableResponse {
  league: LeagueCode | string;
  userRank: number;
  legendsDivision: number | null;
  table: Array<{
    rank: number;
    clubId: number;
    clubName: string;
    matchesPlayed: number;
    points: number;
    wins: number;
    draws: number;
    losses: number;
    goalDifference: number;
    goalsFor: number;
    movement: string;
  }>;
}

export interface LegendsTableResponse {
  league: "LEGENDS";
  division: number;
  userRank: number;
  nearby: Array<{
    rank: number;
    clubId: number;
    clubName: string;
    points: number;
    record: string;
    goalDifference: number;
    goalsFor: number;
  }>;
}
