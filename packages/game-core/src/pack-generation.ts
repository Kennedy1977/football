import { PACK_PRICES, RARITY_CAPS } from "./constants";
import type { Position, Rarity, StatBlock } from "./types";

const FIRST_NAMES = [
  "Luca",
  "Milo",
  "Ravi",
  "Noah",
  "Ethan",
  "Ari",
  "Mateo",
  "Sami",
  "Nico",
  "Leo",
  "Kai",
  "Ruben",
  "Theo",
  "Jalen",
  "Iker",
  "Omar",
  "Dani",
  "Hugo",
  "Mason",
  "Alex",
];

const LAST_NAMES = [
  "Silva",
  "Diaz",
  "Walker",
  "Khan",
  "Costa",
  "Mendes",
  "Santos",
  "Reed",
  "Nolan",
  "Campbell",
  "Rossi",
  "Navarro",
  "Patel",
  "Bauer",
  "Okafor",
  "Hayes",
  "Farah",
  "Molina",
  "Cole",
  "Parker",
];

export interface PackSquadSnapshotPlayer {
  position: Position;
  overall: number;
}

export interface PackGenerationInput {
  seed: string;
  packPrice: number;
  odds: Record<string, number>;
  squad: PackSquadSnapshotPlayer[];
  currentTeamOverall: number;
}

export interface GeneratedPackPlayer {
  name: string;
  age: number;
  position: Position;
  rarity: Rarity;
  overall: number;
  shirtNumber: number;
  stats: StatBlock;
}

export function generatePackPlayer(input: PackGenerationInput): GeneratedPackPlayer {
  const random = createSeededRng(input.seed);
  const rarity = rollRarity(input.odds, random);
  const position = pickPositionByNeed(input.squad, random);
  const overall = generateOverall({
    rarity,
    packPrice: input.packPrice,
    currentTeamOverall: input.currentTeamOverall,
    random,
  });

  return {
    name: `${pick(random, FIRST_NAMES)} ${pick(random, LAST_NAMES)}`,
    age: randomInt(random, 17, 36),
    position,
    rarity,
    overall,
    shirtNumber: randomInt(random, 1, 99),
    stats: generateStats(position, overall, random),
  };
}

function rollRarity(odds: Record<string, number>, random: () => number): Rarity {
  const normalized = normalizeOdds(odds);
  const roll = random();

  let cursor = 0;
  for (const rarity of ["COMMON", "RARE", "EPIC", "LEGENDARY"] as const) {
    cursor += normalized[rarity];
    if (roll <= cursor) return rarity;
  }

  return "COMMON";
}

function normalizeOdds(odds: Record<string, number>): Record<Rarity, number> {
  const raw: Record<Rarity, number> = {
    COMMON: toPositive(odds.common),
    RARE: toPositive(odds.rare),
    EPIC: toPositive(odds.epic),
    LEGENDARY: toPositive(odds.legendary),
  };

  const sum = raw.COMMON + raw.RARE + raw.EPIC + raw.LEGENDARY;
  if (sum <= 0) {
    return { COMMON: 0.8, RARE: 0.18, EPIC: 0.02, LEGENDARY: 0 };
  }

  return {
    COMMON: raw.COMMON / sum,
    RARE: raw.RARE / sum,
    EPIC: raw.EPIC / sum,
    LEGENDARY: raw.LEGENDARY / sum,
  };
}

function pickPositionByNeed(squad: PackSquadSnapshotPlayer[], random: () => number): Position {
  const positions: Position[] = ["GK", "DEF", "MID", "ATT"];
  const desiredCounts: Record<Position, number> = {
    GK: 3,
    DEF: 9,
    MID: 9,
    ATT: 7,
  };

  const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  const totals: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };

  for (const player of squad) {
    counts[player.position] += 1;
    totals[player.position] += player.overall;
  }

  const avgByPos: Record<Position, number> = {
    GK: counts.GK ? totals.GK / counts.GK : 0,
    DEF: counts.DEF ? totals.DEF / counts.DEF : 0,
    MID: counts.MID ? totals.MID / counts.MID : 0,
    ATT: counts.ATT ? totals.ATT / counts.ATT : 0,
  };

  const avgOverall = squad.length ? squad.reduce((sum, p) => sum + p.overall, 0) / squad.length : 40;

  const weights = positions.map((position) => {
    const countNeed = Math.max(0, desiredCounts[position] - counts[position]);
    const weakness = Math.max(0, avgOverall - avgByPos[position]);

    let score = 1 + countNeed * 1.8 + weakness / 22;

    if (position === "GK" && counts.GK <= 1) {
      score += 3;
    }

    return { position, weight: score };
  });

  return weightedPick(weights, random);
}

