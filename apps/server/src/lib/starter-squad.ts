import type { Position } from "../../../../packages/game-core/src/types";
import { STARTING_SQUAD_SPLIT } from "../../../../packages/game-core/src/constants";

export interface StarterPlayerRow {
  name: string;
  age: number;
  shirt_number: number;
  position: Position;
  rarity: "COMMON";
  overall_rating: number;
  level: number;
  exp: number;
  exp_to_next: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  strength: number;
  goalkeeping: number;
  stamina: number;
  is_starting: boolean;
  is_bench: boolean;
  portrait_seed: string;
}

const FIRST_NAMES = [
  "Luca",
  "Jay",
  "Mason",
  "Ravi",
  "Ethan",
  "Noah",
  "Dani",
  "Leo",
  "Kai",
  "Mateo",
  "Ari",
  "Sam",
  "Tariq",
  "Niko",
  "Zane",
  "Alex",
  "Ruben",
  "Chris",
  "Iker",
  "Hugo",
];

const LAST_NAMES = [
  "Walker",
  "Silva",
  "Santos",
  "Reed",
  "Khan",
  "Parker",
  "Costa",
  "Diaz",
  "Nolan",
  "Rossi",
  "Hayes",
  "Cole",
  "Molina",
  "Navarro",
  "Patel",
  "Okafor",
  "Mendes",
  "Campbell",
  "Bauer",
  "Farah",
];

const STARTING_SLOT_ORDER: Position[] = [
  "GK",
  "DEF",
  "DEF",
  "DEF",
  "DEF",
  "MID",
  "MID",
  "MID",
  "MID",
  "ATT",
  "ATT",
];

const SHIRT_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21];
const POSITION_ORDER: Position[] = ["GK", "DEF", "MID", "ATT"];

export function generateStarterSquad(seedSource: string): StarterPlayerRow[] {
  const random = createSeededRng(seedSource);

  const starterPositions: Position[] = [...STARTING_SLOT_ORDER];
  const starterCounts = starterPositions.reduce<Record<Position, number>>(
    (acc, position) => {
      acc[position] += 1;
      return acc;
    },
    { GK: 0, DEF: 0, MID: 0, ATT: 0 }
  );

  const benchPositions = POSITION_ORDER.flatMap((position) =>
    createPositionArray(position, Math.max(0, STARTING_SQUAD_SPLIT[position] - starterCounts[position]))
  );

  const positions: Position[] = [...starterPositions, ...benchPositions];

  return positions.map((position, index) => {
    const baseOverall = baseOverallForPosition(position, random);
    const stats = buildStats(position, baseOverall, random);
    const isStarter = index < STARTING_SLOT_ORDER.length;

    return {
      name: `${pick(random, FIRST_NAMES)} ${pick(random, LAST_NAMES)}`,
      age: randomInt(random, 17, 32),
      shirt_number: SHIRT_NUMBERS[index],
      position,
      rarity: "COMMON",
      overall_rating: computeOverall(position, stats),
      level: 1,
      exp: 0,
      exp_to_next: 100,
      pace: stats.pace,
      shooting: stats.shooting,
      passing: stats.passing,
      dribbling: stats.dribbling,
      defending: stats.defending,
      strength: stats.strength,
      goalkeeping: stats.goalkeeping,
      stamina: 100,
      is_starting: isStarter,
      is_bench: !isStarter,
      portrait_seed: `${seedSource}-${index + 1}`,
    };
  });
}

function createPositionArray(position: Position, count: number): Position[] {
  return Array.from({ length: count }, () => position);
}

function baseOverallForPosition(position: Position, random: () => number): number {
  if (position === "GK") return randomInt(random, 38, 43);
  if (position === "DEF") return randomInt(random, 36, 42);
  if (position === "MID") return randomInt(random, 37, 43);
  return randomInt(random, 38, 44);
}

function buildStats(position: Position, baseOverall: number, random: () => number) {
  const randomSpread = () => randomInt(random, -5, 5);

  if (position === "GK") {
    return {
      pace: clamp(20 + randomSpread(), 15, 35),
      shooting: clamp(18 + randomSpread(), 12, 30),
      passing: clamp(baseOverall - 4 + randomSpread(), 20, 50),
      dribbling: clamp(baseOverall - 6 + randomSpread(), 18, 48),
      defending: clamp(baseOverall - 2 + randomSpread(), 20, 52),
      strength: clamp(baseOverall + randomSpread(), 24, 55),
      goalkeeping: clamp(baseOverall + 9 + randomSpread(), 32, 55),
    };
  }

  if (position === "DEF") {
    return {
      pace: clamp(baseOverall - 1 + randomSpread(), 24, 55),
      shooting: clamp(baseOverall - 7 + randomSpread(), 14, 45),
      passing: clamp(baseOverall - 1 + randomSpread(), 20, 55),
      dribbling: clamp(baseOverall - 3 + randomSpread(), 18, 52),
      defending: clamp(baseOverall + 8 + randomSpread(), 28, 55),
      strength: clamp(baseOverall + 6 + randomSpread(), 26, 55),
      goalkeeping: clamp(12 + randomSpread(), 8, 22),
    };
  }

  if (position === "MID") {
    return {
      pace: clamp(baseOverall + randomSpread(), 24, 55),
      shooting: clamp(baseOverall - 1 + randomSpread(), 20, 55),
      passing: clamp(baseOverall + 7 + randomSpread(), 28, 55),
      dribbling: clamp(baseOverall + 5 + randomSpread(), 26, 55),
      defending: clamp(baseOverall + randomSpread(), 20, 52),
      strength: clamp(baseOverall - 1 + randomSpread(), 20, 52),
      goalkeeping: clamp(10 + randomSpread(), 6, 20),
    };
  }

  return {
    pace: clamp(baseOverall + 5 + randomSpread(), 28, 55),
    shooting: clamp(baseOverall + 8 + randomSpread(), 30, 55),
    passing: clamp(baseOverall + randomSpread(), 20, 52),
    dribbling: clamp(baseOverall + 6 + randomSpread(), 28, 55),
    defending: clamp(baseOverall - 7 + randomSpread(), 12, 45),
    strength: clamp(baseOverall + 2 + randomSpread(), 22, 55),
    goalkeeping: clamp(9 + randomSpread(), 6, 18),
  };
}

function computeOverall(position: Position, stats: Record<string, number>): number {
  const weighted =
    position === "GK"
      ? stats.goalkeeping * 0.58 + stats.defending * 0.12 + stats.passing * 0.1 + stats.strength * 0.1 + stats.pace * 0.1
      : position === "DEF"
        ? stats.defending * 0.4 + stats.strength * 0.2 + stats.pace * 0.14 + stats.passing * 0.1 + stats.dribbling * 0.08 + stats.shooting * 0.08
        : position === "MID"
          ? stats.passing * 0.26 + stats.dribbling * 0.22 + stats.pace * 0.16 + stats.defending * 0.14 + stats.shooting * 0.12 + stats.strength * 0.1
          : stats.shooting * 0.3 + stats.pace * 0.2 + stats.dribbling * 0.2 + stats.strength * 0.12 + stats.passing * 0.1 + stats.defending * 0.08;

  return Number(clamp(weighted, 1, 55).toFixed(2));
}

function pick<T>(random: () => number, values: T[]): T {
  return values[Math.floor(random() * values.length)];
}

function randomInt(random: () => number, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createSeededRng(seed: string): () => number {
  let state = 2166136261;

  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
