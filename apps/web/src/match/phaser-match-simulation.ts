import * as Phaser from "phaser";
import {
  EARLY_FINISH_GOAL_LEAD,
  MATCH_DURATION_SECONDS,
  MAX_EVENT_GAP_SECONDS,
  MAX_TOTAL_GOALS,
} from "../../../../packages/game-core/src/constants";
import { simulateMatch } from "../../../../packages/game-core/src/engine/simulateMatch";
import type { MatchRuntimeConfig, MatchRuntimeResult } from "../../../../packages/game-core/src/phaser-contracts";
import type { MatchChanceEvent, MatchSimulationOutput } from "../../../../packages/game-core/src/types";

export interface PhaserMatchOptions {
  width?: number;
  height?: number;
  homeColor?: number;
  awayColor?: number;
  backgroundColor?: string;
  secondDurationMs?: number;
  onResolved?: (result: MatchRuntimeResult) => void;
}

export interface MountedPhaserMatch {
  destroy: () => void;
  getResult: () => MatchRuntimeResult;
}

interface RuntimeTeam {
  name: string;
  strength: number;
  attackRating: number;
  defenseRating: number;
  controlRating: number;
  goalkeepingRating: number;
  staminaRating: number;
  momentumBias?: number;
}

interface ResolvedRuntimeConfig {
  matchSeed: string;
  homeTeam: RuntimeTeam;
  awayTeam: RuntimeTeam;
  rules: {
    durationSeconds: number;
    maxTotalGoals: number;
    earlyFinishGoalLead: number;
    maxChanceGapSeconds: number;
  };
}

export function mountPhaserMatchSimulation(
  container: HTMLElement,
  config: MatchRuntimeConfig,
  options: PhaserMatchOptions = {}
): MountedPhaserMatch {
  const runtimeConfig = buildMatchRuntimeConfig(config);

  const simulation = simulateMatch({
    seed: runtimeConfig.matchSeed,
    homeTeamStrength: runtimeConfig.homeTeam.strength,
    awayTeamStrength: runtimeConfig.awayTeam.strength,
    homeMomentumBias: runtimeConfig.homeTeam.momentumBias ?? 0,
    awayMomentumBias: runtimeConfig.awayTeam.momentumBias ?? 0,
  });

  let runtimeResult = toRuntimeResult(runtimeConfig.matchSeed, simulation);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: options.width ?? 390,
    height: options.height ?? 780,
    backgroundColor: options.backgroundColor ?? "#0b1a2f",
    scene: new MatchSimulationScene({
      simulation,
      baseRuntimeResult: runtimeResult,
      matchSeed: runtimeConfig.matchSeed,
      secondDurationMs: options.secondDurationMs ?? 1000,
      ui: {
        homeName: runtimeConfig.homeTeam.name,
        awayName: runtimeConfig.awayTeam.name,
        homeColor: options.homeColor ?? 0x3b82f6,
        awayColor: options.awayColor ?? 0xef4444,
      },
      teams: {
        home: runtimeConfig.homeTeam,
        away: runtimeConfig.awayTeam,
      },
      onFinished: (finalResult: MatchRuntimeResult) => {
        runtimeResult = finalResult;
        options.onResolved?.(finalResult);
      },
    }),
    fps: { target: 60 },
    audio: { noAudio: true },
  });

  return {
    destroy: () => game.destroy(true),
    getResult: () => runtimeResult,
  };
}

class MatchSimulationScene extends Phaser.Scene {
  private readonly simulation: MatchSimulationOutput;
  private readonly baseRuntimeResult: MatchRuntimeResult;
  private readonly matchSeed: string;
  private readonly ui: {
    homeName: string;
    awayName: string;
    homeColor: number;
    awayColor: number;
  };
  private readonly secondDurationMs: number;
  private readonly onFinished: (result: MatchRuntimeResult) => void;
  private readonly teams: {
    home: RuntimeTeam;
    away: RuntimeTeam;
  };

  private elapsed = 0;
  private eventCursor = 0;
  private homeGoals = 0;
  private awayGoals = 0;
  private resolvedEvents: MatchChanceEvent[] = [];
  private resolvingChance = false;
  private finished = false;

  private timerText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private commentaryText!: Phaser.GameObjects.Text;
  private homeMarker!: Phaser.GameObjects.Arc;
  private awayMarker!: Phaser.GameObjects.Arc;