function generateOverall(input: {
  rarity: Rarity;
  packPrice: number;
  currentTeamOverall: number;
  random: () => number;
}): number {
  const { rarity, packPrice, currentTeamOverall, random } = input;
  const tier = resolvePackTier(packPrice);

  const tierBonus = [-3, 0, 3, 7, 11, 15][tier] ?? 0;
  const rarityBonus: Record<Rarity, number> = {
    COMMON: 0,
    RARE: 5,
    EPIC: 10,
    LEGENDARY: 16,
  };

  const variance = randomInt(random, -4, 5);
  const raw = currentTeamOverall + tierBonus + rarityBonus[rarity] + variance;

  return Number(clamp(raw, 30, RARITY_CAPS[rarity]).toFixed(2));
}

function resolvePackTier(packPrice: number): number {
  const index = PACK_PRICES.findIndex((price) => price === packPrice);
  if (index !== -1) return index;

  if (packPrice <= PACK_PRICES[0]) return 0;
  if (packPrice >= PACK_PRICES[PACK_PRICES.length - 1]) return PACK_PRICES.length - 1;

  for (let i = 0; i < PACK_PRICES.length - 1; i += 1) {
    if (packPrice >= PACK_PRICES[i] && packPrice < PACK_PRICES[i + 1]) {
      return i;
    }
  }

  return 0;
}

function generateStats(position: Position, overall: number, random: () => number): StatBlock {
  const variance = () => randomInt(random, -5, 5);

  if (position === "GK") {
    return {
      pace: clamp(18 + variance(), 10, 70),
      shooting: clamp(14 + variance(), 8, 60),
      passing: clamp(overall - 3 + variance(), 12, 95),
      dribbling: clamp(overall - 5 + variance(), 10, 95),
      defending: clamp(overall - 2 + variance(), 12, 95),
      strength: clamp(overall + variance(), 12, 95),
      goalkeeping: clamp(overall + 10 + variance(), 12, 100),
    };
  }

  if (position === "DEF") {
    return {
      pace: clamp(overall - 1 + variance(), 12, 95),
      shooting: clamp(overall - 9 + variance(), 8, 90),
      passing: clamp(overall - 2 + variance(), 12, 95),
      dribbling: clamp(overall - 3 + variance(), 10, 95),
      defending: clamp(overall + 8 + variance(), 12, 100),
      strength: clamp(overall + 5 + variance(), 12, 100),
      goalkeeping: clamp(10 + variance(), 5, 50),
    };
  }

  if (position === "MID") {
    return {
      pace: clamp(overall + variance(), 12, 98),
      shooting: clamp(overall - 1 + variance(), 10, 98),
      passing: clamp(overall + 8 + variance(), 12, 100),
      dribbling: clamp(overall + 6 + variance(), 12, 100),
      defending: clamp(overall + variance(), 10, 95),
      strength: clamp(overall - 1 + variance(), 10, 95),
      goalkeeping: clamp(8 + variance(), 5, 45),
    };
  }

  return {
    pace: clamp(overall + 5 + variance(), 12, 100),
    shooting: clamp(overall + 9 + variance(), 12, 100),
    passing: clamp(overall + variance(), 10, 98),
    dribbling: clamp(overall + 7 + variance(), 12, 100),
    defending: clamp(overall - 8 + variance(), 8, 90),
    strength: clamp(overall + 2 + variance(), 10, 98),
    goalkeeping: clamp(8 + variance(), 5, 40),
  };
}

function weightedPick(items: Array<{ position: Position; weight: number }>, random: () => number): Position {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (total <= 0) {
    return items[0].position;
  }

  let roll = random() * total;

  for (const item of items) {
    roll -= Math.max(0, item.weight);
    if (roll <= 0) {
      return item.position;
    }
  }

  return items[items.length - 1].position;
}

function pick<T>(random: () => number, values: T[]): T {
  return values[Math.floor(random() * values.length)];
}

function randomInt(random: () => number, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function createSeededRng(seed: string): () => number {
  let hash = 2166136261;

  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return () => {
    hash += 0x6d2b79f5;
    let t = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toPositive(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}
