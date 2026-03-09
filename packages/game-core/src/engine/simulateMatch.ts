import {
  MATCH_DURATION_SECONDS,
  MAX_EVENT_GAP_SECONDS,
  MAX_TOTAL_GOALS,
} from "../constants";
import type {
  MatchChanceEvent,
  MatchEndReason,
  MatchResult,
  MatchSimulationInput,
  MatchSimulationOutput,
} from "../types";

type Side = "HOME" | "AWAY";
type Lane = -1 | 0 | 1;
type Action = "PASS" | "DRIBBLE" | "THROUGH_BALL" | "CROSS" | "SHOOT" | "RECYCLE";

interface TeamProfile {
  side: Side;
  strength: number;
  attack: number;
  defense: number;
  control: number;
  passing: number;
  dribbling: number;
  shooting: number;
  pace: number;
  tackling: number;
  positioning: number;
  goalkeeping: number;
  stamina: number;
  momentum: number;
}

interface MatchState {
  second: number;
  homeGoals: number;
  awayGoals: number;
  possessionSide: Side;
  progress: number;
  lane: Lane;
  events: MatchChanceEvent[];
  lastEventSecond: number;
}

interface TacticalContext {
  attacking: TeamProfile;
  defending: TeamProfile;
  pressure: number;
  space: number;
  supportRun: number;
  interceptRisk: number;
  compactness: number;
  inFinalThird: boolean;
  inBox: boolean;
  inWing: boolean;
  scorelinePressure: number;
}

export function simulateMatch(input: MatchSimulationInput): MatchSimulationOutput {
  const random = createSeededRng(input.seed);

  const home = buildTeamProfile("HOME", input.homeTeamStrength, input.homeMomentumBias ?? 0, random);
  const away = buildTeamProfile("AWAY", input.awayTeamStrength, input.awayMomentumBias ?? 0, random);

  const state: MatchState = {
    second: 0,
    homeGoals: 0,
    awayGoals: 0,
    possessionSide: pickKickoffSide(home, away, random),
    progress: 0.18 + random() * 0.08,
    lane: 0,
    events: [],
    lastEventSecond: 0,
  };

  while (state.second < MATCH_DURATION_SECONDS) {
    state.second += 1;

    updateStaminaTick(home, away, state.possessionSide, state.second, random);

    const context = buildContext(state, home, away, random);
    const action = chooseAction(context, state, random);

    const directChance = resolveAction(action, state, context, random);
    if (directChance) {
      state.events.push(directChance);
      state.lastEventSecond = state.second;
      applyChanceOutcome(state, directChance, context, random);

      if (state.homeGoals + state.awayGoals >= MAX_TOTAL_GOALS) {
        return finalize(state.homeGoals, state.awayGoals, state.second, state.events, "TEN_TOTAL_GOALS");
      }
      continue;
    }

    if (state.second - state.lastEventSecond >= MAX_EVENT_GAP_SECONDS) {
      const forcedChance = generateChanceEvent(state, context, "SHOOT", random, 0.92);
      state.events.push(forcedChance);
      state.lastEventSecond = state.second;
      applyChanceOutcome(state, forcedChance, context, random);

      if (state.homeGoals + state.awayGoals >= MAX_TOTAL_GOALS) {
        return finalize(state.homeGoals, state.awayGoals, state.second, state.events, "TEN_TOTAL_GOALS");
      }
    }
  }

  return finalize(state.homeGoals, state.awayGoals, MATCH_DURATION_SECONDS, state.events, "TIMER_EXPIRED");
}

function buildTeamProfile(side: Side, strength: number, momentum: number, random: () => number): TeamProfile {
  const base = clamp(30, 99, strength);
  const moment = clamp(-0.4, 0.4, momentum);

  const attack = clamp(28, 99, base + pickSpread(random, 7) + moment * 9);
  const defense = clamp(28, 99, base + pickSpread(random, 7) - moment * 3);
  const control = clamp(28, 99, base + pickSpread(random, 6) + moment * 4);
  const passing = clamp(24, 99, base + pickSpread(random, 8) + moment * 4);
  const dribbling = clamp(24, 99, base + pickSpread(random, 8) + moment * 3);
  const shooting = clamp(24, 99, base + pickSpread(random, 8) + moment * 5);
  const pace = clamp(24, 99, base + pickSpread(random, 7) + moment * 2);
  const tackling = clamp(24, 99, base + pickSpread(random, 8) - moment * 2);
  const positioning = clamp(24, 99, base + pickSpread(random, 7));
  const goalkeeping = clamp(24, 99, base + pickSpread(random, 9) - moment * 1.5);

  return {
    side,
    strength: base,
    attack,
    defense,
    control,
    passing,
    dribbling,
    shooting,
    pace,
    tackling,
    positioning,
    goalkeeping,
    stamina: 100,
    momentum: moment,
  };
}