  constructor(options: {
    simulation: MatchSimulationOutput;
    baseRuntimeResult: MatchRuntimeResult;
    matchSeed: string;
    ui: {
      homeName: string;
      awayName: string;
      homeColor: number;
      awayColor: number;
    };
    teams: {
      home: RuntimeTeam;
      away: RuntimeTeam;
    };
    secondDurationMs: number;
    onFinished: (result: MatchRuntimeResult) => void;
  }) {
    super("match-simulation-scene");
    this.simulation = options.simulation;
    this.baseRuntimeResult = options.baseRuntimeResult;
    this.matchSeed = options.matchSeed;
    this.ui = options.ui;
    this.teams = options.teams;
    this.secondDurationMs = options.secondDurationMs;
    this.onFinished = options.onFinished;
  }

  create() {
    const { width, height } = this.cameras.main;
    const pitchTop = 140;
    const pitchHeight = height - 220;

    this.drawPitch(width, pitchTop, pitchHeight);
    this.buildHud(width);

    this.homeMarker = this.add.circle(width * 0.32, pitchTop + pitchHeight * 0.5, 12, this.ui.homeColor, 1);
    this.awayMarker = this.add.circle(width * 0.68, pitchTop + pitchHeight * 0.5, 12, this.ui.awayColor, 1);

    this.commentaryText = this.add
      .text(width / 2, height - 52, "Kick off!", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#f8fafc",
        align: "center",
      })
      .setOrigin(0.5, 0.5);

