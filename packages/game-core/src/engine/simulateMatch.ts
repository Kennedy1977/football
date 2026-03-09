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

export function simulateMatch(input: MatchSimulationInput): MatchSimulationOutput {
  const random = createSeededRng(input.seed);

  let second = 0;
  let homeGoals = 0;
  let awayGoals = 0;
  const events: MatchChanceEvent[] = [];

  while (second < MATCH_DURATION_SECONDS) {
    const gap = 5 + Math.floor(random() * (MAX_EVENT_GAP_SECONDS - 4));
    second += gap;
    if (second > MATCH_DURATION_SECONDS) break;

    const attackBias = computeAttackBias(input.homeTeamStrength, input.awayTeamStrength, input.homeMomentumBias ?? 0);
    const attackingSide = random() < attackBias ? "HOME" : "AWAY";
    const teamStrength = attackingSide === "HOME" ? input.homeTeamStrength : input.awayTeamStrength;
    const opponentStrength = attackingSide === "HOME" ? input.awayTeamStrength : input.homeTeamStrength;

    const quality = chanceQuality(teamStrength, opponentStrength, random());
    const scored = random() < quality;

    if (scored) {
      if (attackingSide === "HOME") homeGoals += 1;
      else awayGoals += 1;
    }

    events.push({ second, attackingSide, quality, scored });

    const totalGoals = homeGoals + awayGoals;
    if (totalGoals >= MAX_TOTAL_GOALS) {
      return finalize(homeGoals, awayGoals, second, events, "TEN_TOTAL_GOALS");
    }
  }

  return finalize(homeGoals, awayGoals, MATCH_DURATION_SECONDS, events, "TIMER_EXPIRED");
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

function computeAttackBias(homeStrength: number, awayStrength: number, momentum: number): number {
  const total = Math.max(1, homeStrength + awayStrength);
  const base = homeStrength / total;
  const underdogAssist = homeStrength < awayStrength ? 0.03 : 0;
  return clamp(base + momentum * 0.05 + underdogAssist, 0.35, 0.65);
}

function chanceQuality(attackerStrength: number, defenderStrength: number, variance: number): number {
  const strengthEdge = (attackerStrength - defenderStrength) / 200;
  const base = 0.32 + strengthEdge;
  return clamp(base + (variance - 0.5) * 0.08, 0.18, 0.62);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