function buildContext(state: MatchState, home: TeamProfile, away: TeamProfile, random: () => number): TacticalContext {
  const attacking = state.possessionSide === "HOME" ? home : away;
  const defending = state.possessionSide === "HOME" ? away : home;
  const inFinalThird = state.progress >= 0.58;
  const inBox = state.progress >= 0.78;
  const inWing = state.lane !== 0;

  const attackControl = normalize(attacking.control);
  const defenseControl = normalize(defending.defense * 0.65 + defending.positioning * 0.35);
  const zonePressure = inBox ? 0.2 : inFinalThird ? 0.11 : 0.04;
  const lanePenalty = inWing ? -0.03 : 0.07;
  const staminaEdge = normalize(attacking.stamina) - normalize(defending.stamina);

  const compactness = clamp01(
    0.34 + defenseControl * 0.48 + zonePressure + lanePenalty + (normalize(defending.control) - 0.5) * 0.08
  );

  const pressure = clamp01(
    0.2 + compactness * 0.56 - attackControl * 0.24 - staminaEdge * 0.12 + pickSpread(random, 0.05)
  );

  const space = clamp01(0.64 - pressure * 0.62 + (inWing ? 0.07 : -0.05) + pickSpread(random, 0.06));
  const supportRun = clamp01(
    0.28 + normalize(attacking.attack) * 0.36 + normalize(attacking.control) * 0.2 + (inFinalThird ? 0.08 : 0) + pickSpread(random, 0.06)
  );
  const interceptRisk = clamp01(0.14 + pressure * 0.54 + compactness * 0.22 + (inWing ? -0.04 : 0.08));

  const scorelinePressure =
    state.possessionSide === "HOME"
      ? clampSigned((state.awayGoals - state.homeGoals) * 0.08, 0.22)
      : clampSigned((state.homeGoals - state.awayGoals) * 0.08, 0.22);

  return {
    attacking,
    defending,
    pressure,
    space,
    supportRun,
    interceptRisk,
    compactness,
    inFinalThird,
    inBox,
    inWing,
    scorelinePressure,
  };
}

function chooseAction(context: TacticalContext, state: MatchState, random: () => number): Action {
  const scores: Record<Action, number> = {
    PASS:
      30 +
      context.attacking.passing * 0.42 +
      context.space * 26 +
      context.supportRun * 14 -
      context.pressure * 34 -
      context.interceptRisk * 20,
    DRIBBLE:
      24 +
      context.attacking.dribbling * 0.44 +
      context.attacking.pace * 0.24 +
      context.space * 28 -
      context.pressure * 36,
    THROUGH_BALL:
      context.inFinalThird || state.progress > 0.45
        ? 8 +
          context.attacking.passing * 0.36 +
          context.supportRun * 26 -
          context.pressure * 42 -
          context.interceptRisk * 26
        : -999,
    CROSS:
      context.inFinalThird && context.inWing
        ? 10 + context.attacking.passing * 0.3 + context.supportRun * 22 - context.pressure * 24
        : -999,
    SHOOT:
      context.inBox
        ? 8 +
          context.attacking.shooting * 0.5 +
          context.space * 20 -
          context.pressure * 32 -
          normalize(context.defending.goalkeeping) * 18
        : context.inFinalThird
          ? -4 +
            context.attacking.shooting * 0.38 +
            context.space * 14 -
            context.pressure * 28 -
            normalize(context.defending.goalkeeping) * 12
          : -999,
    RECYCLE: 18 + context.attacking.control * 0.36 + context.pressure * 16 - state.progress * 18,
  };

  if (context.scorelinePressure > 0) {
    scores.THROUGH_BALL += context.scorelinePressure * 60;
    scores.SHOOT += context.scorelinePressure * 52;
    scores.RECYCLE -= context.scorelinePressure * 38;
  } else if (context.scorelinePressure < 0) {
    const settle = Math.abs(context.scorelinePressure);
    scores.RECYCLE += settle * 36;
    scores.PASS += settle * 22;
    scores.THROUGH_BALL -= settle * 28;
  }

  const eligible = (Object.entries(scores) as [Action, number][])
    .filter(([, score]) => score > -900)
    .map(([action, score]) => [action, score + pickSpread(random, 7)] as [Action, number])
    .sort((a, b) => b[1] - a[1]);

  const top = eligible[0]?.[0] ?? "PASS";
  const second = eligible[1]?.[0] ?? top;
  const third = eligible[2]?.[0] ?? second;

  const roll = random();
  if (roll < 0.68) return top;
  if (roll < 0.9) return second;
  return third;
}

