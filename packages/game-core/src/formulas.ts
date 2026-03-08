import { RARITY_CAPS } from "./constants";
import type { MatchResult, PlayerCard, Position, Rarity } from "./types";

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

function staminaMultiplier(stamina: number): number {
  if (stamina <= 0) return 0;
  if (stamina < 20) return 0.7;
  if (stamina < 40) return 0.82;
  if (stamina < 60) return 0.9;
  return 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
