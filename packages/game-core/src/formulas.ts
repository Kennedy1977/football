import { RARITY_CAPS } from "./constants";
import type { ArcadeTeamRatings, MatchResult, PlayerCard, Position, Rarity } from "./types";

export function getLeaguePoints(result: MatchResult): number {
  if (result === "WIN") return 3;
  if (result === "DRAW") return 1;
  return 0;
}

export function getMatchCoinReward(result: MatchResult, goalsScored: number): number {
  const resultBonus = result === "WIN" ? 100 : result === "DRAW" ? 50 : 25;
  return resultBonus + goalsScored * 10;
}

export function getStarterExpGain(result: MatchResult): number {
  if (result === "WIN") return 5;
  if (result === "DRAW") return 3;
  return 1;
}

export function getManagerExpGain(result: MatchResult): number {
  if (result === "WIN") return 20;
  if (result === "DRAW") return 8;
  return 0;
}

export function applyStaminaAfterMatch(currentStamina: number): number {
  const lossPct = 32.5;
  return clamp(currentStamina - lossPct, 0, 100);
}

export function recoverStaminaSkippedMatch(currentStamina: number): number {
  return clamp(currentStamina + 25, 0, 100);
}

export function recoverStaminaRealtime(currentStamina: number, minutesElapsed: number): number {
  const recoveryPerMinute = 50 / 30;
  return clamp(currentStamina + minutesElapsed * recoveryPerMinute, 0, 100);
}

export function isUnavailableByStamina(stamina: number): boolean {
  return stamina <= 0;
}

export function getRarityCap(rarity: Rarity): number {
  return RARITY_CAPS[rarity];
}

export function applyPlayerExp(player: PlayerCard, expGained: number): PlayerCard {
  const cap = getRarityCap(player.rarity);
  if (player.overall >= cap) {
    return { ...player };
  }

  const nextExp = player.exp + expGained;
  const levelUps = Math.floor(nextExp / 100);
  const adjustedOverall = clamp(player.overall + levelUps * 0.35, 0, cap);

  return {
    ...player,
    exp: nextExp % 100,
    level: player.level + levelUps,
    overall: adjustedOverall,
  };
}

export function computeTeamOverall(starters: PlayerCard[], formationPenalty = 0): number {
  if (!starters.length) return 0;
  const avgOverall = starters.reduce((sum, p) => sum + p.overall * staminaMultiplier(p.stamina), 0) / starters.length;
  return Number(clamp(avgOverall - formationPenalty, 0, 100).toFixed(2));
}

export function outOfPositionPenalty(playerPosition: Position, slotPosition: Position): number {
  if (playerPosition === slotPosition) return 0;
  if (playerPosition === "GK" || slotPosition === "GK") return 18;
  if (playerPosition === "MID" && (slotPosition === "DEF" || slotPosition === "ATT")) return 6;
  return 12;
}

export function playerSellValue(player: PlayerCard): number {
  const rarityMultiplier: Record<Rarity, number> = {
    COMMON: 1,
    RARE: 1.5,
    EPIC: 2.25,
    LEGENDARY: 3.25,
  };

  return Math.round((player.overall * 14 + player.level * 7) * rarityMultiplier[player.rarity]);
}

export function deriveArcadeRatingsFromOverall(teamOverall: number): ArcadeTeamRatings {
  const base = clamp(teamOverall, 0, 100);
  return {
    attack: Number(clamp(base, 0, 100).toFixed(2)),
    defense: Number(clamp(base, 0, 100).toFixed(2)),
    control: Number(clamp(base, 0, 100).toFixed(2)),
    goalkeeping: Number(clamp(base - 2, 0, 100).toFixed(2)),
    stamina: Number(clamp(70 + base * 0.3, 0, 100).toFixed(2)),
  };
}