function resolveAction(
  action: Action,
  state: MatchState,
  context: TacticalContext,
  random: () => number
): MatchChanceEvent | null {
  if (action === "PASS") {
    const success =
      0.34 +
      normalize(context.attacking.passing) * 0.36 +
      context.space * 0.2 +
      context.supportRun * 0.14 -
      context.pressure * 0.3 -
      context.interceptRisk * 0.22 +
      (state.progress < 0.45 ? 0.05 : -0.02);

    if (random() <= clamp01(success)) {
      state.progress = clamp(0.08, 0.96, state.progress + 0.04 + context.space * 0.08 + context.supportRun * 0.05);
      state.lane = shiftLane(state.lane, random, context.supportRun);
      return null;
    }

    turnover(state, random);
    return null;
  }

  if (action === "DRIBBLE") {
    const success =
      0.28 +
      normalize(context.attacking.dribbling) * 0.34 +
      normalize(context.attacking.pace) * 0.18 +
      context.space * 0.22 -
      context.pressure * 0.34 -
      normalize(context.defending.tackling) * 0.14;

    if (random() <= clamp01(success)) {
      state.progress = clamp(0.08, 0.97, state.progress + 0.06 + context.space * 0.11);
      if (state.lane !== 0 && random() < 0.38) {
        state.lane = 0;
      }

      if (state.progress >= 0.74 && random() < 0.26) {
        return generateChanceEvent(state, context, "DRIBBLE", random, 1);
      }
      return null;
    }

    turnover(state, random);
    return null;
  }

  if (action === "THROUGH_BALL") {
    const success =
      0.2 +
      normalize(context.attacking.passing) * 0.34 +
      context.supportRun * 0.24 +
      context.space * 0.12 -
      context.pressure * 0.36 -
      context.interceptRisk * 0.3;

    if (random() <= clamp01(success)) {
      state.progress = clamp(0.14, 0.99, state.progress + 0.12 + context.supportRun * 0.1);
      state.lane = random() < 0.55 ? 0 : shiftLane(state.lane, random, 0.5);
      if (random() < 0.7 || state.progress > 0.82) {
        return generateChanceEvent(state, context, "THROUGH_BALL", random, 1.05);
      }
      return null;
    }

    turnover(state, random);
    return null;
  }

  if (action === "CROSS") {
    const success =
      0.24 +
      normalize(context.attacking.passing) * 0.32 +
      context.supportRun * 0.2 -
      context.pressure * 0.24 -
      context.interceptRisk * 0.14;

    if (random() <= clamp01(success)) {
      state.progress = clamp(0.58, 0.98, state.progress + 0.07 + context.supportRun * 0.06);
      state.lane = random() < 0.5 ? -1 : 1;
      return generateChanceEvent(state, context, "CROSS", random, 0.94);
    }

    turnover(state, random);
    return null;
  }

  if (action === "SHOOT") {
    return generateChanceEvent(state, context, "SHOOT", random, 1);
  }

  state.progress = clamp(0.08, 0.92, state.progress + pickSpread(random, 0.04) + context.space * 0.03 - context.pressure * 0.05);
  if (!context.inWing && random() < 0.42) {
    state.lane = random() < 0.5 ? -1 : 1;
  } else if (context.inWing && random() < 0.28) {
    state.lane = 0;
  }

  const recycleTurnover = 0.08 + context.pressure * 0.22 + context.interceptRisk * 0.1;
  if (random() < recycleTurnover) {
    turnover(state, random);
  }

  return null;
}

