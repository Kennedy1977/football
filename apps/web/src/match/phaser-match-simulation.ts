import * as Phaser from "phaser";
import {
  EARLY_FINISH_GOAL_LEAD,
  MATCH_DURATION_SECONDS,
  MAX_EVENT_GAP_SECONDS,
  MAX_TOTAL_GOALS,
} from "../../../../packages/game-core/src/constants";
import { simulateMatch } from "../../../../packages/game-core/src/engine/simulateMatch";
import type {
  MatchChanceOutcome,
  MatchChanceType,
  MatchRuntimeConfig,
  MatchRuntimeResult,
  MatchTapQuality,
} from "../../../../packages/game-core/src/phaser-contracts";
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

type Side = "HOME" | "AWAY";
type Role = "GK" | "DEF" | "MID" | "ATT";

type ChanceType = MatchChanceType;
type TapQuality = MatchTapQuality;

interface FormationNode {
  x: number;
  y: number;
  role: Role;
}

interface PitchPlayer {
  side: Side;
  role: Role;
  container: Phaser.GameObjects.Container;
  baseX: number;
  baseY: number;
}

interface MinigameActorSet {
  layer: Phaser.GameObjects.Container;
  shooter: Phaser.GameObjects.Container;
  keeper: Phaser.GameObjects.Container;
  ball: Phaser.GameObjects.Container;
}