    this.time.addEvent({
      delay: this.secondDurationMs,
      loop: true,
      callback: () => this.tickSecond(),
    });
  }

  private drawPitch(width: number, pitchTop: number, pitchHeight: number) {
    const centerX = width / 2;
    const pitch = this.add.graphics();

    pitch.fillStyle(0x166534, 1);
    pitch.fillRoundedRect(24, pitchTop, width - 48, pitchHeight, 18);

    pitch.lineStyle(3, 0xe2e8f0, 1);
    pitch.strokeRoundedRect(24, pitchTop, width - 48, pitchHeight, 18);
    pitch.lineBetween(centerX, pitchTop + 8, centerX, pitchTop + pitchHeight - 8);
    pitch.strokeCircle(centerX, pitchTop + pitchHeight / 2, 52);

    pitch.strokeRect(40, pitchTop + pitchHeight * 0.28, 64, pitchHeight * 0.44);
    pitch.strokeRect(width - 104, pitchTop + pitchHeight * 0.28, 64, pitchHeight * 0.44);
  }

  private buildHud(width: number) {
    this.add
      .text(width / 2, 38, "MATCH LIVE", {
        fontFamily: "Arial",
        fontSize: "26px",
        color: "#f8fafc",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5);

    this.timerText = this.add
      .text(width / 2, 78, formatMatchClock(0), {
        fontFamily: "Courier New",
        fontSize: "22px",
        color: "#a5f3fc",
      })
      .setOrigin(0.5, 0.5);

    this.scoreText = this.add
      .text(width / 2, 112, `${this.ui.homeName} 0 - 0 ${this.ui.awayName}`, {
        fontFamily: "Arial",
        fontSize: "20px",
        color: "#f8fafc",
      })
      .setOrigin(0.5, 0.5);
  }

  private tickSecond() {
    if (this.finished || this.resolvingChance) {
      return;
    }

    if (this.elapsed >= this.simulation.durationSeconds) {
      this.finishMatch();
      return;
    }

    this.elapsed += 1;
    this.timerText.setText(formatMatchClock(this.elapsed));

    while (this.eventCursor < this.simulation.events.length) {
      const event = this.simulation.events[this.eventCursor];
      if (event.second > this.elapsed || this.resolvingChance) break;
      this.startChanceEvent(event, this.eventCursor);
      return;
    }

    if (this.elapsed >= this.simulation.durationSeconds) {
      this.finishMatch();
    }
  }

  private startChanceEvent(event: MatchChanceEvent, eventIndex: number) {
    this.resolvingChance = true;
    const chanceType = pickChanceType(this.matchSeed, eventIndex, event.quality);
    const display = chanceTypeDisplayName(chanceType);
    const yourAction = event.attackingSide === "HOME" ? "Shoot" : "Save";
    const transitionText = `${display} - ${yourAction}`;

    this.commentaryText.setText(transitionText);
    this.playTimingMinigame(event, eventIndex, chanceType, (tapQuality, tapped) => {
      const resolvedScored = resolveChanceOutcome({
        seed: this.matchSeed,
        event,
        eventIndex,
        chanceType,
        tapQuality,
        tapped,
        teams: this.teams,
      });
      const resolvedEvent = { ...event, scored: resolvedScored };
      this.resolvedEvents.push(resolvedEvent);

      this.applyEventOutcome(resolvedEvent, chanceType, tapQuality, tapped);
      this.eventCursor += 1;
      this.resolvingChance = false;

      if (shouldStopEarly(this.homeGoals, this.awayGoals)) {
        this.finishMatch();
        return;
      }

      if (this.elapsed >= this.simulation.durationSeconds) {
        this.finishMatch();
      }
    });
  }

  private playTimingMinigame(
    event: MatchChanceEvent,
    eventIndex: number,
    chanceType: ChanceType,
    onDone: (quality: TapQuality, tapped: boolean) => void
  ) {
    const { width, height } = this.cameras.main;
    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x020617, 0.58);
    const panel = this.add.rectangle(width / 2, height / 2, width - 40, 210, 0x0f294f, 0.95).setStrokeStyle(2, 0xa5b4fc, 0.9);
    const title = this.add
      .text(width / 2, height / 2 - 74, chanceTypeDisplayName(chanceType), {
        fontFamily: "Arial",
        fontSize: "20px",
        color: "#f8fafc",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const roleLabel = event.attackingSide === "HOME" ? "Attack: tap to shoot" : "Defend: tap to save";
    const subtitle = this.add
      .text(width / 2, height / 2 - 46, roleLabel, {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#bfdbfe",
      })
      .setOrigin(0.5);

    const trackLeft = 64;
    const trackRight = width - 64;
    const trackWidth = trackRight - trackLeft;
    const barY = height / 2 + 10;

    const track = this.add.rectangle(width / 2, barY, trackWidth, 16, 0x1f2937, 1).setStrokeStyle(1, 0x94a3b8, 0.8);

    const tuning = computeMinigameTuning(event, chanceType, this.teams);
    const zoneWidth = tuning.zoneWidth;
    const zoneMargin = 14;
    const zoneStartRandom = hashUnit(`${this.matchSeed}:${eventIndex}:zone`);
    const zoneStart = trackLeft + zoneMargin + zoneStartRandom * Math.max(1, trackWidth - zoneWidth - zoneMargin * 2);
    const zone = this.add.rectangle(zoneStart + zoneWidth / 2, barY, zoneWidth, 16, 0x22c55e, 0.78);
    const marker = this.add.circle(trackLeft, barY, 8, 0xf8fafc, 1);

    const markerDuration = tuning.markerDurationMs;
    const moveTween = this.tweens.add({
      targets: marker,
      x: trackRight,
      duration: markerDuration,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });

    const hint = this.add
      .text(width / 2, height / 2 + 48, tuning.hint, {
        fontFamily: "Arial",
        fontSize: "13px",
        color: "#e2e8f0",
      })
      .setOrigin(0.5);

    let completed = false;

    const complete = (tapped: boolean) => {
      if (completed) return;
      completed = true;

      this.input.off("pointerdown", pointerHandler);
      moveTween.stop();

      const tapQuality = readTapQuality(marker.x, zoneStart, zoneStart + zoneWidth);
      hint.setText(outcomeHintForTap(tapQuality, tapped));

      this.time.delayedCall(550, () => {
        dim.destroy();
        panel.destroy();
        title.destroy();
        subtitle.destroy();
        track.destroy();
        zone.destroy();
        marker.destroy();
        hint.destroy();
        onDone(tapQuality, tapped);
      });
    };

    const pointerHandler = () => complete(true);
    this.input.on("pointerdown", pointerHandler);
    this.time.delayedCall(1900, () => complete(false));
  }

  private applyEventOutcome(event: MatchChanceEvent, chanceType: ChanceType, tapQuality: TapQuality, tapped: boolean) {
    const marker = event.attackingSide === "HOME" ? this.homeMarker : this.awayMarker;
    const sideName = event.attackingSide === "HOME" ? this.ui.homeName : this.ui.awayName;

    this.tweens.add({
      targets: marker,
      scale: 1.6,
      duration: 200,
      yoyo: true,
      ease: "Quad.Out",
    });

    if (event.scored) {
      if (event.attackingSide === "HOME") this.homeGoals += 1;
      else this.awayGoals += 1;

      this.scoreText.setText(`${this.ui.homeName} ${this.homeGoals} - ${this.awayGoals} ${this.ui.awayName}`);
      this.commentaryText.setText(
        `${chanceTypeDisplayName(chanceType)}: GOAL for ${sideName} (${tapQuality}${tapped ? "" : ", auto"})`
      );
      this.flashGoalBanner(sideName);
      return;
    }

    this.commentaryText.setText(`${chanceTypeDisplayName(chanceType)}: ${sideName} denied (${tapQuality}${tapped ? "" : ", auto"})`);
  }

  private flashGoalBanner(sideName: string) {
    const { width } = this.cameras.main;

    const banner = this.add
      .rectangle(width / 2, 112, width - 64, 44, 0x92400e, 0.94)
      .setStrokeStyle(2, 0xf8fafc, 1);

    const text = this.add
      .text(width / 2, 112, `GOAL - ${sideName}`, {
        fontFamily: "Arial",
        fontSize: "20px",
        color: "#f8fafc",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5);

    this.time.delayedCall(700, () => {
      banner.destroy();
      text.destroy();
    });
  }

  private finishMatch() {
    if (this.finished || this.commentaryText.text.startsWith("FINAL")) {
      return;
    }

    this.finished = true;

    const finalResult = finalizeRuntimeResult(
      this.matchSeed,
      this.resolvedEvents,
      this.simulation.durationSeconds,
      this.baseRuntimeResult
    );

    this.timerText.setText(formatMatchClock(Math.min(finalResult.durationSeconds, MATCH_DURATION_SECONDS)));
    this.scoreText.setText(`${this.ui.homeName} ${finalResult.homeGoals} - ${finalResult.awayGoals} ${this.ui.awayName}`);

    this.commentaryText.setText(
      `FINAL: ${finalResult.result} (${finalResult.endReason.replaceAll("_", " ")})`
    );

    this.homeMarker.setFillStyle(this.ui.homeColor, 0.85);
    this.awayMarker.setFillStyle(this.ui.awayColor, 0.85);

    this.onFinished(finalResult);
  }
}

function formatMatchClock(seconds: number): string {
  const clamped = Math.max(0, Math.min(seconds, MATCH_DURATION_SECONDS));
  const mins = Math.floor(clamped / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(clamped % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

type ChanceType = "CENTRAL_SHOT" | "ANGLED_SHOT" | "CLOSE_RANGE" | "ONE_ON_ONE";
type TapQuality = "PERFECT" | "GOOD" | "POOR";

function pickChanceType(seed: string, eventIndex: number, quality: number): ChanceType {
  const unit = hashUnit(`${seed}:${eventIndex}:chance:${quality.toFixed(4)}`);
  if (unit < 0.25) return "CENTRAL_SHOT";
  if (unit < 0.5) return "ANGLED_SHOT";
  if (unit < 0.75) return "CLOSE_RANGE";
  return "ONE_ON_ONE";
}

function chanceTypeDisplayName(type: ChanceType): string {
  switch (type) {
    case "CENTRAL_SHOT":
      return "Central Shot";
    case "ANGLED_SHOT":
      return "Angled Shot";
    case "CLOSE_RANGE":
      return "Close-Range Chance";
    case "ONE_ON_ONE":
      return "One-on-One";
    default:
      return "Chance";
  }
}

function readTapQuality(markerX: number, zoneStart: number, zoneEnd: number): TapQuality {
  const zoneCenter = (zoneStart + zoneEnd) / 2;
  const zoneWidth = Math.max(1, zoneEnd - zoneStart);
  const normalizedDistance = Math.abs(markerX - zoneCenter) / zoneWidth;

  if (normalizedDistance <= 0.16) {
    return "PERFECT";
  }

  if (normalizedDistance <= 0.42) {
    return "GOOD";
  }

  return "POOR";
}

function outcomeHintForTap(quality: TapQuality, tapped: boolean): string {
  if (!tapped) {
    return "No tap detected";
  }

  if (quality === "PERFECT") {
    return "Perfect timing";
  }

  if (quality === "GOOD") {
    return "Good timing";
  }

  return "Poor timing";
}

function computeMinigameTuning(
  event: MatchChanceEvent,
  chanceType: ChanceType,
  teams: { home: RuntimeTeam; away: RuntimeTeam }
): { zoneWidth: number; markerDurationMs: number; hint: string } {
  const attacking = event.attackingSide === "HOME" ? teams.home : teams.away;
  const defending = event.attackingSide === "HOME" ? teams.away : teams.home;

  const attackingPower = attacking.attackRating * 0.55 + attacking.controlRating * 0.3 + attacking.strength * 0.15;
  const defendingPower =
    defending.defenseRating * 0.45 + defending.goalkeepingRating * 0.4 + defending.strength * 0.15;
  const staminaEdge = (attacking.staminaRating - defending.staminaRating) * 0.12;
  const qualityEdge = clampSigned((attackingPower - defendingPower + staminaEdge) / 100, 0.22);

  const roleAdjustedEdge = event.attackingSide === "HOME" ? qualityEdge : -qualityEdge;
  const difficultyFromType = chanceTypeDifficulty(chanceType);
  const difficulty = clamp01(0.52 - roleAdjustedEdge + (1 - event.quality) * 0.35 + difficultyFromType);

  const zoneWidth = clamp(
    46,
    150,
    90 + roleAdjustedEdge * 130 + event.quality * 20 - difficultyFromType * 24
  );
  const markerDurationMs = Phaser.Math.Linear(680, 1450, 1 - difficulty);
  const hint =
    event.attackingSide === "HOME"
      ? `Attack window ${Math.round(zoneWidth)}px • tap to shoot`
      : `Save window ${Math.round(zoneWidth)}px • tap to save`;

  return {
    zoneWidth,
    markerDurationMs,
    hint,
  };
}

function resolveChanceOutcome(options: {
  seed: string;
  event: MatchChanceEvent;
  eventIndex: number;
  chanceType: ChanceType;
  tapQuality: TapQuality;
  tapped: boolean;
  teams: { home: RuntimeTeam; away: RuntimeTeam };
}): boolean {
  const { event, chanceType, tapQuality, tapped, teams } = options;
  const attacking = event.attackingSide === "HOME" ? teams.home : teams.away;
  const defending = event.attackingSide === "HOME" ? teams.away : teams.home;

  const attackPower = attacking.attackRating * 0.55 + attacking.controlRating * 0.3 + attacking.strength * 0.15;
  const defensePower =
    defending.defenseRating * 0.45 + defending.goalkeepingRating * 0.4 + defending.strength * 0.15;

  const statEdge = clampSigned((attackPower - defensePower) / 120, 0.22);
  const staminaEdge = clampSigned((attacking.staminaRating - defending.staminaRating) / 180, 0.12);
  const baseFromEngine = event.scored ? 0.62 : 0.34;
  const chanceTypeEdge = chanceType === "CLOSE_RANGE" ? 0.05 : chanceType === "ONE_ON_ONE" ? 0.03 : 0;
  const qualityEdge = clampSigned((event.quality - 0.4) * 0.45, 0.16);
  const userEdge = tapInfluence(event.attackingSide, tapQuality, tapped);

  const scoreProbability = clamp01(
    baseFromEngine + statEdge + staminaEdge + qualityEdge + chanceTypeEdge + userEdge
  );
  const roll = hashUnit(`${options.seed}:${options.eventIndex}:resolve:${tapQuality}:${tapped ? 1 : 0}`);
  return roll <= scoreProbability;
}

function chanceTypeDifficulty(type: ChanceType): number {
  switch (type) {
    case "CENTRAL_SHOT":
      return 0.04;
    case "ANGLED_SHOT":
      return 0.1;
    case "CLOSE_RANGE":
      return -0.03;
    case "ONE_ON_ONE":
      return 0.08;
    default:
      return 0;
  }
}

function hashUnit(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) % 10000) / 10000;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampSigned(value: number, maxAbs: number): number {
  return Math.min(maxAbs, Math.max(-maxAbs, value));
}

function tapInfluence(attackingSide: "HOME" | "AWAY", tapQuality: TapQuality, tapped: boolean): number {
  if (!tapped) {
    return attackingSide === "HOME" ? -0.18 : 0.18;
  }

  if (attackingSide === "HOME") {
    if (tapQuality === "PERFECT") return 0.18;
    if (tapQuality === "GOOD") return 0.08;
    return -0.1;
  }

  if (tapQuality === "PERFECT") return -0.2;
  if (tapQuality === "GOOD") return -0.1;
  return 0.09;
}

function shouldStopEarly(homeGoals: number, awayGoals: number): boolean {
  const lead = Math.abs(homeGoals - awayGoals);
  const totalGoals = homeGoals + awayGoals;
  return lead >= EARLY_FINISH_GOAL_LEAD || totalGoals >= MAX_TOTAL_GOALS;
}

function finalizeRuntimeResult(
  matchSeed: string,
  resolvedEvents: MatchChanceEvent[],
  maxDurationSeconds: number,
  fallback: MatchRuntimeResult
): MatchRuntimeResult {
  let homeGoals = 0;
  let awayGoals = 0;
  let durationSeconds = maxDurationSeconds;
  let endReason: MatchRuntimeResult["endReason"] = "TIMER_EXPIRED";

  for (const event of resolvedEvents) {
    if (event.scored) {
      if (event.attackingSide === "HOME") {
        homeGoals += 1;
      } else {
        awayGoals += 1;
      }
    }

    const lead = Math.abs(homeGoals - awayGoals);
    const totalGoals = homeGoals + awayGoals;

    if (lead >= EARLY_FINISH_GOAL_LEAD) {
      durationSeconds = event.second;
      endReason = "THREE_GOAL_LEAD";
      break;
    }

    if (totalGoals >= MAX_TOTAL_GOALS) {
      durationSeconds = event.second;
      endReason = "TEN_TOTAL_GOALS";
      break;
    }
  }

  const result = homeGoals > awayGoals ? "WIN" : homeGoals < awayGoals ? "LOSS" : "DRAW";
  const candidate: MatchRuntimeResult = {
    matchSeed,
    result,
    endReason,
    durationSeconds,
    homeGoals,
    awayGoals,
    events: resolvedEvents,
    summary: {
      scoreline: `${homeGoals}-${awayGoals}`,
      totalGoals: homeGoals + awayGoals,
    },
  };

  return isValidRuntimeResult(candidate) ? candidate : fallback;
}

function isValidRuntimeResult(result: MatchRuntimeResult): boolean {
  const lead = Math.abs(result.homeGoals - result.awayGoals);
  const totalGoals = result.homeGoals + result.awayGoals;

  if (result.durationSeconds < 1 || result.durationSeconds > MATCH_DURATION_SECONDS) {
    return false;
  }

  if (totalGoals > MAX_TOTAL_GOALS) {
    return false;
  }

  if (totalGoals === MAX_TOTAL_GOALS && lead >= EARLY_FINISH_GOAL_LEAD) {
    return false;
  }

  if (totalGoals === MAX_TOTAL_GOALS && lead < EARLY_FINISH_GOAL_LEAD && result.endReason !== "TEN_TOTAL_GOALS") {
    return false;
  }

  if (lead >= EARLY_FINISH_GOAL_LEAD && totalGoals < MAX_TOTAL_GOALS && result.endReason !== "THREE_GOAL_LEAD") {
    return false;
  }

  if (lead < EARLY_FINISH_GOAL_LEAD && totalGoals < MAX_TOTAL_GOALS && result.endReason !== "TIMER_EXPIRED") {
    return false;
  }

  if (result.endReason === "TIMER_EXPIRED" && result.durationSeconds !== MATCH_DURATION_SECONDS) {
    return false;
  }

  return true;
}

function toRuntimeResult(matchSeed: string, output: MatchSimulationOutput): MatchRuntimeResult {
  return {
    matchSeed,
    result: output.result,
    endReason: output.endReason,
    durationSeconds: output.durationSeconds,
    homeGoals: output.homeGoals,
    awayGoals: output.awayGoals,
    events: output.events,
    summary: {
      scoreline: `${output.homeGoals}-${output.awayGoals}`,
      totalGoals: output.homeGoals + output.awayGoals,
    },
  };
}

export function buildMatchRuntimeConfig(config: MatchRuntimeConfig): ResolvedRuntimeConfig {
  return {
    matchSeed: config.matchSeed,
    homeTeam: resolveRuntimeTeam(config.homeTeam),
    awayTeam: resolveRuntimeTeam(config.awayTeam),
    rules: {
      durationSeconds: config.rules?.durationSeconds ?? MATCH_DURATION_SECONDS,
      maxTotalGoals: config.rules?.maxTotalGoals ?? MAX_TOTAL_GOALS,
      earlyFinishGoalLead: config.rules?.earlyFinishGoalLead ?? EARLY_FINISH_GOAL_LEAD,
      maxChanceGapSeconds: config.rules?.maxChanceGapSeconds ?? MAX_EVENT_GAP_SECONDS,
    },
  };
}

function resolveRuntimeTeam(team: MatchRuntimeConfig["homeTeam"]): RuntimeTeam {
  return {
    name: team.name,
    strength: team.strength,
    attackRating: team.attackRating ?? team.strength,
    defenseRating: team.defenseRating ?? team.strength,
    controlRating: team.controlRating ?? team.strength,
    goalkeepingRating: team.goalkeepingRating ?? team.strength,
    staminaRating: team.staminaRating ?? 100,
    momentumBias: team.momentumBias,
  };
}