export function deriveArcadeTeamRatings(starters: PlayerCard[], fallbackOverall = 40): ArcadeTeamRatings {
  if (!starters.length) {
    return deriveArcadeRatingsFromOverall(fallbackOverall);
  }

  const attackWeights: Record<Position, number> = { GK: 0.2, DEF: 0.7, MID: 1, ATT: 1.3 };
  const defenseWeights: Record<Position, number> = { GK: 1.4, DEF: 1.25, MID: 0.95, ATT: 0.55 };
  const controlWeights: Record<Position, number> = { GK: 0.45, DEF: 0.85, MID: 1.15, ATT: 1 };

  let attackTotal = 0;
  let attackWeightTotal = 0;
  let defenseTotal = 0;
  let defenseWeightTotal = 0;
  let controlTotal = 0;
  let controlWeightTotal = 0;
  let goalkeepingTotal = 0;
  let goalkeepingWeightTotal = 0;
  let staminaTotal = 0;

  for (const player of starters) {
    const staminaFactor = ratingStaminaMultiplier(player.stamina);
    const attackScore =
      player.stats.shooting * 0.5 + player.stats.dribbling * 0.25 + player.stats.pace * 0.15 + player.stats.passing * 0.1;
    const defenseScore =
      player.stats.defending * 0.48 + player.stats.strength * 0.22 + player.stats.pace * 0.14 + player.stats.passing * 0.16;
    const controlScore =
      player.stats.passing * 0.45 + player.stats.dribbling * 0.35 + player.stats.pace * 0.12 + player.stats.strength * 0.08;
    const goalkeepingScore =
      player.position === "GK"
        ? player.stats.goalkeeping * 0.75 + player.stats.passing * 0.15 + player.stats.strength * 0.1
        : (player.stats.goalkeeping * 0.25 + player.stats.defending * 0.5 + player.stats.strength * 0.25) * 0.4;

    const attackWeight = attackWeights[player.position];
    const defenseWeight = defenseWeights[player.position];
    const controlWeight = controlWeights[player.position];
    const goalkeepingWeight = player.position === "GK" ? 1 : 0.25;

    attackTotal += attackScore * attackWeight * staminaFactor;
    attackWeightTotal += attackWeight;

    defenseTotal += defenseScore * defenseWeight * staminaFactor;
    defenseWeightTotal += defenseWeight;

    controlTotal += controlScore * controlWeight * staminaFactor;
    controlWeightTotal += controlWeight;

    goalkeepingTotal += goalkeepingScore * goalkeepingWeight * staminaFactor;
    goalkeepingWeightTotal += goalkeepingWeight;

    staminaTotal += player.stamina;
  }

  const attack = clamp(attackTotal / Math.max(1, attackWeightTotal), 0, 100);
  const defense = clamp(defenseTotal / Math.max(1, defenseWeightTotal), 0, 100);
  const control = clamp(controlTotal / Math.max(1, controlWeightTotal), 0, 100);
  const goalkeeping = clamp(goalkeepingTotal / Math.max(1, goalkeepingWeightTotal), 0, 100);
  const stamina = clamp(staminaTotal / Math.max(1, starters.length), 0, 100);

  return {
    attack: Number(attack.toFixed(2)),
    defense: Number(defense.toFixed(2)),
    control: Number(control.toFixed(2)),
    goalkeeping: Number(goalkeeping.toFixed(2)),
    stamina: Number(stamina.toFixed(2)),
  };
}

function staminaMultiplier(stamina: number): number {
  if (stamina <= 0) return 0;
  if (stamina < 20) return 0.7;
  if (stamina < 40) return 0.82;
  if (stamina < 60) return 0.9;
  return 1;
}

function ratingStaminaMultiplier(stamina: number): number {
  if (stamina <= 0) return 0;
  if (stamina < 20) return 0.62;
  if (stamina < 40) return 0.78;
  if (stamina < 60) return 0.88;
  if (stamina < 80) return 0.95;
  return 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