function generateChanceEvent(
  state: MatchState,
  context: TacticalContext,
  sourceAction: Action,
  random: () => number,
  qualityBias: number
): MatchChanceEvent {
  const centralBonus = state.lane === 0 ? 0.08 : sourceAction === "CROSS" ? 0.02 : -0.03;
  const distanceFactor = clamp01((state.progress - 0.48) / 0.52);

  const shotQuality =
    0.19 +
    normalize(context.attacking.shooting) * 0.3 +
    normalize(context.attacking.attack) * 0.2 +
    distanceFactor * 0.2 +
    context.space * 0.16 +
    centralBonus -
    context.pressure * 0.22 -
    normalize(context.defending.goalkeeping) * 0.12 +
    pickSpread(random, 0.05);

  const quality = clamp(0.16, 0.85, shotQuality * qualityBias);

  const scoreProbability = clamp01(
    quality +
      normalize(context.attacking.attack) * 0.1 -
      normalize(context.defending.defense) * 0.12 -
      normalize(context.defending.goalkeeping) * 0.14 +
      pickSpread(random, 0.05)
  );

  return {
    second: state.second,
    attackingSide: state.possessionSide,
    quality,
    scored: random() <= scoreProbability,
  };
}

function applyChanceOutcome(
  state: MatchState,
  chance: MatchChanceEvent,
  context: TacticalContext,
  random: () => number
) {
  if (chance.scored) {
    if (chance.attackingSide === "HOME") {
      state.homeGoals += 1;
      state.possessionSide = "AWAY";
    } else {
      state.awayGoals += 1;
      state.possessionSide = "HOME";
    }

    state.progress = 0.16 + random() * 0.1;
    state.lane = 0;
    return;
  }

  const reboundChance = clamp01(0.1 + chance.quality * 0.22 - context.pressure * 0.12);
  if (random() < reboundChance) {
    state.progress = clamp(0.52, 0.9, state.progress - 0.09 + random() * 0.06);
    state.lane = shiftLane(state.lane, random, 0.4);
    return;
  }

  turnover(state, random);
}

function turnover(state: MatchState, random: () => number) {
  state.possessionSide = state.possessionSide === "HOME" ? "AWAY" : "HOME";
  state.progress = clamp(0.1, 0.9, 1 - state.progress + pickSpread(random, 0.08));
  if (random() < 0.36) {
    state.lane = 0;
  } else {
    state.lane = random() < 0.5 ? -1 : 1;
  }
}

function shiftLane(current: Lane, random: () => number, supportRun: number): Lane {
  const centerBias = supportRun > 0.6 ? 0.55 : 0.4;
  if (random() < centerBias) {
    return 0;
  }

  if (current === 0) {
    return random() < 0.5 ? -1 : 1;
  }

  if (random() < 0.45) {
    return current;
  }

  return (current * -1) as Lane;
}

function updateStaminaTick(
  home: TeamProfile,
  away: TeamProfile,
  possessionSide: Side,
  second: number,
  random: () => number
) {
  const baseDrain = 0.12;
  const possessionLoad = possessionSide === "HOME" ? 0.04 : -0.04;
  const minuteFactor = second / MATCH_DURATION_SECONDS;

  home.stamina = clamp(
    62,
    100,
    home.stamina - baseDrain - possessionLoad + minuteFactor * 0.02 + pickSpread(random, 0.01)
  );
  away.stamina = clamp(
    62,
    100,
    away.stamina - baseDrain + possessionLoad + minuteFactor * 0.02 + pickSpread(random, 0.01)
  );
}

function pickKickoffSide(home: TeamProfile, away: TeamProfile, random: () => number): Side {
  const homeInitiative =
    normalize(home.control) * 0.4 + normalize(home.attack) * 0.3 + normalize(home.stamina) * 0.2 + home.momentum * 0.1;
  const awayInitiative =
    normalize(away.control) * 0.4 + normalize(away.attack) * 0.3 + normalize(away.stamina) * 0.2 + away.momentum * 0.1;

  const homeBias = clamp(0.35, 0.65, 0.5 + (homeInitiative - awayInitiative) * 0.3);
  return random() < homeBias ? "HOME" : "AWAY";
}

function finalize(
  homeGoals: number,
  awayGoals: number,
  durationSeconds: number,
  events: MatchChanceEvent[],
  endReason: MatchEndReason
): MatchSimulationOutput {
  const result: MatchResult = homeGoals > awayGoals ? "WIN" : homeGoals < awayGoals ? "LOSS" : "DRAW";

  return {
    result,
    endReason,
    durationSeconds,
    homeGoals,
    awayGoals,
    events,
  };
}

function normalize(value: number): number {
  return clamp01(value / 100);
}

function pickSpread(random: () => number, maxAbs: number): number {
  return (random() * 2 - 1) * maxAbs;
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function clampSigned(value: number, maxAbs: number): number {
  return Math.min(maxAbs, Math.max(-maxAbs, value));
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