const TOP_FORMATION: FormationNode[] = [
  { x: 0.5, y: 0.07, role: "GK" },
  { x: 0.14, y: 0.19, role: "DEF" },
  { x: 0.36, y: 0.19, role: "DEF" },
  { x: 0.64, y: 0.19, role: "DEF" },
  { x: 0.86, y: 0.19, role: "DEF" },
  { x: 0.14, y: 0.35, role: "MID" },
  { x: 0.36, y: 0.35, role: "MID" },
  { x: 0.64, y: 0.35, role: "MID" },
  { x: 0.86, y: 0.35, role: "MID" },
  { x: 0.42, y: 0.49, role: "ATT" },
  { x: 0.58, y: 0.49, role: "ATT" },
];

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
    backgroundColor: options.backgroundColor ?? "#081428",
    scene: new MatchSimulationScene({
      simulation,
      baseRuntimeResult: runtimeResult,
      matchSeed: runtimeConfig.matchSeed,
      secondDurationMs: options.secondDurationMs ?? 1000,
      ui: {
        homeName: runtimeConfig.homeTeam.name,
        awayName: runtimeConfig.awayTeam.name,
        homeColor: options.homeColor ?? 0x2f8ef0,
        awayColor: options.awayColor ?? 0xd72638,
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
  private chanceOutcomes: MatchChanceOutcome[] = [];
  private resolvingChance = false;
  private finished = false;

  private pitchTop = 0;
  private pitchLeft = 0;
  private pitchWidth = 0;
  private pitchHeight = 0;

  private timerText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private commentaryText!: Phaser.GameObjects.Text;

  private homePlayers: PitchPlayer[] = [];
  private awayPlayers: PitchPlayer[] = [];

  private ballShadow!: Phaser.GameObjects.Ellipse;
  private ball!: Phaser.GameObjects.Container;

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

    this.pitchTop = 126;
    this.pitchLeft = 20;
    this.pitchWidth = width - 40;
    this.pitchHeight = height - 230;

    this.drawVerticalPitch();
    this.buildHud();
    this.createTeams();
    this.createBall();

    this.commentaryText = this.add
      .text(width / 2, height - 46, "Kick off!", {
        fontFamily: "Barlow Condensed, Arial",
        fontSize: "28px",
        color: "#e6f3ff",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(2000);

    this.time.addEvent({
      delay: this.secondDurationMs,
      loop: true,
      callback: () => this.tickSecond(),
    });

    this.time.addEvent({
      delay: 1200,
      loop: true,
      callback: () => this.animateAmbientMovement(),
    });
  }

  private drawVerticalPitch() {
    const x = this.pitchLeft;
    const y = this.pitchTop;
    const w = this.pitchWidth;
    const h = this.pitchHeight;
    const centerX = x + w / 2;
    const centerY = y + h / 2;

    const pitch = this.add.graphics();

    pitch.fillStyle(0x2f6e1f, 1);
    pitch.fillRoundedRect(x, y, w, h, 18);

    const stripeCount = 12;
    const stripeHeight = h / stripeCount;
    for (let i = 0; i < stripeCount; i += 1) {
      pitch.fillStyle(i % 2 === 0 ? 0x66b53b : 0x5aa330, 0.95);
      pitch.fillRect(x + 2, y + i * stripeHeight, w - 4, stripeHeight + 1);
    }

    pitch.lineStyle(4, 0xf8fafc, 1);
    pitch.strokeRoundedRect(x, y, w, h, 18);

    pitch.lineStyle(4, 0xf8fafc, 1);
    for (let i = 0; i < 9; i += 1) {
      const segW = w / 18;
      const segX = x + i * segW * 2;
      pitch.lineBetween(segX, centerY, segX + segW, centerY);
    }

    pitch.strokeCircle(centerX, centerY, 74);

    const penaltyW = w * 0.68;
    const penaltyH = h * 0.14;
    const sixW = w * 0.35;
    const sixH = h * 0.06;

    pitch.strokeRect(centerX - penaltyW / 2, y, penaltyW, penaltyH);
    pitch.strokeRect(centerX - sixW / 2, y, sixW, sixH);

    pitch.beginPath();
    pitch.arc(centerX, y + penaltyH, 42, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
    pitch.strokePath();

    pitch.strokeRect(centerX - penaltyW / 2, y + h - penaltyH, penaltyW, penaltyH);
    pitch.strokeRect(centerX - sixW / 2, y + h - sixH, sixW, sixH);

    pitch.beginPath();
    pitch.arc(centerX, y + h - penaltyH, 42, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false);
    pitch.strokePath();

    pitch.fillStyle(0xf8fafc, 1);
    pitch.fillCircle(centerX, y + penaltyH - 28, 5);
    pitch.fillCircle(centerX, y + h - penaltyH + 28, 5);

    this.drawGoal(true);
    this.drawGoal(false);
  }

  private drawGoal(top: boolean) {
    const x = this.pitchLeft;
    const y = this.pitchTop;
    const w = this.pitchWidth;
    const h = this.pitchHeight;
    const centerX = x + w / 2;
    const goalW = w * 0.32;
    const goalDepth = 16;

    const g = this.add.graphics();

    if (top) {
      const gy = y - 2;
      g.lineStyle(3, 0xdbeafe, 1);
      g.strokeRect(centerX - goalW / 2, gy - goalDepth, goalW, goalDepth);
      g.lineStyle(1, 0xdbeafe, 0.7);
      for (let i = 0; i <= 8; i += 1) {
        const gx = centerX - goalW / 2 + (goalW / 8) * i;
        g.lineBetween(gx, gy - goalDepth, gx, gy);
      }
      for (let i = 1; i <= 3; i += 1) {
        const gyLine = gy - (goalDepth / 4) * i;
        g.lineBetween(centerX - goalW / 2, gyLine, centerX + goalW / 2, gyLine);
      }
      return;
    }

    const gy = y + h + 2;
    g.lineStyle(3, 0xdbeafe, 1);
    g.strokeRect(centerX - goalW / 2, gy, goalW, goalDepth);
    g.lineStyle(1, 0xdbeafe, 0.7);
    for (let i = 0; i <= 8; i += 1) {
      const gx = centerX - goalW / 2 + (goalW / 8) * i;
      g.lineBetween(gx, gy, gx, gy + goalDepth);
    }
    for (let i = 1; i <= 3; i += 1) {
      const gyLine = gy + (goalDepth / 4) * i;
      g.lineBetween(centerX - goalW / 2, gyLine, centerX + goalW / 2, gyLine);
    }
  }

  private buildHud() {
    const centerX = this.cameras.main.width / 2;

    this.add
      .text(centerX, 34, "MATCH LIVE", {
        fontFamily: "Barlow Condensed, Arial",
        fontSize: "42px",
        color: "#f8fafc",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5);

    this.timerText = this.add
      .text(centerX, 70, formatMatchClock(0), {
        fontFamily: "Courier New",
        fontSize: "24px",
        color: "#99f6e4",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5);

    this.scoreText = this.add
      .text(centerX, 102, `${this.ui.homeName} 0 - 0 ${this.ui.awayName}`, {
        fontFamily: "Barlow Condensed, Arial",
        fontSize: "26px",
        color: "#f8fafc",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5);
  }

  private createTeams() {
    this.homePlayers = this.createTeam(
      "HOME",
      TOP_FORMATION.map((node) => ({ ...node, y: 1 - node.y })),
      this.ui.homeColor,
      0xf4d03f,
      "up"
    );

    this.awayPlayers = this.createTeam("AWAY", TOP_FORMATION, this.ui.awayColor, 0x2ecc71, "down");
  }

  private createTeam(
    side: Side,
    formation: FormationNode[],
    kitColor: number,
    goalkeeperColor: number,
    facing: "up" | "down"
  ): PitchPlayer[] {
    const players: PitchPlayer[] = [];

    for (const node of formation) {
      const x = this.pitchLeft + this.pitchWidth * node.x;
      const y = this.pitchTop + this.pitchHeight * node.y;
      const color = node.role === "GK" ? goalkeeperColor : kitColor;
      const container = this.createPitchAvatar(x, y, color, facing);

      players.push({
        side,
        role: node.role,
        container,
        baseX: x,
        baseY: y,
      });
    }

    return players;
  }

  private createPitchAvatar(
    x: number,
    y: number,
    kitColor: number,
    facing: "up" | "down"
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const shadow = this.add.ellipse(0, 14, 28, 10, 0x000000, 0.28);
    const body = this.add.ellipse(0, -2, 26, 25, kitColor, 1).setStrokeStyle(2, darkenColor(kitColor, 0.35), 0.95);
    const shorts = this.add.rectangle(0, 9, 20, 9, 0x1f2937, 1);
    const leftLeg = this.add.rectangle(-6, 17, 6, 12, 0xf4c183, 1);
    const rightLeg = this.add.rectangle(6, 17, 6, 12, 0xf4c183, 1);
    const leftSock = this.add.rectangle(-6, 22, 7, 5, 0x113d9f, 1);
    const rightSock = this.add.rectangle(6, 22, 7, 5, 0x113d9f, 1);
    const head = this.add.circle(0, -17, 9, 0xf8c99e, 1).setStrokeStyle(1, 0x6c4426, 0.9);
    const hair = this.add.ellipse(0, -20, 16, 8, 0x5e3b24, 1);

    const parts: Phaser.GameObjects.GameObject[] = [
      shadow,
      leftLeg,
      rightLeg,
      leftSock,
      rightSock,
      shorts,
      body,
      head,
      hair,
    ];

    if (facing === "down") {
      const eyeLeft = this.add.circle(-3.3, -16, 1, 0x0f172a, 1);
      const eyeRight = this.add.circle(3.3, -16, 1, 0x0f172a, 1);
      const smile = this.add.arc(0, -13, 3.2, 5, 175, false, 0x000000, 0).setStrokeStyle(1.2, 0x7c2d12, 1);
      parts.push(eyeLeft, eyeRight, smile);
    } else {
      const nape = this.add.rectangle(0, -9.5, 6, 4, 0xf8c99e, 1);
      parts.push(nape);
    }

    container.add(parts);
    container.setScale(0.74);
    container.setDepth(500 + y);
    return container;
  }

  private createBall() {
    const startX = this.pitchLeft + this.pitchWidth / 2;
    const startY = this.pitchTop + this.pitchHeight / 2;

    this.ballShadow = this.add.ellipse(startX, startY + 8, 14, 6, 0x000000, 0.24).setDepth(700 + startY);

    const shell = this.add.circle(0, 0, 7, 0xffffff, 1).setStrokeStyle(1, 0x0f172a, 1);
    const patchA = this.add.circle(0, -1, 1.8, 0x0f172a, 1);
    const patchB = this.add.circle(3, 2, 1.6, 0x0f172a, 1);
    const patchC = this.add.circle(-3.2, 2, 1.3, 0x0f172a, 1);

    this.ball = this.add.container(startX, startY, [shell, patchA, patchB, patchC]);
    this.ball.setDepth(800 + startY);
  }

  private setBallPosition(x: number, y: number, loft = 0) {
    const clampedLoft = Math.max(0, loft);
    this.ball.setPosition(x, y - clampedLoft);
    this.ball.setScale(1 + clampedLoft * 0.01);
    this.ball.setDepth(800 + y - clampedLoft);

    const shadowScale = clamp(0.55, 1, 1 - clampedLoft * 0.02);
    this.ballShadow.setPosition(x, y + 8);
    this.ballShadow.setScale(shadowScale, shadowScale);
    this.ballShadow.setAlpha(0.24 * shadowScale);
    this.ballShadow.setDepth(700 + y);
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
      if (event.second > this.elapsed || this.resolvingChance) {
        break;
      }
      this.startChanceEvent(event, this.eventCursor);
      return;
    }

    if (this.elapsed >= this.simulation.durationSeconds) {
      this.finishMatch();
    }
  }

  private animateAmbientMovement() {
    if (this.resolvingChance || this.finished) {
      return;
    }

    const outfieldPlayers = [...this.homePlayers, ...this.awayPlayers].filter((player) => player.role !== "GK");
    for (const player of outfieldPlayers) {
      if (Math.random() > 0.4) {
        continue;
      }

      const targetX = player.baseX + Phaser.Math.Between(-6, 6);
      const targetY = player.baseY + Phaser.Math.Between(-4, 4);

      this.tweens.add({
        targets: player.container,
        x: targetX,
        y: targetY,
        duration: 620,
        ease: "Sine.easeInOut",
        yoyo: true,
        onUpdate: () => {
          player.container.setDepth(500 + player.container.y);
        },
      });
    }
  }

  private startChanceEvent(event: MatchChanceEvent, eventIndex: number) {
    this.resolvingChance = true;
    const chanceType = pickChanceType(this.matchSeed, eventIndex, event.quality);
    const display = chanceTypeDisplayName(chanceType);
    const yourAction = event.attackingSide === "HOME" ? "Shoot" : "Save";

    this.commentaryText.setText(`${display} - ${yourAction}`);

    void this.resolveChanceEvent(event, eventIndex, chanceType);
  }

  private async resolveChanceEvent(event: MatchChanceEvent, eventIndex: number, chanceType: ChanceType) {
    try {
      const { tapQuality, tapped } = await this.playTimingMinigame(event, eventIndex, chanceType);

      const resolvedOutcome = resolveChanceOutcome({
        seed: this.matchSeed,
        event,
        eventIndex,
        chanceType,
        tapQuality,
        tapped,
        teams: this.teams,
      });

      const resolvedEvent = { ...event, scored: resolvedOutcome.scored };
      this.resolvedEvents.push(resolvedEvent);
      this.chanceOutcomes.push({
        eventIndex,
        second: event.second,
        attackingSide: event.attackingSide,
        chanceType,
        tapQuality,
        tapped,
        baseQuality: event.quality,
        scoreProbability: resolvedOutcome.scoreProbability,
        scored: resolvedOutcome.scored,
      });

      await this.animateChanceOnPitch(event, eventIndex, resolvedOutcome.scored, chanceType);
      this.applyEventOutcome(resolvedEvent, chanceType, tapQuality, tapped);
    } catch {
      const fallback = { ...event };
      this.resolvedEvents.push(fallback);
      this.applyEventOutcome(fallback, chanceType, "POOR", false);
    } finally {
      this.eventCursor += 1;
      this.resolvingChance = false;

      if (shouldStopEarly(this.homeGoals, this.awayGoals)) {
        this.finishMatch();
        return;
      }

      if (this.elapsed >= this.simulation.durationSeconds) {
        this.finishMatch();
      }
    }
  }

  private playTimingMinigame(
    event: MatchChanceEvent,
    eventIndex: number,
    chanceType: ChanceType
  ): Promise<{ tapQuality: TapQuality; tapped: boolean }> {
    return new Promise((resolve) => {
      const { width, height } = this.cameras.main;
      const tuning = computeMinigameTuning(event, chanceType, this.teams);

      const layer = this.add.container(0, 0).setDepth(4500);
      const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x020a14, 0.68);
      layer.add(dim);

      const pitch = this.add.graphics();
      drawMinigameField(pitch, width, height, event.attackingSide);
      layer.add(pitch);

      const actors = this.createMinigameActors(layer, event.attackingSide);

      const title = this.add
        .text(width / 2, 58, chanceTypeDisplayName(chanceType), {
          fontFamily: "Barlow Condensed, Arial",
          fontSize: "42px",
          color: "#f8fafc",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      layer.add(title);

      const prompt = this.add
        .text(
          width / 2,
          height - 120,
          event.attackingSide === "HOME" ? "Tap to shoot!" : "Save the shot!",
          {
            fontFamily: "Barlow Condensed, Arial",
            fontSize: "52px",
            color: "#f8fafc",
            fontStyle: "bold",
          }
        )
        .setOrigin(0.5);
      layer.add(prompt);

      const trackLeft = 46;
      const trackWidth = width - 92;
      const trackTop = height - 196;
      const trackHeight = 40;
      const innerPad = 5;
      const innerX = trackLeft + innerPad;
      const innerY = trackTop + innerPad;
      const innerW = trackWidth - innerPad * 2;
      const innerH = trackHeight - innerPad * 2;

      const bar = this.add.graphics();
      bar.fillStyle(0xffffff, 0.95);
      bar.fillRoundedRect(trackLeft - 2, trackTop - 2, trackWidth + 4, trackHeight + 4, 18);
      bar.fillStyle(0x0d2b26, 1);
      bar.fillRoundedRect(trackLeft, trackTop, trackWidth, trackHeight, 16);

      const zoneWidth = clamp(56, Math.max(80, innerW - 40), tuning.zoneWidth);
      const zoneStartRandom = hashUnit(`${this.matchSeed}:${eventIndex}:zone`);
      const zoneStart = innerX + zoneStartRandom * Math.max(1, innerW - zoneWidth);
      const zoneEnd = zoneStart + zoneWidth;

      bar.fillStyle(0xef4444, 1);
      bar.fillRoundedRect(innerX, innerY, zoneStart - innerX, innerH, 12);
      bar.fillStyle(0x84cc16, 1);
      bar.fillRoundedRect(zoneStart, innerY, zoneWidth, innerH, 12);
      bar.fillStyle(0xef4444, 1);
      bar.fillRoundedRect(zoneEnd, innerY, innerX + innerW - zoneEnd, innerH, 12);

      layer.add(bar);

      const marker = this.add.circle(innerX, innerY + innerH / 2, 10, 0xffffff, 1).setStrokeStyle(2, 0x0f172a, 1);
      layer.add(marker);

      const hint = this.add
        .text(width / 2, trackTop - 24, tuning.hint, {
          fontFamily: "Exo 2, Arial",
          fontSize: "18px",
          color: "#e2e8f0",
        })
        .setOrigin(0.5);
      layer.add(hint);

      const moveTween = this.tweens.add({
        targets: marker,
        x: innerX + innerW,
        duration: tuning.markerDurationMs,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });

      let completed = false;

      const complete = (tapped: boolean) => {
        if (completed) {
          return;
        }
        completed = true;

        this.input.off("pointerdown", pointerHandler);
        moveTween.stop();

        const tapQuality = readTapQuality(marker.x, zoneStart, zoneEnd);
        hint.setText(outcomeHintForTap(tapQuality, tapped));

        const goalCenterX = width / 2;
        const goalHalfSpan = 74;
        const markerNorm = (marker.x - innerX) / Math.max(1, innerW);
        const shotTargetX = goalCenterX - goalHalfSpan + goalHalfSpan * 2 * markerNorm;

        void this.animateMinigamePreview(actors, event.attackingSide, shotTargetX).then(() => {
          this.time.delayedCall(220, () => {
            layer.destroy(true);
            resolve({ tapQuality, tapped });
          });
        });
      };

      const pointerHandler = () => complete(true);

      this.input.on("pointerdown", pointerHandler);
      this.time.delayedCall(1900, () => complete(false));
    });
  }

  private createMinigameActors(layer: Phaser.GameObjects.Container, attackingSide: Side): MinigameActorSet {
    const { width, height } = this.cameras.main;

    if (attackingSide === "HOME") {
      const shooter = this.createMinigameAvatar(width / 2, height - 310, this.ui.homeColor, "up", 1.28);
      const keeper = this.createMinigameAvatar(width / 2, 132, 0xf4d03f, "down", 1.05);
      const ball = this.createMiniBall(width / 2 + 24, height - 292, 1.3);
      layer.add([shooter, keeper, ball]);
      return { layer, shooter, keeper, ball };
    }

    const shooter = this.createMinigameAvatar(width / 2, 180, this.ui.awayColor, "down", 1.02);
    const keeper = this.createMinigameAvatar(width / 2, height - 274, 0x2ecc71, "up", 1.36);
    const ball = this.createMiniBall(width / 2, 212, 1.18);
    layer.add([shooter, keeper, ball]);
    return { layer, shooter, keeper, ball };
  }

  private createMinigameAvatar(
    x: number,
    y: number,
    kitColor: number,
    facing: "up" | "down",
    scale: number
  ): Phaser.GameObjects.Container {
    const avatar = this.createPitchAvatar(x, y, kitColor, facing);
    avatar.setScale(scale);
    avatar.setDepth(5000 + y);
    return avatar;
  }

  private createMiniBall(x: number, y: number, scale: number): Phaser.GameObjects.Container {
    const shell = this.add.circle(0, 0, 10, 0xffffff, 1).setStrokeStyle(2, 0x0f172a, 1);
    const patchA = this.add.circle(0, -1, 2.6, 0x111827, 1);
    const patchB = this.add.circle(4, 3, 2.2, 0x111827, 1);
    const patchC = this.add.circle(-4, 3, 2.2, 0x111827, 1);
    return this.add.container(x, y, [shell, patchA, patchB, patchC]).setScale(scale);
  }

  private animateMinigamePreview(actors: MinigameActorSet, attackingSide: Side, targetX: number): Promise<void> {
    const { width, height } = this.cameras.main;

    const ballStartX = actors.ball.x;
    const ballStartY = actors.ball.y;
    const goalY = attackingSide === "HOME" ? 136 : height - 286;
    const keeperDiveY = attackingSide === "HOME" ? 140 : height - 270;

    return new Promise((resolve) => {
      this.tweens.add({
        targets: actors.keeper,
        x: Phaser.Math.Clamp(targetX, width / 2 - 72, width / 2 + 72),
        y: keeperDiveY,
        duration: 280,
        ease: "Quad.Out",
      });

      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 480,
        ease: "Sine.easeInOut",
        onUpdate: (tween) => {
          const t = Number(tween.getValue() ?? 0);
          const nx = Phaser.Math.Linear(ballStartX, targetX, t);
          const ny = Phaser.Math.Linear(ballStartY, goalY, t);
          const arc = Math.sin(Math.PI * t) * 36;
          actors.ball.setPosition(nx, ny - arc);
        },
        onComplete: () => resolve(),
      });
    });
  }

  private async animateChanceOnPitch(
    event: MatchChanceEvent,
    eventIndex: number,
    scored: boolean,
    chanceType: ChanceType
  ) {
    const attackingSide = event.attackingSide;
    const defendingSide: Side = attackingSide === "HOME" ? "AWAY" : "HOME";
    const attackDir = attackingSide === "HOME" ? -1 : 1;

    const attacker = this.pickAttacker(attackingSide, chanceType, eventIndex);
    const support = this.pickSupport(attackingSide, attacker, eventIndex);
    const defenders = this.pickNearestDefenders(defendingSide, attacker, 2);
    const goalkeeper = this.getGoalkeeper(defendingSide);

    const attackX = attacker.baseX + this.pickSignedOffset(eventIndex + 3, 18);
    const attackY = attacker.baseY + attackDir * (chanceType === "ONE_ON_ONE" ? 56 : 42);

    await this.moveBallTo(attacker.baseX, attacker.baseY - 8, 280, 14);

    await Promise.all([
      this.tweenPlayerTo(attacker, attackX, attackY, 380),
      support ? this.tweenPlayerTo(support, support.baseX + this.pickSignedOffset(eventIndex + 7, 12), support.baseY + attackDir * 24, 380) : Promise.resolve(),
      ...defenders.map((defender, index) =>
        this.tweenPlayerTo(
          defender,
          defender.baseX + Phaser.Math.Clamp(attackX - defender.baseX, -26, 26),
          defender.baseY - attackDir * (16 + index * 8),
          420
        )
      ),
    ]);

    await this.moveBallTo(attackX, attackY - 10, 300, 12);

    this.tweens.add({
      targets: attacker.container,
      scaleX: attacker.container.scaleX * 1.04,
      scaleY: attacker.container.scaleY * 0.96,
      duration: 90,
      yoyo: true,
      ease: "Quad.Out",
    });

    const shotX = this.pickShotTargetX(eventIndex, attackingSide);
    const goalY = attackingSide === "HOME" ? this.pitchTop + 16 : this.pitchTop + this.pitchHeight - 16;

    if (scored) {
      await Promise.all([
        this.moveBallTo(shotX, goalY, 540, 26),
        this.tweenPlayerTo(
          goalkeeper,
          goalkeeper.baseX + Phaser.Math.Clamp(shotX - goalkeeper.baseX, -48, 48),
          goalkeeper.baseY + (attackingSide === "HOME" ? 8 : -8),
          380
        ),
      ]);
    } else {
      const saveX = goalkeeper.baseX + Phaser.Math.Clamp(shotX - goalkeeper.baseX, -42, 42);
      const saveY = goalkeeper.baseY + (attackingSide === "HOME" ? 12 : -12);

      await Promise.all([
        this.tweenPlayerTo(goalkeeper, saveX, saveY, 360),
        this.moveBallTo(saveX, saveY - 10, 440, 22),
      ]);

      await this.moveBallTo(saveX + this.pickSignedOffset(eventIndex + 15, 14), saveY + (attackingSide === "HOME" ? 20 : -20), 230, 7);
    }

    const resetPlayers = [attacker, support, ...defenders, goalkeeper].filter((player): player is PitchPlayer => Boolean(player));

    await Promise.all(resetPlayers.map((player) => this.tweenPlayerTo(player, player.baseX, player.baseY, 300)));
    await this.moveBallTo(this.pitchLeft + this.pitchWidth / 2, this.pitchTop + this.pitchHeight / 2, 280, 8);
  }

  private pickAttacker(side: Side, chanceType: ChanceType, eventIndex: number): PitchPlayer {
    const players = this.getSidePlayers(side).filter((player) => player.role !== "GK");
    const priority = chanceType === "CLOSE_RANGE" || chanceType === "ONE_ON_ONE" ? ["ATT", "MID", "DEF"] : ["MID", "ATT", "DEF"];

    for (const role of priority) {
      const byRole = players.filter((player) => player.role === role);
      if (!byRole.length) {
        continue;
      }
      const pick = Math.floor(hashUnit(`${this.matchSeed}:${eventIndex}:${side}:attacker:${role}`) * byRole.length);
      return byRole[pick];
    }

    return players[0];
  }

  private pickSupport(side: Side, attacker: PitchPlayer, eventIndex: number): PitchPlayer | null {
    const options = this.getSidePlayers(side)
      .filter((player) => player.role !== "GK" && player !== attacker)
      .sort((a, b) =>
        Phaser.Math.Distance.Between(a.baseX, a.baseY, attacker.baseX, attacker.baseY) -
        Phaser.Math.Distance.Between(b.baseX, b.baseY, attacker.baseX, attacker.baseY)
      );

    if (!options.length) {
      return null;
    }

    const idx = Math.floor(hashUnit(`${this.matchSeed}:${eventIndex}:${side}:support`) * Math.min(options.length, 3));
    return options[idx] ?? options[0];
  }

  private pickNearestDefenders(side: Side, attacker: PitchPlayer, count: number): PitchPlayer[] {
    const defenders = this.getSidePlayers(side)
      .filter((player) => player.role !== "GK")
      .sort((a, b) =>
        Phaser.Math.Distance.Between(a.baseX, a.baseY, attacker.baseX, attacker.baseY) -
        Phaser.Math.Distance.Between(b.baseX, b.baseY, attacker.baseX, attacker.baseY)
      );

    return defenders.slice(0, count);
  }

  private getGoalkeeper(side: Side): PitchPlayer {
    return this.getSidePlayers(side).find((player) => player.role === "GK") ?? this.getSidePlayers(side)[0];
  }

  private getSidePlayers(side: Side): PitchPlayer[] {
    return side === "HOME" ? this.homePlayers : this.awayPlayers;
  }

  private pickShotTargetX(eventIndex: number, side: Side): number {
    const center = this.pitchLeft + this.pitchWidth / 2;
    const spread = this.pitchWidth * 0.22;
    const unit = hashUnit(`${this.matchSeed}:${eventIndex}:${side}:shot-target`);
    return center - spread + spread * 2 * unit;
  }

  private pickSignedOffset(seedOffset: number, maxAbs: number): number {
    const unit = hashUnit(`${this.matchSeed}:${this.eventCursor}:${seedOffset}`);
    return (unit * 2 - 1) * maxAbs;
  }

  private tweenPlayerTo(player: PitchPlayer, x: number, y: number, duration: number): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({
        targets: player.container,
        x,
        y,
        duration,
        ease: "Sine.easeInOut",
        onUpdate: () => {
          player.container.setDepth(500 + player.container.y);
        },
        onComplete: () => {
          player.container.setDepth(500 + player.container.y);
          resolve();
        },
      });
    });
  }

  private moveBallTo(x: number, y: number, duration: number, arcHeight = 0): Promise<void> {
    const startX = this.ball.x;
    const startY = this.ball.y;

    return new Promise((resolve) => {
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration,
        ease: "Sine.easeInOut",
        onUpdate: (tween) => {
          const t = Number(tween.getValue() ?? 0);
          const nx = Phaser.Math.Linear(startX, x, t);
          const ny = Phaser.Math.Linear(startY, y, t);
          const loft = arcHeight > 0 ? Math.sin(Math.PI * t) * arcHeight : 0;
          this.setBallPosition(nx, ny, loft);
        },
        onComplete: () => {
          this.setBallPosition(x, y, 0);
          resolve();
        },
      });
    });
  }

  private applyEventOutcome(event: MatchChanceEvent, chanceType: ChanceType, tapQuality: TapQuality, tapped: boolean) {
    const sideName = event.attackingSide === "HOME" ? this.ui.homeName : this.ui.awayName;

    if (event.scored) {
      if (event.attackingSide === "HOME") {
        this.homeGoals += 1;
      } else {
        this.awayGoals += 1;
      }

      this.scoreText.setText(`${this.ui.homeName} ${this.homeGoals} - ${this.awayGoals} ${this.ui.awayName}`);
      this.commentaryText.setText(
        `${chanceTypeDisplayName(chanceType)}: GOAL for ${sideName} (${tapQuality}${tapped ? "" : ", auto"})`
      );
      this.flashGoalBanner(sideName);
      return;
    }

    this.commentaryText.setText(
      `${chanceTypeDisplayName(chanceType)}: ${sideName} denied (${tapQuality}${tapped ? "" : ", auto"})`
    );
  }

  private flashGoalBanner(sideName: string) {
    const { width } = this.cameras.main;

    const banner = this.add.rectangle(width / 2, 102, width - 44, 46, 0x8d2c24, 0.95).setStrokeStyle(2, 0xf8fafc, 1);
    const text = this.add
      .text(width / 2, 102, `GOAL - ${sideName}`, {
        fontFamily: "Barlow Condensed, Arial",
        fontSize: "34px",
        color: "#f8fafc",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5);

    banner.setDepth(2600);
    text.setDepth(2601);

    this.time.delayedCall(760, () => {
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
      this.chanceOutcomes,
      this.simulation.durationSeconds,
      this.baseRuntimeResult
    );

    this.timerText.setText(formatMatchClock(Math.min(finalResult.durationSeconds, MATCH_DURATION_SECONDS)));
    this.scoreText.setText(`${this.ui.homeName} ${finalResult.homeGoals} - ${finalResult.awayGoals} ${this.ui.awayName}`);

    this.commentaryText.setText(`FINAL: ${finalResult.result} (${finalResult.endReason.replaceAll("_", " ")})`);

    this.onFinished(finalResult);
  }
}

function drawMinigameField(graphics: Phaser.GameObjects.Graphics, width: number, height: number, attackingSide: Side) {
  graphics.fillStyle(0x4f9632, 1);
  graphics.fillRect(0, 0, width, height);

  const stripeCount = 8;
  const stripeHeight = height / stripeCount;
  for (let i = 0; i < stripeCount; i += 1) {
    graphics.fillStyle(i % 2 === 0 ? 0x73ba4a : 0x66ad41, 0.9);
    graphics.fillRect(0, i * stripeHeight, width, stripeHeight + 1);
  }

  graphics.lineStyle(5, 0xf8fafc, 1);
  if (attackingSide === "HOME") {
    graphics.strokeRect(42, 82, width - 84, 126);
    graphics.strokeRect(84, 82, width - 168, 58);
    graphics.beginPath();
    graphics.arc(width / 2, 210, 56, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
    graphics.strokePath();

    graphics.strokeRect(width / 2 - 80, 30, 160, 44);
    drawNet(graphics, width / 2 - 80, 30, 160, 44);
    return;
  }

  graphics.strokeRect(42, height - 210, width - 84, 126);
  graphics.strokeRect(84, height - 140, width - 168, 58);
  graphics.beginPath();
  graphics.arc(width / 2, height - 210, 56, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false);
  graphics.strokePath();

  graphics.strokeRect(width / 2 - 80, height - 74, 160, 44);
  drawNet(graphics, width / 2 - 80, height - 74, 160, 44);
}

function drawNet(graphics: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  graphics.lineStyle(1.2, 0xf8fafc, 0.72);
  for (let i = 0; i <= 10; i += 1) {
    const px = x + (w / 10) * i;
    graphics.lineBetween(px, y, px, y + h);
  }
  for (let i = 1; i <= 5; i += 1) {
    const py = y + (h / 6) * i;
    graphics.lineBetween(x, py, x + w, py);
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

  const zoneWidth = clamp(54, 150, 90 + roleAdjustedEdge * 130 + event.quality * 20 - difficultyFromType * 24);
  const markerDurationMs = Phaser.Math.Linear(700, 1500, 1 - difficulty);
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
}): { scored: boolean; scoreProbability: number } {
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

  const scoreProbability = clamp01(baseFromEngine + statEdge + staminaEdge + qualityEdge + chanceTypeEdge + userEdge);
  const roll = hashUnit(`${options.seed}:${options.eventIndex}:resolve:${tapQuality}:${tapped ? 1 : 0}`);
  return {
    scored: roll <= scoreProbability,
    scoreProbability: Number(scoreProbability.toFixed(4)),
  };
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
  chanceOutcomes: MatchChanceOutcome[],
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
    chanceOutcomes,
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
    chanceOutcomes: [],
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

function darkenColor(input: number, ratio: number): number {
  const r = (input >> 16) & 0xff;
  const g = (input >> 8) & 0xff;
  const b = input & 0xff;

  const factor = clamp(0, 1, 1 - ratio);
  const nr = Math.floor(r * factor);
  const ng = Math.floor(g * factor);
  const nb = Math.floor(b * factor);

  return (nr << 16) | (ng << 8) | nb;
}
