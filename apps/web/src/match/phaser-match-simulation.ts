import * as Phaser from "phaser";
import {
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
import type { FormationCode, MatchChanceEvent, MatchSimulationOutput } from "../../../../packages/game-core/src/types";

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
  formation: FormationCode | string;
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
type Lane = -1 | 0 | 1;
type AmbientAction = "PASS" | "DRIBBLE" | "THROUGH_BALL" | "RECYCLE";
type SupportRole = "SAFE" | "PROGRESSIVE" | "WIDTH";

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

interface TacticalAnchor {
  x: number;
  y: number;
}

interface SupportZoneProfile {
  safeDistance: number;
  progressiveDistance: number;
  safeForwardBias: number;
  progressiveForwardBias: number;
}

interface SupportCandidate {
  player: PitchPlayer;
  anchor: TacticalAnchor;
  distance: number;
  forwardDelta: number;
  forwardAxis: number;
  angleDeg: number;
  laneQuality: number;
  pressure: number;
  thirdManValue: number;
  safeScore: number;
  progressiveScore: number;
  widthScore: number;
}

interface SupportShapePlan {
  safeOutlet: PitchPlayer | null;
  progressiveOutlet: PitchPlayer | null;
  widthOutlet: PitchPlayer | null;
  fallbackReceiver: PitchPlayer;
  supportTargets: Map<PitchPlayer, TacticalAnchor>;
  shapeScore: number;
  progressionThreat: number;
}

interface MinigameActorSet {
  layer: Phaser.GameObjects.Container;
  shooter: Phaser.GameObjects.Container;
  keeper: Phaser.GameObjects.Container;
  ball: Phaser.GameObjects.Container;
}

interface DisplayClockState {
  half: 1 | 2;
  halfLabel: string;
  clockText: string;
}

const TOP_FORMATION: FormationNode[] = [
  { x: 0.5, y: 0.1, role: "GK" },
  { x: 0.14, y: 0.24, role: "DEF" },
  { x: 0.36, y: 0.24, role: "DEF" },
  { x: 0.64, y: 0.24, role: "DEF" },
  { x: 0.86, y: 0.24, role: "DEF" },
  { x: 0.14, y: 0.4, role: "MID" },
  { x: 0.36, y: 0.4, role: "MID" },
  { x: 0.64, y: 0.4, role: "MID" },
  { x: 0.86, y: 0.4, role: "MID" },
  { x: 0.42, y: 0.54, role: "ATT" },
  { x: 0.58, y: 0.54, role: "ATT" },
];
const SUPPORTED_FORMATIONS: FormationCode[] = ["4-4-2", "4-3-3", "4-5-1", "4-2-3-1", "3-5-2", "5-3-2", "4-2-4"];
const TOP_FORMATION_LAYOUTS: Record<FormationCode, FormationNode[]> = {
  "4-4-2": TOP_FORMATION,
  "4-3-3": [
    { x: 0.5, y: 0.1, role: "GK" },
    { x: 0.14, y: 0.24, role: "DEF" },
    { x: 0.36, y: 0.24, role: "DEF" },
    { x: 0.64, y: 0.24, role: "DEF" },
    { x: 0.86, y: 0.24, role: "DEF" },
    { x: 0.26, y: 0.39, role: "MID" },
    { x: 0.5, y: 0.41, role: "MID" },
    { x: 0.74, y: 0.39, role: "MID" },
    { x: 0.2, y: 0.54, role: "ATT" },
    { x: 0.5, y: 0.57, role: "ATT" },
    { x: 0.8, y: 0.54, role: "ATT" },
  ],
  "4-5-1": [
    { x: 0.5, y: 0.1, role: "GK" },
    { x: 0.14, y: 0.24, role: "DEF" },
    { x: 0.36, y: 0.24, role: "DEF" },
    { x: 0.64, y: 0.24, role: "DEF" },
    { x: 0.86, y: 0.24, role: "DEF" },
    { x: 0.12, y: 0.4, role: "MID" },
    { x: 0.31, y: 0.4, role: "MID" },
    { x: 0.5, y: 0.41, role: "MID" },
    { x: 0.69, y: 0.4, role: "MID" },
    { x: 0.88, y: 0.4, role: "MID" },
    { x: 0.5, y: 0.56, role: "ATT" },
  ],
  "4-2-3-1": [
    { x: 0.5, y: 0.1, role: "GK" },
    { x: 0.14, y: 0.24, role: "DEF" },
    { x: 0.36, y: 0.24, role: "DEF" },
    { x: 0.64, y: 0.24, role: "DEF" },
    { x: 0.86, y: 0.24, role: "DEF" },
    { x: 0.37, y: 0.37, role: "MID" },
    { x: 0.63, y: 0.37, role: "MID" },
    { x: 0.2, y: 0.47, role: "MID" },
    { x: 0.5, y: 0.49, role: "MID" },
    { x: 0.8, y: 0.47, role: "MID" },
    { x: 0.5, y: 0.58, role: "ATT" },
  ],
  "3-5-2": [
    { x: 0.5, y: 0.1, role: "GK" },
    { x: 0.22, y: 0.25, role: "DEF" },
    { x: 0.5, y: 0.24, role: "DEF" },
    { x: 0.78, y: 0.25, role: "DEF" },
    { x: 0.12, y: 0.41, role: "MID" },
    { x: 0.31, y: 0.41, role: "MID" },
    { x: 0.5, y: 0.42, role: "MID" },
    { x: 0.69, y: 0.41, role: "MID" },
    { x: 0.88, y: 0.41, role: "MID" },
    { x: 0.41, y: 0.56, role: "ATT" },
    { x: 0.59, y: 0.56, role: "ATT" },
  ],
  "5-3-2": [
    { x: 0.5, y: 0.1, role: "GK" },
    { x: 0.1, y: 0.25, role: "DEF" },
    { x: 0.28, y: 0.25, role: "DEF" },
    { x: 0.5, y: 0.24, role: "DEF" },
    { x: 0.72, y: 0.25, role: "DEF" },
    { x: 0.9, y: 0.25, role: "DEF" },
    { x: 0.26, y: 0.42, role: "MID" },
    { x: 0.5, y: 0.43, role: "MID" },
    { x: 0.74, y: 0.42, role: "MID" },
    { x: 0.42, y: 0.56, role: "ATT" },
    { x: 0.58, y: 0.56, role: "ATT" },
  ],
  "4-2-4": [
    { x: 0.5, y: 0.1, role: "GK" },
    { x: 0.14, y: 0.24, role: "DEF" },
    { x: 0.36, y: 0.24, role: "DEF" },
    { x: 0.64, y: 0.24, role: "DEF" },
    { x: 0.86, y: 0.24, role: "DEF" },
    { x: 0.38, y: 0.39, role: "MID" },
    { x: 0.62, y: 0.39, role: "MID" },
    { x: 0.1, y: 0.54, role: "ATT" },
    { x: 0.35, y: 0.54, role: "ATT" },
    { x: 0.65, y: 0.54, role: "ATT" },
    { x: 0.9, y: 0.54, role: "ATT" },
  ],
};
const DISABLED_EARLY_FINISH_GOAL_LEAD = 99;
const HALF_DURATION_SECONDS = Math.floor(MATCH_DURATION_SECONDS / 2);
const HALF_TIME_TRANSITION_MS = 2500;
const TEAM_WALK_DURATION_MS = 900;
const TEAM_WALK_STAGGER_MS = 34;
const WIN_CELEBRATION_REPEAT = 4;
const VIRTUAL_HALF_MINUTES = 45;
const VIRTUAL_HALF_SECONDS = VIRTUAL_HALF_MINUTES * 60;
const PITCH_WIDTH_UNITS = 1020;
const PITCH_HEIGHT_UNITS = 1670;
const PITCH_HEIGHT_RATIO = PITCH_HEIGHT_UNITS / PITCH_WIDTH_UNITS;
const SIM_PITCH_TOP_OFFSET = 0;
const SIM_PITCH_BOTTOM_PADDING = 0;
const HUD_PITCH_INSET_X = 10;
const HUD_PITCH_INSET_Y = 10;
const PLAYER_EDGE_X_PADDING_RATIO = 0.024;
const PLAYER_EDGE_Y_PADDING_RATIO = 0.016;
const GOAL_LINE_BALL_OFFSET_RATIO = 0.009;
const SHOT_TARGET_SPREAD_RATIO = 0.19;

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
        homeCode: toTeamCode(runtimeConfig.homeTeam.name),
        awayCode: toTeamCode(runtimeConfig.awayTeam.name),
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
  private static readonly PITCH_TEXTURE_KEY = "match-portrait-pitch";

  private readonly simulation: MatchSimulationOutput;
  private readonly baseRuntimeResult: MatchRuntimeResult;
  private readonly matchSeed: string;
  private readonly ui: {
    homeName: string;
    awayName: string;
    homeCode: string;
    awayCode: string;
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
  private commentaryBackdrop!: Phaser.GameObjects.Rectangle;
  private commentaryText!: Phaser.GameObjects.Text;
  private commentaryMaxTextWidth = 0;

  private homePlayers: PitchPlayer[] = [];
  private awayPlayers: PitchPlayer[] = [];

  private ballShadow!: Phaser.GameObjects.Ellipse;
  private ball!: Phaser.GameObjects.Container;
  private ambientAnimating = false;
  private possessionSide: Side = "HOME";
  private lastPossessor: PitchPlayer | null = null;
  private possessionProgress = 0.12;
  private possessionLane: Lane = 0;
  private sideSwapApplied = false;
  private halfTimeTransitionActive = false;
  private walkOnSequenceActive = false;
  private fullTimeSequenceActive = false;

  constructor(options: {
    simulation: MatchSimulationOutput;
    baseRuntimeResult: MatchRuntimeResult;
    matchSeed: string;
    ui: {
      homeName: string;
      awayName: string;
      homeCode: string;
      awayCode: string;
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

  preload() {
    if (!this.textures.exists(MatchSimulationScene.PITCH_TEXTURE_KEY)) {
      this.load.image(MatchSimulationScene.PITCH_TEXTURE_KEY, "/assets/pitch/vertical-pitch.svg");
    }
  }

  create() {
    const { width, height } = this.cameras.main;

    this.pitchLeft = 0;
    this.pitchWidth = width;
    const pitchTopMin = SIM_PITCH_TOP_OFFSET;
    const pitchBottomPadding = SIM_PITCH_BOTTOM_PADDING;
    const availablePitchHeight = Math.max(420, height - pitchTopMin - pitchBottomPadding);
    const targetPitchHeight = Math.round(this.pitchWidth * PITCH_HEIGHT_RATIO);
    this.pitchHeight = Math.min(availablePitchHeight, targetPitchHeight);
    this.pitchTop = pitchTopMin + Math.max(0, Math.floor((availablePitchHeight - this.pitchHeight) / 2));

    this.drawVerticalPitch();
    this.buildHud();
    this.createTeams();
    this.createBall();
    this.possessionSide = hashUnit(`${this.matchSeed}:kickoff:side`) < 0.5 ? "HOME" : "AWAY";
    this.createCommentaryOverlay();
    this.setCommentary("TEAMS WALK ON");
    this.placeTeamsOffPitchLeft();
    this.setBallVisible(false);
    void this.runKickoffWalkOnSequence();

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

  private createCommentaryOverlay() {
    const centerX = this.pitchLeft + this.pitchWidth / 2;
    const centerY = this.pitchTop + this.pitchHeight / 2;
    const horizontalMargin = Math.max(8, Math.round(this.pitchWidth * 0.015));
    const overlayWidth = Math.max(220, this.pitchWidth - horizontalMargin * 2);
    const overlayHeight = Math.round(clamp(36, 48, this.pitchHeight * 0.028));
    const fontSize = Math.round(clamp(18, 30, this.pitchWidth * 0.043));

    this.commentaryBackdrop = this.add
      .rectangle(centerX, centerY, overlayWidth, overlayHeight, 0x031328, 0.56)
      .setStrokeStyle(1.5, 0xe2f1ff, 0.42)
      .setDepth(1990);

    this.commentaryMaxTextWidth = overlayWidth - 22;
    this.commentaryText = this.add
      .text(centerX, centerY, "", {
        fontFamily: "Barlow Condensed, Arial",
        fontSize: `${fontSize}px`,
        color: "#e6f3ff",
        fontStyle: "bold",
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(2000);
  }

  private setCommentary(message: string) {
    const normalized = message.replace(/\s+/g, " ").trim();
    if (!normalized) {
      this.commentaryText.setText("");
      return;
    }

    this.commentaryText.setText(normalized);
    if (this.commentaryText.width <= this.commentaryMaxTextWidth) {
      return;
    }

    const suffix = "...";
    let low = 1;
    let high = normalized.length;
    let fit = "";

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = `${normalized.slice(0, mid).trimEnd()}${suffix}`;
      this.commentaryText.setText(candidate);
      if (this.commentaryText.width <= this.commentaryMaxTextWidth) {
        fit = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    this.commentaryText.setText(fit || suffix);
  }

  private drawVerticalPitch() {
    const x = this.pitchLeft;
    const y = this.pitchTop;
    const w = this.pitchWidth;
    const h = this.pitchHeight;
    const centerX = x + w / 2;
    const centerY = y + h / 2;

    if (this.textures.exists(MatchSimulationScene.PITCH_TEXTURE_KEY)) {
      this.add.image(centerX, centerY, MatchSimulationScene.PITCH_TEXTURE_KEY).setDisplaySize(w, h).setDepth(0);
      return;
    }

    const borderRadius = 18;
    const lineWidth = 6;
    const centerCircleRadius = w * 0.17;
    const penaltyArcRadius = w * 0.095;
    const penaltyW = w * 0.68;
    const penaltyH = h * 0.135;
    const sixW = w * 0.35;
    const sixH = h * 0.06;
    const dashLength = w * 0.09;
    const dashGap = dashLength * 0.75;

    const base = this.add.graphics();
    base.fillStyle(0x2f6e1f, 1);
    base.fillRoundedRect(x, y, w, h, borderRadius);

    const stripes = this.add.graphics();
    const stripeCount = 12;
    const stripeHeight = h / stripeCount;
    for (let i = 0; i < stripeCount; i += 1) {
      stripes.fillStyle(i % 2 === 0 ? 0x66b53b : 0x5aa330, 0.95);
      stripes.fillRect(x, y + i * stripeHeight, w, stripeHeight + 1);
    }
    const stripeMaskShape = this.add.graphics();
    stripeMaskShape.setVisible(false);
    stripeMaskShape.fillStyle(0xffffff, 1);
    stripeMaskShape.fillRoundedRect(x, y, w, h, borderRadius);
    stripes.setMask(stripeMaskShape.createGeometryMask());

    const lines = this.add.graphics();
    lines.lineStyle(lineWidth, 0xf8fafc, 1);
    lines.strokeRoundedRect(x, y, w, h, borderRadius);

    for (let dashX = x; dashX < x + w; dashX += dashLength + dashGap) {
      const dashEnd = Math.min(dashX + dashLength, x + w);
      lines.lineBetween(dashX, centerY, dashEnd, centerY);
    }

    lines.strokeCircle(centerX, centerY, centerCircleRadius);

    lines.strokeRect(centerX - penaltyW / 2, y, penaltyW, penaltyH);
    lines.strokeRect(centerX - sixW / 2, y, sixW, sixH);

    lines.beginPath();
    lines.arc(centerX, y + penaltyH, penaltyArcRadius, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
    lines.strokePath();

    lines.strokeRect(centerX - penaltyW / 2, y + h - penaltyH, penaltyW, penaltyH);
    lines.strokeRect(centerX - sixW / 2, y + h - sixH, sixW, sixH);

    lines.beginPath();
    lines.arc(centerX, y + h - penaltyH, penaltyArcRadius, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false);
    lines.strokePath();

    lines.fillStyle(0xf8fafc, 1);
    lines.fillCircle(centerX, y + penaltyH - 28, 5);
    lines.fillCircle(centerX, y + h - penaltyH + 28, 5);
  }

  private buildHud() {
    const startClock = toDisplayClockState(0);
    const bugLeft = this.pitchLeft + HUD_PITCH_INSET_X;
    const bugTop = this.pitchTop + HUD_PITCH_INSET_Y;
    const timerWidth = 60;
    const scoreWidth = Math.round(clamp(132, 166, this.pitchWidth * 0.3));
    const bugHeight = 24;
    const totalWidth = timerWidth + scoreWidth;

    const bugPanel = this.add.graphics().setDepth(2100);
    bugPanel.fillStyle(0xf8fafc, 0.96);
    bugPanel.fillRoundedRect(bugLeft, bugTop, totalWidth, bugHeight, 8);
    bugPanel.lineStyle(1, 0x0f172a, 0.28);
    bugPanel.strokeRoundedRect(bugLeft, bugTop, totalWidth, bugHeight, 8);

    const scoreLeft = bugLeft + timerWidth;
    bugPanel.fillStyle(0x031328, 0.62);
    bugPanel.fillRoundedRect(scoreLeft - 1, bugTop + 1, scoreWidth + 1, bugHeight - 2, 7);

    this.timerText = this.add
      .text(bugLeft + timerWidth / 2, bugTop + bugHeight / 2, startClock.clockText, {
        fontFamily: "Courier New",
        fontSize: "12px",
        color: "#0f172a",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(2200);

    const scoreCenterY = bugTop + bugHeight / 2;
    const homeCodeX = scoreLeft + 20;
    const awayCodeX = scoreLeft + scoreWidth - 9;

    this.add
      .text(homeCodeX, scoreCenterY, this.ui.homeCode, {
        fontFamily: "Barlow Condensed, Arial",
        fontSize: "16px",
        color: "#f8fafc",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5)
      .setDepth(2201);

    const awayCodeText = this.add
      .text(awayCodeX, scoreCenterY, this.ui.awayCode, {
        fontFamily: "Barlow Condensed, Arial",
        fontSize: "16px",
        color: "#f8fafc",
        fontStyle: "bold",
      })
      .setOrigin(1, 0.5)
      .setDepth(2201);

    this.add
      .circle(homeCodeX - 8, scoreCenterY, 3.5, this.ui.homeColor, 1)
      .setStrokeStyle(1, 0xf8fafc, 0.75)
      .setDepth(2202);
    this.add
      .circle(awayCodeX - awayCodeText.width - 8, scoreCenterY, 3.5, this.ui.awayColor, 1)
      .setStrokeStyle(1, 0xf8fafc, 0.75)
      .setDepth(2202);

    this.scoreText = this.add
      .text(scoreLeft + scoreWidth / 2, scoreCenterY, `${this.homeGoals} - ${this.awayGoals}`, {
        fontFamily: "Barlow Condensed, Arial",
        fontSize: "16px",
        color: "#f8fafc",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(2200);
  }

  private refreshScoreHud(homeGoals = this.homeGoals, awayGoals = this.awayGoals) {
    this.scoreText.setText(`${homeGoals} - ${awayGoals}`);
  }

  private createTeams() {
    const homeFormation = mirrorFormationVertically(resolveFormationLayout(this.teams.home.formation));
    const awayFormation = resolveFormationLayout(this.teams.away.formation);

    this.homePlayers = this.createTeam(
      "HOME",
      homeFormation,
      this.ui.homeColor,
      0xf4d03f,
      "up"
    );

    this.awayPlayers = this.createTeam("AWAY", awayFormation, this.ui.awayColor, 0x2ecc71, "down");
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

  private async runKickoffWalkOnSequence() {
    if (this.walkOnSequenceActive) {
      return;
    }

    this.walkOnSequenceActive = true;
    try {
      await this.walkBothTeamsToBase(TEAM_WALK_DURATION_MS);
      this.assignKickoffPossessor(this.possessionSide);
      this.setBallVisible(true);
      this.setCommentary("KICK OFF");
    } finally {
      this.walkOnSequenceActive = false;
    }
  }

  private placeTeamsOffPitchLeft() {
    const offscreenX = this.pitchLeft - Math.max(72, this.pitchWidth * 0.13);
    const allPlayers = [...this.homePlayers, ...this.awayPlayers].sort((a, b) => a.baseY - b.baseY);

    allPlayers.forEach((player, idx) => {
      const laneOffset = ((idx % 4) - 1.5) * 5;
      const x = offscreenX - (idx % 3) * 8;
      const y = this.clampPitchY(player.baseY + laneOffset);
      player.container.setPosition(x, y);
      player.container.setDepth(500 + y);
    });
  }

  private async walkBothTeamsToBase(durationMs: number): Promise<void> {
    await Promise.all([
      this.walkTeamToBase("HOME", durationMs),
      this.walkTeamToBase("AWAY", durationMs),
    ]);
  }

  private async walkBothTeamsOffPitchLeft(durationMs: number): Promise<void> {
    await Promise.all([
      this.walkTeamOffPitchLeft("HOME", durationMs),
      this.walkTeamOffPitchLeft("AWAY", durationMs),
    ]);
  }

  private async walkTeamToBase(side: Side, durationMs: number): Promise<void> {
    const team = this.getSidePlayers(side);
    await Promise.all(
      team.map((player, idx) =>
        this.tweenPlayerToWithDelay(player, player.baseX, player.baseY, durationMs, idx * TEAM_WALK_STAGGER_MS)
      )
    );
  }

  private async walkTeamOffPitchLeft(side: Side, durationMs: number): Promise<void> {
    const team = this.getSidePlayers(side);
    const offscreenX = this.pitchLeft - Math.max(86, this.pitchWidth * 0.16);
    await Promise.all(
      team.map((player, idx) =>
        this.tweenPlayerToWithDelay(
          player,
          offscreenX - (idx % 2) * 10,
          this.clampPitchY(player.container.y + ((idx % 3) - 1) * 2),
          durationMs,
          idx * Math.max(16, Math.floor(TEAM_WALK_STAGGER_MS * 0.65))
        )
      )
    );
  }

  private tweenPlayerToWithDelay(
    player: PitchPlayer,
    x: number,
    y: number,
    duration: number,
    delay: number
  ): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(Math.max(0, delay), () => {
        void this.tweenPlayerTo(player, x, y, duration).then(resolve);
      });
    });
  }

  private assignKickoffPossessor(side: Side) {
    const sidePlayers = this.getSidePlayers(side);
    this.lastPossessor =
      sidePlayers.find((player) => player.role === "MID") ??
      sidePlayers.find((player) => player.role === "ATT") ??
      sidePlayers[0] ??
      null;
    this.possessionSide = side;
    this.possessionProgress = 0.14;
    this.possessionLane = 0;

    if (this.lastPossessor) {
      this.setBallPosition(this.lastPossessor.baseX, this.lastPossessor.baseY - 10, 0);
      return;
    }

    this.setBallPosition(this.pitchLeft + this.pitchWidth / 2, this.pitchTop + this.pitchHeight / 2, 0);
  }

  private setBallVisible(isVisible: boolean) {
    this.ball.setVisible(isVisible);
    this.ballShadow.setVisible(isVisible);
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
    if (
      this.finished ||
      this.resolvingChance ||
      this.halfTimeTransitionActive ||
      this.walkOnSequenceActive ||
      this.fullTimeSequenceActive
    ) {
      return;
    }

    if (this.elapsed >= this.simulation.durationSeconds) {
      this.finishMatch();
      return;
    }

    const wasFirstHalf = this.elapsed < HALF_DURATION_SECONDS;
    this.elapsed += 1;
    const displayClock = toDisplayClockState(this.elapsed);
    this.timerText.setText(displayClock.clockText);

    if (wasFirstHalf && this.elapsed === HALF_DURATION_SECONDS) {
      void this.startHalfTimeTransition();
      return;
    }

    if (this.ambientAnimating) {
      return;
    }

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
    if (
      this.resolvingChance ||
      this.finished ||
      this.ambientAnimating ||
      this.halfTimeTransitionActive ||
      this.walkOnSequenceActive ||
      this.fullTimeSequenceActive
    ) {
      return;
    }

    this.ambientAnimating = true;
    void this.runAmbientPossessionPhase().finally(() => {
      this.ambientAnimating = false;
    });
  }

  private async startHalfTimeTransition() {
    if (this.halfTimeTransitionActive) {
      return;
    }

    this.halfTimeTransitionActive = true;
    try {
      this.setCommentary("HALF-TIME: TEAMS WALK OFF");
      this.setBallVisible(false);
      await this.walkBothTeamsOffPitchLeft(TEAM_WALK_DURATION_MS);

      this.applyHalfTimeSideSwap();
      this.possessionSide = this.possessionSide === "HOME" ? "AWAY" : "HOME";

      this.setCommentary("SECOND HALF: TEAMS WALK ON");
      await this.walkBothTeamsToBase(TEAM_WALK_DURATION_MS);
      this.assignKickoffPossessor(this.possessionSide);
      this.setBallVisible(true);
      this.setCommentary("SECOND HALF UNDERWAY");
      await this.waitMs(Math.max(300, HALF_TIME_TRANSITION_MS - TEAM_WALK_DURATION_MS * 2));
    } finally {
      this.halfTimeTransitionActive = false;
    }
  }

  private async runAmbientPossessionPhase(): Promise<void> {
    let attackingSide = this.possessionSide;
    let defendingSide: Side = attackingSide === "HOME" ? "AWAY" : "HOME";
    const naturalTurnoverRoll = hashUnit(`${this.matchSeed}:${this.elapsed}:ambient:turnover:pre`);

    if (naturalTurnoverRoll < 0.08) {
      attackingSide = defendingSide;
      defendingSide = attackingSide === "HOME" ? "AWAY" : "HOME";
      this.possessionSide = attackingSide;
      this.possessionProgress = 0.14;
      this.lastPossessor = null;
      this.possessionLane = 0;
    } else {
      const progressStep = 0.08 + hashUnit(`${this.matchSeed}:${this.elapsed}:ambient:step`) * 0.14;
      this.possessionProgress = clamp(0.08, 0.96, this.possessionProgress + progressStep);
    }

    const attackingOutfield = this.getSidePlayers(attackingSide).filter((player) => player.role !== "GK");
    if (attackingOutfield.length < 2) {
      return;
    }

    const carrier =
      this.lastPossessor && this.lastPossessor.side === attackingSide && this.lastPossessor.role !== "GK"
        ? this.lastPossessor
        : attackingOutfield[Math.floor(hashUnit(`${this.matchSeed}:${this.elapsed}:ambient:carrier`) * attackingOutfield.length)];

    const tacticalAnchors = this.buildAmbientShapeTargets(attackingSide, defendingSide);
    await this.alignPlayersToAmbientShape(tacticalAnchors, 240);
    const carrierAnchor = this.getAnchorPosition(tacticalAnchors, carrier);

    const centerX = this.pitchLeft + this.pitchWidth / 2;
    const forwardDir = this.getForwardDirection(attackingSide);
    const defendingRetreatDir = -this.getForwardDirection(defendingSide);
    const receiverPool = attackingOutfield.filter((player) => player !== carrier);
    const receiverOptions = [...receiverPool].sort(
      (a, b) =>
        Phaser.Math.Distance.Between(a.container.x, a.container.y, carrierAnchor.x, carrierAnchor.y) -
        Phaser.Math.Distance.Between(b.container.x, b.container.y, carrierAnchor.x, carrierAnchor.y)
    );
    if (!receiverOptions.length) {
      return;
    }

    const pressureDefenders = this.pickNearestDefenders(defendingSide, carrier, 3);

    const averagePressureDistance =
      pressureDefenders.length > 0
        ? pressureDefenders.reduce(
            (sum, defender) =>
              sum + Phaser.Math.Distance.Between(defender.container.x, defender.container.y, carrier.container.x, carrier.container.y),
            0
          ) / pressureDefenders.length
        : 160;
    const pressure = clamp01(
      (138 - averagePressureDistance) / 138 +
        (this.possessionProgress > 0.74 ? 0.16 : 0.06) +
        (this.possessionLane === 0 ? 0.07 : -0.02)
    );
    const space = clamp01(0.64 - pressure * 0.58 + (this.possessionLane === 0 ? -0.05 : 0.06));

    const supportPlan = this.buildSupportShapePlan(
      attackingSide,
      defendingSide,
      carrier,
      tacticalAnchors,
      pressure,
      this.possessionProgress,
      this.elapsed
    );
    const supportTargets = supportPlan.supportTargets;
    const safetyReceiver = supportPlan.safeOutlet ?? supportPlan.progressiveOutlet ?? supportPlan.fallbackReceiver;
    const progressiveReceiver = supportPlan.progressiveOutlet ?? supportPlan.safeOutlet ?? supportPlan.fallbackReceiver;
    const carrierForwardAxis = this.toForwardAxis(attackingSide, carrier.container.y);
    const goalLineOffset = Math.max(8, Math.round(this.pitchHeight * GOAL_LINE_BALL_OFFSET_RATIO));
    const targetGoalY =
      forwardDir < 0
        ? this.pitchTop + goalLineOffset
        : this.pitchTop + this.pitchHeight - goalLineOffset;
    const targetGoalX = this.clampPitchX(centerX + this.possessionLane * this.pitchWidth * 0.07);
    const shotLaneQuality = this.scorePassLaneQuality(
      carrier.container.x,
      carrier.container.y,
      targetGoalX,
      targetGoalY,
      pressureDefenders
    );
    const strikerCanShoot =
      carrier.role === "ATT" &&
      carrierForwardAxis / Math.max(1, this.pitchHeight) >= 0.62 &&
      this.possessionProgress >= 0.5 &&
      pressure <= 0.7 &&
      shotLaneQuality >= 0.48;
    const receiver = strikerCanShoot ? progressiveReceiver : pressure > 0.56 ? safetyReceiver : progressiveReceiver;
    const receiverAnchor = this.getAnchorPosition(tacticalAnchors, receiver);
    const supportMovers = this.uniquePitchPlayers([
      supportPlan.safeOutlet,
      supportPlan.progressiveOutlet,
      supportPlan.widthOutlet,
    ]).filter((player) => player !== carrier);

    const supportRun = clamp01(
      0.18 +
        this.possessionProgress * 0.24 +
        supportPlan.shapeScore * 0.26 +
        supportPlan.progressionThreat * 0.12 +
        (receiver.role === "ATT" ? 0.16 : receiver.role === "MID" ? 0.1 : 0.04) +
        hashUnit(`${this.matchSeed}:${this.elapsed}:ambient:supportrun`) * 0.2
    );

    const passScore =
      28 +
      space * 26 +
      supportRun * 18 +
      supportPlan.shapeScore * 20 -
      pressure * 24 +
      (carrier.role === "MID" ? 9 : 0) +
      (carrier.role === "ATT" ? 4 : 0) +
      (carrier.role === "ATT" && this.possessionProgress >= 0.58 ? -24 : 0);
    const dribbleScore =
      24 +
      space * 30 -
      pressure * 30 +
      supportPlan.shapeScore * 6 +
      (carrier.role === "ATT" ? 24 : carrier.role === "MID" ? 7 : 2) +
      (this.possessionProgress > 0.6 ? 5 : 0) +
      (carrier.role === "ATT" && this.possessionProgress >= 0.58 ? 14 : 0);
    const throughBallScore =
      this.possessionProgress > 0.42
        ? 19 +
          space * 20 +
          supportRun * 24 -
          pressure * 34 +
          supportPlan.progressionThreat * 16 +
          (carrier.role === "ATT" ? 14 : 0) +
          (this.possessionProgress > 0.62 ? 4 : 0) +
          (carrier.role === "ATT" && this.possessionProgress >= 0.58 ? 12 : 0)
        : -999;
    const recycleScore =
      16 +
      pressure * 18 +
      (supportPlan.safeOutlet ? 10 : 0) +
      (carrier.role === "DEF" ? 10 : 0) +
      (carrier.role === "ATT" ? -88 : 0) +
      (this.possessionProgress > 0.62 ? -14 : 0) +
      (carrier.role === "ATT" && this.possessionProgress >= 0.58 ? -36 : 0);

    const rankedActions: Array<{ action: AmbientAction; score: number }> = (
      [
        { action: "PASS" as AmbientAction, score: passScore + this.pickSignedOffset(this.elapsed + 141, 6) },
        { action: "DRIBBLE" as AmbientAction, score: dribbleScore + this.pickSignedOffset(this.elapsed + 147, 6) },
        { action: "THROUGH_BALL" as AmbientAction, score: throughBallScore + this.pickSignedOffset(this.elapsed + 151, 7) },
        { action: "RECYCLE" as AmbientAction, score: recycleScore + this.pickSignedOffset(this.elapsed + 157, 5) },
      ] satisfies Array<{ action: AmbientAction; score: number }>
    )
      .filter((entry) => entry.score > -900)
      .sort((a, b) => b.score - a.score);

    const actionRoll = hashUnit(`${this.matchSeed}:${this.elapsed}:ambient:action`);
    const inAttackingKillZone = strikerCanShoot || (carrier.role === "ATT" && this.possessionProgress >= 0.58);
    const avoidBackwardPass = strikerCanShoot;
    const directActions = rankedActions.filter(
      (entry) =>
        entry.action !== "RECYCLE" &&
        (!inAttackingKillZone || entry.action !== "PASS") &&
        (!avoidBackwardPass || entry.action !== "PASS")
    );
    const shouldForceDirectPlay = carrier.role === "ATT" && (this.possessionProgress >= 0.52 || strikerCanShoot);
    const preferredDirect =
      directActions.find((entry) => entry.action === "DRIBBLE" || entry.action === "THROUGH_BALL") ??
      directActions[0] ??
      rankedActions[0];
    const rankedFallback = rankedActions[0] ?? { action: "PASS" as AmbientAction, score: 0 };
    const secondFallback = rankedActions[1] ?? rankedFallback;
    const thirdFallback = rankedActions[2] ?? secondFallback;

    const action = shouldForceDirectPlay
      ? actionRoll < 0.84
        ? preferredDirect.action
        : (directActions[1] ?? directActions[0] ?? rankedFallback).action
      : actionRoll < 0.66
        ? rankedFallback.action
        : actionRoll < 0.89
          ? secondFallback.action
          : thirdFallback.action;

    let activeX = carrier.container.x;
    let activeY = carrier.container.y;
    let commentary = "";

    if (action === "PASS") {
      const receiverAdvance = 8 + this.possessionProgress * 24 + this.roleAdvanceBoost(receiver.role) * 0.9 + supportRun * 16;
      const carrierAdvance = 4 + this.possessionProgress * 14 + this.roleAdvanceBoost(carrier.role) * 0.5;
      const effectiveReceiver =
        carrier.role === "ATT" && this.possessionProgress >= 0.56
          ? progressiveReceiver
          : receiver;
      const effectiveReceiverAnchor = this.getAnchorPosition(tacticalAnchors, effectiveReceiver);
      const receiverPlanTarget = supportTargets.get(effectiveReceiver) ?? effectiveReceiverAnchor;
      const receiverRoleForwardBias = effectiveReceiver === safetyReceiver ? (strikerCanShoot ? 8 : -2) : 10;
      const receiverTargetX = this.clampPitchX(
        Phaser.Math.Linear(effectiveReceiverAnchor.x, receiverPlanTarget.x, 0.62) +
          this.pickSignedOffset(this.elapsed + 23, 12) +
          this.possessionLane * 5
      );
      const receiverDesiredY = this.clampPitchY(
        Phaser.Math.Linear(effectiveReceiverAnchor.y, receiverPlanTarget.y, 0.58) +
          forwardDir * (receiverRoleForwardBias + receiverAdvance * 0.32) +
          (hashUnit(`${this.matchSeed}:${this.elapsed}:receiver:y`) * 2 - 1) * 4
      );
      const receiverTargetY = this.limitRoleStepFromAnchor(
        effectiveReceiver,
        receiverDesiredY,
        effectiveReceiverAnchor.y,
        effectiveReceiver.role === "ATT" ? 16 : effectiveReceiver.role === "MID" ? 12 : 10
      );
      const carrierTargetX = this.clampPitchX(carrierAnchor.x + this.pickSignedOffset(this.elapsed + 29, 13));
      const carrierDesiredY = this.clampPitchY(
        carrierAnchor.y + forwardDir * carrierAdvance + (hashUnit(`${this.matchSeed}:${this.elapsed}:carrier:y`) * 2 - 1) * 5
      );
      const carrierTargetY = this.limitRoleStepFromAnchor(
        carrier,
        carrierDesiredY,
        carrierAnchor.y,
        carrier.role === "ATT" ? 14 : carrier.role === "MID" ? 11 : 9
      );
      const supportWithoutReceiver = supportMovers.filter((player) => player !== effectiveReceiver);
      const safeTarget = supportPlan.safeOutlet ? supportTargets.get(supportPlan.safeOutlet) : undefined;

      await Promise.all([
        this.tweenPlayerTo(carrier, carrierTargetX, carrierTargetY, 260),
        this.tweenPlayerTo(effectiveReceiver, receiverTargetX, receiverTargetY, 340),
        ...supportWithoutReceiver.map((player, idx) =>
          this.tweenPlayerTo(
            player,
            this.clampPitchX(
              (supportTargets.get(player)?.x ?? this.getAnchorPosition(tacticalAnchors, player).x) +
                this.pickSignedOffset(this.elapsed + idx + 41, 10)
            ),
            this.limitRoleStepFromAnchor(
              player,
              this.clampPitchY(
                (supportTargets.get(player)?.y ?? this.getAnchorPosition(tacticalAnchors, player).y) +
                  forwardDir * (4 + this.possessionProgress * 12 + this.roleAdvanceBoost(player.role) * 0.45 + supportRun * 6) +
                  (hashUnit(`${this.matchSeed}:${this.elapsed}:support:${idx}:y`) * 2 - 1) * 4
              ),
              this.getAnchorPosition(tacticalAnchors, player).y,
              player.role === "ATT" ? 14 : player.role === "MID" ? 10 : 8
            ),
            320
          )
        ),
        ...pressureDefenders.map((player, idx) =>
          this.tweenPlayerTo(
            player,
            this.clampPitchX(
              this.getAnchorPosition(tacticalAnchors, player).x +
                Phaser.Math.Clamp(
                  (idx === 0 && safeTarget ? (carrier.container.x + safeTarget.x) / 2 : receiverTargetX) -
                    this.getAnchorPosition(tacticalAnchors, player).x,
                  -22,
                  22
                )
            ),
            this.limitRoleStepFromAnchor(
              player,
              this.clampPitchY(
                this.getAnchorPosition(tacticalAnchors, player).y +
                  Phaser.Math.Clamp(
                    (idx === 0 && safeTarget ? (carrier.container.y + safeTarget.y) / 2 : receiverTargetY) -
                      this.getAnchorPosition(tacticalAnchors, player).y,
                    -14,
                    14
                  ) +
                  defendingRetreatDir * (4 + this.possessionProgress * 8 + idx * 3)
              ),
              this.getAnchorPosition(tacticalAnchors, player).y,
              player.role === "DEF" ? 10 : 8
            ),
            320
          )
        ),
      ]);

      await this.moveBallTo(receiverTargetX, receiverTargetY - 8, 320, 9);
      activeX = receiverTargetX;
      activeY = receiverTargetY;
      this.lastPossessor = effectiveReceiver;
      this.possessionProgress = clamp(0.08, 0.96, this.possessionProgress + 0.05 + space * 0.09 + supportRun * 0.04);
      this.possessionLane = this.classifyLane(receiverTargetX);
      commentary = `${attackingSide === "HOME" ? this.ui.homeName : this.ui.awayName} keep it moving`;
    } else if (action === "DRIBBLE") {
      const dribbleDistance = 12 + this.possessionProgress * 20 + this.roleAdvanceBoost(carrier.role) * 0.85 + space * 14;
      const dribbleTargetX = this.clampPitchX(
        carrierAnchor.x + this.pickSignedOffset(this.elapsed + 67, 16) + this.possessionLane * 6
      );
      const dribbleDesiredY = this.clampPitchY(
        carrierAnchor.y + forwardDir * dribbleDistance + (hashUnit(`${this.matchSeed}:${this.elapsed}:dribble:y`) * 2 - 1) * 5
      );
      const dribbleTargetY = this.limitRoleStepFromAnchor(
        carrier,
        dribbleDesiredY,
        carrierAnchor.y,
        carrier.role === "ATT" ? 16 : carrier.role === "MID" ? 12 : 10
      );

      await Promise.all([
        this.tweenPlayerTo(carrier, dribbleTargetX, dribbleTargetY, 340),
        this.moveBallTo(dribbleTargetX, dribbleTargetY - 8, 340, 6),
        ...supportMovers.map((player, idx) =>
          this.tweenPlayerTo(
            player,
            this.clampPitchX(
              Phaser.Math.Linear(
                this.getAnchorPosition(tacticalAnchors, player).x,
                supportTargets.get(player)?.x ?? this.getAnchorPosition(tacticalAnchors, player).x,
                0.56
              ) +
                this.pickSignedOffset(this.elapsed + idx + 71, 8) +
                this.possessionLane * 4
            ),
            this.limitRoleStepFromAnchor(
              player,
              this.clampPitchY(
                Phaser.Math.Linear(
                  this.getAnchorPosition(tacticalAnchors, player).y,
                  supportTargets.get(player)?.y ?? this.getAnchorPosition(tacticalAnchors, player).y,
                  0.55
                ) +
                  forwardDir * (6 + this.possessionProgress * 10 + this.roleAdvanceBoost(player.role) * 0.45) +
                  (hashUnit(`${this.matchSeed}:${this.elapsed}:dribble:support:${idx}`) * 2 - 1) * 4
              ),
              this.getAnchorPosition(tacticalAnchors, player).y,
              player.role === "ATT" ? 14 : player.role === "MID" ? 10 : 8
            ),
            320
          )
        ),
        ...pressureDefenders.map((player, idx) =>
          this.tweenPlayerTo(
            player,
            this.clampPitchX(
              this.getAnchorPosition(tacticalAnchors, player).x +
                Phaser.Math.Clamp(
                  (idx === 1 && supportPlan.progressiveOutlet
                    ? (supportTargets.get(supportPlan.progressiveOutlet)?.x ?? dribbleTargetX)
                    : dribbleTargetX) - this.getAnchorPosition(tacticalAnchors, player).x,
                  -24,
                  24
                )
            ),
            this.limitRoleStepFromAnchor(
              player,
              this.clampPitchY(
                this.getAnchorPosition(tacticalAnchors, player).y +
                  Phaser.Math.Clamp(
                    (idx === 1 && supportPlan.progressiveOutlet
                      ? (supportTargets.get(supportPlan.progressiveOutlet)?.y ?? dribbleTargetY)
                      : dribbleTargetY) - this.getAnchorPosition(tacticalAnchors, player).y,
                    -14,
                    14
                  ) +
                  defendingRetreatDir * (4 + idx * 3 + pressure * 6)
              ),
              this.getAnchorPosition(tacticalAnchors, player).y,
              player.role === "DEF" ? 10 : 8
            ),
            320
          )
        ),
      ]);

      activeX = dribbleTargetX;
      activeY = dribbleTargetY;
      this.lastPossessor = carrier;
      this.possessionProgress = clamp(0.08, 0.97, this.possessionProgress + 0.08 + space * 0.11 - pressure * 0.03);
      this.possessionLane = this.classifyLane(dribbleTargetX);
      commentary = `${attackingSide === "HOME" ? this.ui.homeName : this.ui.awayName} drive forward with it`;
    } else if (action === "THROUGH_BALL") {
      const carrierForwardAxis = this.toForwardAxis(attackingSide, carrier.container.y);
      const forwardReceiverOptions = receiverOptions.filter(
        (player) => this.toForwardAxis(attackingSide, player.container.y) >= carrierForwardAxis - 1
      );
      const runner =
        (progressiveReceiver !== carrier ? progressiveReceiver : null) ??
        forwardReceiverOptions.find((player) => player.role === "ATT") ??
        forwardReceiverOptions.find((player) => player.role === "MID") ??
        receiverOptions.find((player) => player.role === "ATT") ??
        receiver;
      const runnerAnchor = this.getAnchorPosition(tacticalAnchors, runner);
      const runnerPlanTarget = supportTargets.get(runner) ?? runnerAnchor;
      const laneHint =
        runnerAnchor.x > centerX + this.pitchWidth * 0.09 ? 1 : runnerAnchor.x < centerX - this.pitchWidth * 0.09 ? -1 : 0;
      const runTargetX = this.clampPitchX(
        Phaser.Math.Linear(runnerAnchor.x, runnerPlanTarget.x, 0.55) + this.pickSignedOffset(this.elapsed + 83, 15) + laneHint * 9
      );
      const runDesiredY = this.clampPitchY(
        Phaser.Math.Linear(runnerAnchor.y, runnerPlanTarget.y, 0.6) +
          forwardDir * (18 + this.possessionProgress * 22 + this.roleAdvanceBoost(runner.role) * 0.95 + supportRun * 10)
      );
      const runTargetY = this.limitRoleStepFromAnchor(
        runner,
        runDesiredY,
        runnerAnchor.y,
        runner.role === "ATT" ? 18 : 14
      );

      await Promise.all([
        this.tweenPlayerTo(
          carrier,
          this.clampPitchX(carrierAnchor.x + this.pickSignedOffset(this.elapsed + 89, 10)),
          this.limitRoleStepFromAnchor(
            carrier,
            this.clampPitchY(carrierAnchor.y + forwardDir * 6),
            carrierAnchor.y,
            carrier.role === "ATT" ? 10 : 8
          ),
          220
        ),
        this.tweenPlayerTo(runner, runTargetX, runTargetY, 320),
        ...supportMovers
          .filter((player) => player !== runner)
          .map((player, idx) =>
            this.tweenPlayerTo(
              player,
              this.clampPitchX(
                Phaser.Math.Linear(
                  this.getAnchorPosition(tacticalAnchors, player).x,
                  supportTargets.get(player)?.x ?? this.getAnchorPosition(tacticalAnchors, player).x,
                  0.54
                ) + this.pickSignedOffset(this.elapsed + idx + 219, 7)
              ),
              this.limitRoleStepFromAnchor(
                player,
                this.clampPitchY(
                  Phaser.Math.Linear(
                    this.getAnchorPosition(tacticalAnchors, player).y,
                    supportTargets.get(player)?.y ?? this.getAnchorPosition(tacticalAnchors, player).y,
                    0.56
                  ) + forwardDir * (4 + supportRun * 6)
                ),
                this.getAnchorPosition(tacticalAnchors, player).y,
                player.role === "ATT" ? 12 : 9
              ),
              300
            )
          ),
        ...pressureDefenders.map((player, idx) =>
          this.tweenPlayerTo(
            player,
            this.clampPitchX(
              this.getAnchorPosition(tacticalAnchors, player).x +
                Phaser.Math.Clamp(runTargetX - this.getAnchorPosition(tacticalAnchors, player).x, -26, 26)
            ),
            this.limitRoleStepFromAnchor(
              player,
              this.clampPitchY(
                this.getAnchorPosition(tacticalAnchors, player).y +
                  Phaser.Math.Clamp(runTargetY - this.getAnchorPosition(tacticalAnchors, player).y, -13, 13) +
                  defendingRetreatDir * (4 + idx * 4)
              ),
              this.getAnchorPosition(tacticalAnchors, player).y,
              player.role === "DEF" ? 10 : 8
            ),
            300
          )
        ),
      ]);

      await this.moveBallTo(runTargetX, runTargetY - 8, 310, 14);
      activeX = runTargetX;
      activeY = runTargetY;
      this.lastPossessor = runner;
      this.possessionProgress = clamp(0.1, 0.98, this.possessionProgress + 0.12 + supportRun * 0.08 - pressure * 0.03);
      this.possessionLane = this.classifyLane(runTargetX);
      commentary = `${attackingSide === "HOME" ? this.ui.homeName : this.ui.awayName} slip a through ball`;
    } else {
      const recycleOutlet = safetyReceiver;
      const recycleOutletAnchor = this.getAnchorPosition(tacticalAnchors, recycleOutlet);
      const recycleOutletTarget = supportTargets.get(recycleOutlet) ?? recycleOutletAnchor;
      const recycleTargetX = this.clampPitchX(
        Phaser.Math.Linear(recycleOutletAnchor.x, recycleOutletTarget.x, 0.62) + this.pickSignedOffset(this.elapsed + 97, 10)
      );
      const recycleDesiredY = this.clampPitchY(
        Phaser.Math.Linear(recycleOutletAnchor.y, recycleOutletTarget.y, 0.65) -
          forwardDir * (4 + pressure * 10) +
          (hashUnit(`${this.matchSeed}:${this.elapsed}:recycle:y`) * 2 - 1) * 3
      );
      const recycleTargetY = this.limitRoleStepFromAnchor(
        recycleOutlet,
        recycleDesiredY,
        recycleOutletAnchor.y,
        recycleOutlet.role === "ATT" ? 10 : 8
      );
      const supportWithoutRecycleOutlet = supportMovers.filter((player) => player !== recycleOutlet);

      await Promise.all([
        this.tweenPlayerTo(
          carrier,
          this.clampPitchX(carrierAnchor.x + this.pickSignedOffset(this.elapsed + 95, 8)),
          this.limitRoleStepFromAnchor(
            carrier,
            this.clampPitchY(carrierAnchor.y - forwardDir * (3 + pressure * 6)),
            carrierAnchor.y,
            carrier.role === "ATT" ? 9 : 7
          ),
          260
        ),
        this.tweenPlayerTo(recycleOutlet, recycleTargetX, recycleTargetY, 300),
        this.moveBallTo(recycleTargetX, recycleTargetY - 8, 300, 5),
        ...supportWithoutRecycleOutlet.map((player, idx) =>
          this.tweenPlayerTo(
            player,
            this.clampPitchX(
              (supportTargets.get(player)?.x ?? this.getAnchorPosition(tacticalAnchors, player).x) +
                this.pickSignedOffset(this.elapsed + idx + 101, 8)
            ),
            this.limitRoleStepFromAnchor(
              player,
              this.clampPitchY(
                (supportTargets.get(player)?.y ?? this.getAnchorPosition(tacticalAnchors, player).y) + forwardDir * (2 + idx * 3)
              ),
              this.getAnchorPosition(tacticalAnchors, player).y,
              player.role === "ATT" ? 10 : 8
            ),
            300
          )
        ),
      ]);

      activeX = recycleTargetX;
      activeY = recycleTargetY;
      this.lastPossessor = recycleOutlet;
      this.possessionProgress = clamp(0.08, 0.94, this.possessionProgress - 0.04 + space * 0.03);
      this.possessionLane =
        hashUnit(`${this.matchSeed}:${this.elapsed}:ambient:recycle-lane`) < 0.5
          ? this.possessionLane === 0
            ? hashUnit(`${this.matchSeed}:${this.elapsed}:ambient:recycle-lane-side`) < 0.5
              ? -1
              : 1
            : 0
          : this.possessionLane;
      commentary = `${attackingSide === "HOME" ? this.ui.homeName : this.ui.awayName} recycle and reset`;
    }

    const closestDefender = [...pressureDefenders].sort(
      (a, b) =>
        Phaser.Math.Distance.Between(a.container.x, a.container.y, activeX, activeY) -
        Phaser.Math.Distance.Between(b.container.x, b.container.y, activeX, activeY)
    )[0];

    if (closestDefender) {
      const pressureDistance = Phaser.Math.Distance.Between(
        closestDefender.container.x,
        closestDefender.container.y,
        activeX,
        activeY
      );
      const pressureFactor = clamp01((130 - pressureDistance) / 130);
      const stealChance = clamp01(0.08 + pressureFactor * 0.46 + this.possessionProgress * 0.12 + pressure * 0.12);
      const stealRoll = hashUnit(`${this.matchSeed}:${this.elapsed}:ambient:steal`);

      if (stealRoll < stealChance) {
        const winX = this.clampPitchX(closestDefender.container.x + this.pickSignedOffset(this.elapsed + 55, 10));
        const winY = this.clampPitchY(
          closestDefender.container.y +
            this.getForwardDirection(defendingSide) * (6 + this.possessionProgress * 8) +
            (hashUnit(`${this.matchSeed}:${this.elapsed}:steal:y`) * 2 - 1) * 4
        );

        await Promise.all([
          this.tweenPlayerTo(closestDefender, winX, winY, 260),
          this.moveBallTo(winX, winY - 8, 240, 8),
        ]);

        this.possessionSide = defendingSide;
        this.possessionProgress = clamp(0.1, 0.44, 1 - this.possessionProgress + 0.04);
        this.possessionLane = this.classifyLane(winX);
        this.lastPossessor = closestDefender;
        const defensiveName = defendingSide === "HOME" ? this.ui.homeName : this.ui.awayName;
        this.setCommentary(`${defensiveName} press and win it back`);
        return;
      }
    }

    const sideName = attackingSide === "HOME" ? this.ui.homeName : this.ui.awayName;
    if (this.possessionProgress >= 0.8) {
      this.setCommentary(`${sideName} push into the final third`);
    } else if (commentary) {
      this.setCommentary(commentary);
    } else if (hashUnit(`${this.matchSeed}:${this.elapsed}:ambient:commentary`) < 0.62) {
      this.setCommentary(`${sideName} move the ball and probe for space`);
    }
  }

  private startChanceEvent(event: MatchChanceEvent, eventIndex: number) {
    this.resolvingChance = true;
    const chanceType = pickChanceType(this.matchSeed, eventIndex, event.quality);
    const display = chanceTypeDisplayName(chanceType);
    const sideName = event.attackingSide === "HOME" ? this.ui.homeName : this.ui.awayName;

    this.setCommentary(`${display}: ${sideName} chance`);

    void this.resolveChanceEvent(event, eventIndex, chanceType);
  }

  private async resolveChanceEvent(event: MatchChanceEvent, eventIndex: number, chanceType: ChanceType) {
    try {
      const resolvedOutcome = resolveChanceOutcome({
        seed: this.matchSeed,
        event,
        eventIndex,
        chanceType,
        teams: this.teams,
      });

      const resolvedEvent = { ...event, scored: resolvedOutcome.scored };
      this.resolvedEvents.push(resolvedEvent);
      this.chanceOutcomes.push({
        eventIndex,
        second: event.second,
        attackingSide: event.attackingSide,
        chanceType,
        tapQuality: resolvedOutcome.executionQuality,
        tapped: false,
        baseQuality: event.quality,
        scoreProbability: resolvedOutcome.scoreProbability,
        scored: resolvedOutcome.scored,
      });

      await this.animateChanceOnPitch(event, eventIndex, resolvedOutcome.scored, chanceType);
      this.applyEventOutcome(resolvedEvent, chanceType, resolvedOutcome.executionQuality);
    } catch {
      const fallback = { ...event };
      this.resolvedEvents.push(fallback);
      this.applyEventOutcome(fallback, chanceType, "POOR");
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

    if (this.getForwardDirection(attackingSide) < 0) {
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
    const attacksUp = this.getForwardDirection(attackingSide) < 0;
    const goalY = attacksUp ? 136 : height - 286;
    const keeperDiveY = attacksUp ? 140 : height - 270;

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
    const attackDir = this.getForwardDirection(attackingSide);

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
    const goalLineOffset = Math.max(8, Math.round(this.pitchHeight * GOAL_LINE_BALL_OFFSET_RATIO));
    const goalY =
      attackDir < 0
        ? this.pitchTop + goalLineOffset
        : this.pitchTop + this.pitchHeight - goalLineOffset;

    if (scored) {
      await Promise.all([
        this.moveBallTo(shotX, goalY, 540, 26),
        this.tweenPlayerTo(
          goalkeeper,
          goalkeeper.baseX + Phaser.Math.Clamp(shotX - goalkeeper.baseX, -48, 48),
          goalkeeper.baseY + (attackDir < 0 ? 8 : -8),
          380
        ),
      ]);
    } else {
      const saveX = goalkeeper.baseX + Phaser.Math.Clamp(shotX - goalkeeper.baseX, -42, 42);
      const saveY = goalkeeper.baseY + (attackDir < 0 ? 12 : -12);

      await Promise.all([
        this.tweenPlayerTo(goalkeeper, saveX, saveY, 360),
        this.moveBallTo(saveX, saveY - 10, 440, 22),
      ]);

      await this.moveBallTo(saveX + this.pickSignedOffset(eventIndex + 15, 14), saveY + (attackDir < 0 ? 20 : -20), 230, 7);
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

  private pickSupportPair(side: Side, attacker: PitchPlayer, eventIndex: number): PitchPlayer[] {
    const options = this.getSidePlayers(side)
      .filter((player) => player.role !== "GK" && player !== attacker)
      .sort(
        (a, b) =>
          Phaser.Math.Distance.Between(a.baseX, a.baseY, attacker.baseX, attacker.baseY) -
          Phaser.Math.Distance.Between(b.baseX, b.baseY, attacker.baseX, attacker.baseY)
      );

    if (!options.length) {
      return [];
    }

    const maxSupport = Math.min(options.length, 2);
    const firstIndex = Math.floor(hashUnit(`${this.matchSeed}:${eventIndex}:${side}:support:1`) * maxSupport);
    const first = options[firstIndex] ?? options[0];
    const second = options.find((player) => player !== first);
    return second ? [first, second] : [first];
  }

  private getSupportZoneProfile(progress: number): SupportZoneProfile {
    if (progress < 0.34) {
      return {
        safeDistance: 82,
        progressiveDistance: 122,
        safeForwardBias: -6,
        progressiveForwardBias: 10,
      };
    }

    if (progress < 0.68) {
      return {
        safeDistance: 76,
        progressiveDistance: 114,
        safeForwardBias: -2,
        progressiveForwardBias: 15,
      };
    }

    return {
      safeDistance: 68,
      progressiveDistance: 100,
      safeForwardBias: 0,
      progressiveForwardBias: 20,
    };
  }

  private buildSupportShapePlan(
    attackingSide: Side,
    defendingSide: Side,
    carrier: PitchPlayer,
    tacticalAnchors: Map<PitchPlayer, TacticalAnchor>,
    pressure: number,
    progress: number,
    eventIndex: number
  ): SupportShapePlan {
    const candidatesRaw = this.getSidePlayers(attackingSide).filter((player) => player.role !== "GK" && player !== carrier);
    if (!candidatesRaw.length) {
      return {
        safeOutlet: null,
        progressiveOutlet: null,
        widthOutlet: null,
        fallbackReceiver: carrier,
        supportTargets: new Map<PitchPlayer, TacticalAnchor>(),
        shapeScore: 0,
        progressionThreat: 0,
      };
    }

    const defenders = this.getSidePlayers(defendingSide).filter((player) => player.role !== "GK");
    const zoneProfile = this.getSupportZoneProfile(progress);
    const carrierX = carrier.container.x;
    const carrierY = carrier.container.y;
    const centerX = this.pitchLeft + this.pitchWidth / 2;
    const carrierForwardAxis = this.toForwardAxis(attackingSide, carrierY);
    const forwardDir = this.getForwardDirection(attackingSide);

    type BaseCandidate = {
      player: PitchPlayer;
      anchor: TacticalAnchor;
      distance: number;
      forwardDelta: number;
      forwardAxis: number;
      angleDeg: number;
      laneQuality: number;
      pressure: number;
    };

    const baseCandidates: BaseCandidate[] = candidatesRaw.map((player) => {
      const anchor = this.getAnchorPosition(tacticalAnchors, player);
      const distance = Phaser.Math.Distance.Between(carrierX, carrierY, anchor.x, anchor.y);
      const forwardAxis = this.toForwardAxis(attackingSide, anchor.y);
      const forwardDelta = forwardAxis - carrierForwardAxis;
      const angleDeg = Phaser.Math.RadToDeg(Math.atan2(anchor.y - carrierY, anchor.x - carrierX));
      const laneQuality = this.scorePassLaneQuality(carrierX, carrierY, anchor.x, anchor.y, defenders);
      const pointPressure = this.scoreDefensivePressureAt(anchor.x, anchor.y, defenders);

      return {
        player,
        anchor,
        distance,
        forwardDelta,
        forwardAxis,
        angleDeg,
        laneQuality,
        pressure: pointPressure,
      };
    });

    const candidates: SupportCandidate[] = baseCandidates.map((candidate) => {
      let thirdManValue = 0;
      for (const other of baseCandidates) {
        if (other.player === candidate.player) {
          continue;
        }

        const forwardGain = other.forwardAxis - candidate.forwardAxis;
        if (forwardGain < 5) {
          continue;
        }

        const linkDistance = Phaser.Math.Distance.Between(candidate.anchor.x, candidate.anchor.y, other.anchor.x, other.anchor.y);
        if (linkDistance < 36 || linkDistance > 220) {
          continue;
        }

        const linkLaneQuality = this.scorePassLaneQuality(
          candidate.anchor.x,
          candidate.anchor.y,
          other.anchor.x,
          other.anchor.y,
          defenders
        );
        const linkValue = linkLaneQuality * 0.68 + clamp01(forwardGain / 42) * 0.32;
        thirdManValue = Math.max(thirdManValue, linkValue);
      }

      const lateralDistance = Math.abs(candidate.anchor.x - carrierX);
      const safeDistanceFit =
        1 - Math.abs(candidate.distance - zoneProfile.safeDistance) / Math.max(42, zoneProfile.safeDistance * 0.9);
      const progressiveDistanceFit =
        1 - Math.abs(candidate.distance - zoneProfile.progressiveDistance) / Math.max(56, zoneProfile.progressiveDistance * 0.95);
      const safeForwardFit = 1 - Math.abs(candidate.forwardDelta - zoneProfile.safeForwardBias) / 26;
      const progressiveForwardFit = (candidate.forwardDelta - zoneProfile.progressiveForwardBias + 22) / 44;
      const diagonalValue = (lateralDistance - 8) / (this.pitchWidth * 0.2);
      const widthValue = Math.abs(candidate.anchor.x - centerX) / (this.pitchWidth * 0.36);
      const inlinePenalty = (12 - lateralDistance) / 12;

      const safeScore =
        candidate.laneQuality * 36 +
        clamp01(safeDistanceFit) * 20 +
        clamp01(safeForwardFit) * 14 +
        clamp01(diagonalValue) * 8 +
        this.supportRoleBias(candidate.player.role, "SAFE") -
        candidate.pressure * 24 -
        clamp01(inlinePenalty) * 6;

      const progressiveScore =
        candidate.laneQuality * 32 +
        clamp01(progressiveDistanceFit) * 18 +
        clamp01(progressiveForwardFit) * 24 +
        clamp01(diagonalValue) * 12 +
        thirdManValue * 16 +
        this.supportRoleBias(candidate.player.role, "PROGRESSIVE") -
        candidate.pressure * 20;

      const widthScore =
        candidate.laneQuality * 20 +
        clamp01(widthValue) * 24 +
        clamp01(diagonalValue) * 8 +
        this.supportRoleBias(candidate.player.role, "WIDTH") -
        candidate.pressure * 16;

      return {
        ...candidate,
        thirdManValue,
        safeScore,
        progressiveScore,
        widthScore,
      };
    });

    const safePool = [...candidates].sort((a, b) => b.safeScore - a.safeScore).slice(0, 4);
    const progressivePool = [...candidates].sort((a, b) => b.progressiveScore - a.progressiveScore).slice(0, 4);

    let bestPair: { safe: SupportCandidate; progressive: SupportCandidate; score: number } | null = null;
    for (const safe of safePool) {
      for (const progressive of progressivePool) {
        if (safe.player === progressive.player) {
          continue;
        }

        const angleSeparation = this.angleSeparationDegrees(safe.angleDeg, progressive.angleDeg);
        const angleScore = clamp01((angleSeparation - 20) / 75);
        const depthSpread = Math.abs(progressive.forwardDelta - safe.forwardDelta);
        const depthScore = clamp01((depthSpread - 6) / 30);
        const supportSpacing = Phaser.Math.Distance.Between(safe.anchor.x, safe.anchor.y, progressive.anchor.x, progressive.anchor.y);
        const crowdingPenalty = clamp01((70 - supportSpacing) / 70);
        const depthOrderPenalty = safe.forwardDelta > progressive.forwardDelta - 2 ? 0.26 : 0;
        const score =
          safe.safeScore +
          progressive.progressiveScore +
          angleScore * 18 +
          depthScore * 14 -
          crowdingPenalty * 24 -
          depthOrderPenalty * 20;

        if (!bestPair || score > bestPair.score) {
          bestPair = { safe, progressive, score };
        }
      }
    }

    let safeOutlet = bestPair?.safe.player ?? safePool[0]?.player ?? null;
    let progressiveOutlet =
      bestPair?.progressive.player ??
      progressivePool.find((candidate) => candidate.player !== safeOutlet)?.player ??
      (safeOutlet ? null : progressivePool[0]?.player ?? null);

    if (!safeOutlet && progressiveOutlet) {
      const fallbackSafe = candidates.find((candidate) => candidate.player !== progressiveOutlet);
      if (fallbackSafe) {
        safeOutlet = fallbackSafe.player;
      }
    }
    if (safeOutlet && progressiveOutlet && safeOutlet === progressiveOutlet) {
      progressiveOutlet = null;
    }

    const widthCandidate = [...candidates]
      .filter((candidate) => candidate.player !== safeOutlet && candidate.player !== progressiveOutlet)
      .sort((a, b) => b.widthScore - a.widthScore)[0];
    const widthOutlet = widthCandidate && widthCandidate.widthScore >= 20 ? widthCandidate.player : null;

    const fallbackReceiver = progressiveOutlet ?? safeOutlet ?? candidates[0].player;
    const candidateByPlayer = new Map<PitchPlayer, SupportCandidate>(candidates.map((candidate) => [candidate.player, candidate]));
    const supportTargets = new Map<PitchPlayer, TacticalAnchor>();
    const assignTarget = (role: SupportRole, player: PitchPlayer | null) => {
      if (!player) {
        return;
      }

      const candidate = candidateByPlayer.get(player);
      if (!candidate) {
        return;
      }

      supportTargets.set(
        player,
        this.resolveSupportRoleTarget(role, player, carrier, candidate.anchor, forwardDir, progress, eventIndex)
      );
    };

    assignTarget("SAFE", safeOutlet);
    assignTarget("PROGRESSIVE", progressiveOutlet);
    assignTarget("WIDTH", widthOutlet);

    const pairRawScore =
      bestPair?.score ?? (safePool[0]?.safeScore ?? 0) + (progressivePool[0]?.progressiveScore ?? 0);
    const pairQuality = clamp01((pairRawScore + 28) / 150);
    const coverage = (safeOutlet ? 0.45 : 0) + (progressiveOutlet ? 0.42 : 0) + (widthOutlet ? 0.13 : 0);
    const shapeScore = clamp01(pairQuality * 0.68 + coverage * 0.32 - pressure * 0.08);

    const progressiveMeta = progressiveOutlet ? candidateByPlayer.get(progressiveOutlet) : undefined;
    const progressionThreat = clamp01(
      (progressiveOutlet ? 0.5 : 0.15) +
        (progressiveMeta
          ? progressiveMeta.thirdManValue * 0.38 + clamp01((progressiveMeta.forwardDelta + 6) / 40) * 0.26
          : 0)
    );

    return {
      safeOutlet,
      progressiveOutlet,
      widthOutlet,
      fallbackReceiver,
      supportTargets,
      shapeScore,
      progressionThreat,
    };
  }

  private resolveSupportRoleTarget(
    role: SupportRole,
    player: PitchPlayer,
    carrier: PitchPlayer,
    anchor: TacticalAnchor,
    forwardDir: number,
    progress: number,
    eventIndex: number
  ): TacticalAnchor {
    const centerX = this.pitchLeft + this.pitchWidth / 2;
    const anchorDiffX = anchor.x - carrier.container.x;
    const flankSignFromAnchor = anchorDiffX === 0 ? (anchor.x >= centerX ? 1 : -1) : Math.sign(anchorDiffX);
    const flankSign = flankSignFromAnchor === 0 ? 1 : flankSignFromAnchor;

    const lateralBase =
      role === "SAFE"
        ? 26 + this.pitchWidth * 0.014
        : role === "PROGRESSIVE"
          ? 34 + this.pitchWidth * 0.019
          : 46 + this.pitchWidth * 0.022;
    const forwardDepth =
      role === "SAFE"
        ? -(4 + progress * 7)
        : role === "PROGRESSIVE"
          ? 16 + progress * 14
          : 4 + progress * 8;
    const blend = role === "SAFE" ? 0.62 : role === "PROGRESSIVE" ? 0.58 : 0.54;
    const maxStep = role === "PROGRESSIVE" ? (player.role === "ATT" ? 18 : 14) : player.role === "ATT" ? 12 : 10;

    const relativeX = carrier.container.x + flankSign * lateralBase + this.possessionLane * (role === "WIDTH" ? 8 : 4);
    const relativeY = carrier.container.y + forwardDir * forwardDepth;
    const jitterX = this.pickSignedOffset(
      eventIndex + Math.round(player.baseX) + (role === "SAFE" ? 213 : role === "PROGRESSIVE" ? 227 : 239),
      role === "WIDTH" ? 8 : 6
    );
    const jitterY = this.pickSignedOffset(
      eventIndex + Math.round(player.baseY) + (role === "SAFE" ? 241 : role === "PROGRESSIVE" ? 257 : 269),
      4
    );

    const targetX = this.clampPitchX(Phaser.Math.Linear(anchor.x, relativeX, blend) + jitterX);
    const desiredY = this.clampPitchY(Phaser.Math.Linear(anchor.y, relativeY, blend) + jitterY);
    const targetY = this.limitRoleStepFromAnchor(player, desiredY, anchor.y, maxStep);
    return { x: targetX, y: targetY };
  }

  private supportRoleBias(role: Role, supportRole: SupportRole): number {
    if (supportRole === "SAFE") {
      if (role === "MID") return 11;
      if (role === "DEF") return 8;
      if (role === "ATT") return 4;
      return 0;
    }

    if (supportRole === "PROGRESSIVE") {
      if (role === "ATT") return 12;
      if (role === "MID") return 10;
      if (role === "DEF") return 3;
      return 0;
    }

    if (role === "MID") return 8;
    if (role === "DEF") return 7;
    if (role === "ATT") return 5;
    return 0;
  }

  private scorePassLaneQuality(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    defenders: PitchPlayer[]
  ): number {
    const dx = endX - startX;
    const dy = endY - startY;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= 1 || !defenders.length) {
      return 1;
    }

    const segmentLength = Math.sqrt(lengthSq);
    const baseCorridor = clamp(16, 34, segmentLength * 0.12);
    let blocking = 0;

    for (const defender of defenders) {
      const relX = defender.container.x - startX;
      const relY = defender.container.y - startY;
      const t = clamp01((relX * dx + relY * dy) / lengthSq);
      const nearestX = startX + dx * t;
      const nearestY = startY + dy * t;
      const nearestDistance = Phaser.Math.Distance.Between(defender.container.x, defender.container.y, nearestX, nearestY);
      const centerLaneWeight = 1 - Math.abs(0.5 - t) * 2;
      const corridor = baseCorridor + centerLaneWeight * 8;

      if (nearestDistance < corridor) {
        const influence = (corridor - nearestDistance) / corridor;
        blocking += influence * (0.55 + centerLaneWeight * 0.45);
      }
    }

    return clamp01(1 - blocking / Math.max(1, defenders.length * 0.92));
  }

  private scoreDefensivePressureAt(x: number, y: number, defenders: PitchPlayer[]): number {
    if (!defenders.length) {
      return 0;
    }

    const distances = defenders
      .map((defender) => Phaser.Math.Distance.Between(defender.container.x, defender.container.y, x, y))
      .sort((a, b) => a - b);
    const nearest = distances.slice(0, 2);
    const avgDistance = nearest.reduce((sum, value) => sum + value, 0) / nearest.length;
    return clamp01((126 - avgDistance) / 126);
  }

  private angleSeparationDegrees(a: number, b: number): number {
    const raw = Math.abs(a - b) % 360;
    return raw > 180 ? 360 - raw : raw;
  }

  private uniquePitchPlayers(players: Array<PitchPlayer | null | undefined>): PitchPlayer[] {
    const seen = new Set<PitchPlayer>();
    const ordered: PitchPlayer[] = [];
    for (const player of players) {
      if (!player || seen.has(player)) {
        continue;
      }
      seen.add(player);
      ordered.push(player);
    }
    return ordered;
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

  private classifyLane(x: number): Lane {
    const centerX = this.pitchLeft + this.pitchWidth / 2;
    const laneThreshold = this.pitchWidth * 0.16;
    if (x < centerX - laneThreshold) {
      return -1;
    }
    if (x > centerX + laneThreshold) {
      return 1;
    }
    return 0;
  }

  private sideAttacksUp(side: Side): boolean {
    const homeAttacksUp = !this.sideSwapApplied;
    return side === "HOME" ? homeAttacksUp : !homeAttacksUp;
  }

  private applyHalfTimeSideSwap() {
    if (this.sideSwapApplied) {
      return;
    }

    this.sideSwapApplied = true;
    const midY = this.pitchTop + this.pitchHeight / 2;
    const players = [...this.homePlayers, ...this.awayPlayers];
    for (const player of players) {
      player.baseY = midY - (player.baseY - midY);
      const mirroredY = midY - (player.container.y - midY);
      player.container.y = mirroredY;
      player.container.setDepth(500 + mirroredY);
    }

    const mirroredBallY = midY - (this.ball.y - midY);
    const mirroredShadowY = midY - (this.ballShadow.y - midY);
    this.ball.setY(mirroredBallY);
    this.ball.setDepth(800 + mirroredBallY);
    this.ballShadow.setY(mirroredShadowY);
    this.ballShadow.setDepth(700 + mirroredShadowY);
  }

  private getForwardDirection(side: Side): number {
    return this.sideAttacksUp(side) ? -1 : 1;
  }

  private toForwardAxis(side: Side, y: number): number {
    const bottom = this.pitchTop + this.pitchHeight;
    return this.sideAttacksUp(side) ? bottom - y : y - this.pitchTop;
  }

  private fromForwardAxis(side: Side, axis: number): number {
    const bottom = this.pitchTop + this.pitchHeight;
    return this.sideAttacksUp(side) ? bottom - axis : this.pitchTop + axis;
  }

  private averageRoleAxis(side: Side, role: Role, perspective: Side, fallback: number): number {
    const players = this.getSidePlayers(side).filter((player) => player.role === role);
    if (!players.length) {
      return fallback;
    }

    const avgY = players.reduce((sum, player) => sum + player.container.y, 0) / players.length;
    return this.toForwardAxis(perspective, avgY);
  }

  private averageRoleBaseAxis(side: Side, role: Role, perspective: Side, fallback: number): number {
    const players = this.getSidePlayers(side).filter((player) => player.role === role);
    if (!players.length) {
      return fallback;
    }

    const avgY = players.reduce((sum, player) => sum + player.baseY, 0) / players.length;
    return this.toForwardAxis(perspective, avgY);
  }

  private roleDepthOffset(player: PitchPlayer, amplitude: number): number {
    const peers = this.getSidePlayers(player.side)
      .filter((candidate) => candidate.role === player.role)
      .sort((a, b) => a.baseX - b.baseX);
    if (peers.length <= 1) {
      return 0;
    }

    const center = (peers.length - 1) / 2;
    const idx = peers.indexOf(player);
    if (idx < 0) {
      return 0;
    }

    return (idx - center) * amplitude;
  }

  private buildAmbientShapeTargets(attackingSide: Side, defendingSide: Side): Map<PitchPlayer, TacticalAnchor> {
    const targets = new Map<PitchPlayer, TacticalAnchor>();
    const halfAxis = this.pitchHeight * 0.5;
    const progress = this.possessionProgress;
    const laneShift = this.possessionLane * this.pitchWidth;
    const axisUnit = this.pitchHeight;

    const oppDefBaseForAttack = this.averageRoleBaseAxis(defendingSide, "DEF", attackingSide, axisUnit * 0.78);
    const oppMidBaseForAttack = this.averageRoleBaseAxis(defendingSide, "MID", attackingSide, axisUnit * 0.64);
    const attackingMidUpper = Math.min(axisUnit * 0.68, oppMidBaseForAttack - axisUnit * 0.02);

    const attackingDefAxis = clamp(axisUnit * 0.26, axisUnit * 0.43, axisUnit * (0.31 + progress * 0.1));
    const attackingMidAxis = clamp(axisUnit * 0.5, attackingMidUpper, axisUnit * (0.54 + progress * 0.12));
    const attackingAttUpper = Math.min(axisUnit * 0.86, oppDefBaseForAttack - axisUnit * 0.02);
    const attackingAttLower = attackingMidAxis + axisUnit * 0.12;
    const attackingAttAxis = clampOrdered(attackingAttLower, attackingAttUpper, axisUnit * (0.72 + progress * 0.12));

    const attackingMidBaseFromDefView = this.averageRoleBaseAxis(attackingSide, "MID", defendingSide, axisUnit * 0.64);
    const defendingDefAxis = clamp(axisUnit * 0.09, axisUnit * 0.28, axisUnit * (0.23 - progress * 0.1));
    const defendingMidAxis = clamp(defendingDefAxis + axisUnit * 0.12, axisUnit * 0.48, axisUnit * (0.43 - progress * 0.07));
    const defendingAttLower = defendingDefAxis + axisUnit * 0.2;
    const defendingAttUpper = Math.min(axisUnit * 0.58, attackingMidBaseFromDefView - axisUnit * 0.02);
    const defendingAttAxis = clampOrdered(defendingAttLower, defendingAttUpper, axisUnit * (0.46 - progress * 0.03));

    const allPlayers = [...this.homePlayers, ...this.awayPlayers];
    for (const player of allPlayers) {
      const isAttacking = player.side === attackingSide;
      const roleForwardOffset = this.roleDepthOffset(
        player,
        player.role === "DEF" ? axisUnit * 0.006 : player.role === "MID" ? axisUnit * 0.005 : player.role === "ATT" ? axisUnit * 0.004 : axisUnit * 0.003
      );
      const baseAxis = this.toForwardAxis(player.side, player.baseY);
      const laneWeight = isAttacking
        ? player.role === "ATT"
          ? 0.09
          : player.role === "MID"
            ? 0.065
            : 0.032
        : player.role === "DEF"
          ? 0.08
          : player.role === "MID"
            ? 0.06
            : 0.045;
      const jitterX = this.pickSignedOffset(this.elapsed + Math.round(player.baseX) + player.baseY, 4);

      let axis = baseAxis;
      if (player.role === "GK") {
        axis = isAttacking ? baseAxis + progress * 2.5 : baseAxis - progress * 1.5;
        axis = clamp(axisUnit * 0.06, halfAxis - axisUnit * 0.14, axis);
      } else if (isAttacking) {
        if (player.role === "DEF") {
          axis = clampOrdered(attackingDefAxis - axisUnit * 0.03, attackingMidAxis - axisUnit * 0.06, attackingDefAxis + roleForwardOffset);
        } else if (player.role === "MID") {
          axis = clampOrdered(halfAxis + axisUnit * 0.005, attackingMidUpper, attackingMidAxis + roleForwardOffset);
        } else {
          axis = clampOrdered(attackingMidAxis + axisUnit * 0.04, attackingAttUpper, attackingAttAxis + roleForwardOffset);
        }
      } else {
        if (player.role === "DEF") {
          axis = clampOrdered(axisUnit * 0.07, halfAxis - axisUnit * 0.12, defendingDefAxis + roleForwardOffset);
        } else if (player.role === "MID") {
          axis = clampOrdered(defendingDefAxis + axisUnit * 0.08, halfAxis - axisUnit * 0.03, defendingMidAxis + roleForwardOffset);
        } else {
          axis = clampOrdered(defendingDefAxis + axisUnit * 0.11, defendingAttUpper, defendingAttAxis + roleForwardOffset);
        }
      }

      const targetX = this.clampPitchX(player.baseX + laneShift * laneWeight + jitterX);
      const targetY = this.clampPitchY(this.fromForwardAxis(player.side, axis));
      targets.set(player, { x: targetX, y: targetY });
    }

    return targets;
  }

  private async alignPlayersToAmbientShape(targets: Map<PitchPlayer, TacticalAnchor>, duration: number): Promise<void> {
    const movers = [...this.homePlayers, ...this.awayPlayers];
    await Promise.all(
      movers.map((player) => {
        const target = targets.get(player);
        if (!target) {
          return Promise.resolve();
        }
        return this.tweenPlayerTo(player, target.x, target.y, duration);
      })
    );
  }

  private getAnchorPosition(targets: Map<PitchPlayer, TacticalAnchor>, player: PitchPlayer): TacticalAnchor {
    return targets.get(player) ?? { x: player.container.x, y: player.container.y };
  }

  private limitRoleStepFromAnchor(player: PitchPlayer, targetY: number, anchorY: number, maxStep: number): number {
    const direction = this.getForwardDirection(player.side);
    const limited = anchorY + Phaser.Math.Clamp(targetY - anchorY, -maxStep, maxStep);
    const forwardOnly = player.role === "ATT" || player.role === "MID";
    if (!forwardOnly) {
      return this.clampPitchY(limited);
    }

    const delta = limited - anchorY;
    if (delta * direction < 0) {
      return this.clampPitchY(anchorY);
    }
    return this.clampPitchY(limited);
  }

  private roleAdvanceBoost(role: Role): number {
    if (role === "ATT") return 20;
    if (role === "MID") return 12;
    if (role === "DEF") return 5;
    return 0;
  }

  private clampPitchX(value: number): number {
    const edgePad = Math.max(18, this.pitchWidth * PLAYER_EDGE_X_PADDING_RATIO);
    return clamp(this.pitchLeft + edgePad, this.pitchLeft + this.pitchWidth - edgePad, value);
  }

  private clampPitchY(value: number): number {
    const edgePad = Math.max(22, this.pitchHeight * PLAYER_EDGE_Y_PADDING_RATIO);
    return clamp(this.pitchTop + edgePad, this.pitchTop + this.pitchHeight - edgePad, value);
  }

  private pickShotTargetX(eventIndex: number, side: Side): number {
    const center = this.pitchLeft + this.pitchWidth / 2;
    const spread = this.pitchWidth * SHOT_TARGET_SPREAD_RATIO;
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

  private waitMs(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(Math.max(0, durationMs), () => resolve());
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

  private applyEventOutcome(event: MatchChanceEvent, chanceType: ChanceType, executionQuality: TapQuality) {
    const sideName = event.attackingSide === "HOME" ? this.ui.homeName : this.ui.awayName;

    if (event.scored) {
      if (event.attackingSide === "HOME") {
        this.homeGoals += 1;
      } else {
        this.awayGoals += 1;
      }

      this.refreshScoreHud();
      this.setCommentary(
        `${chanceTypeDisplayName(chanceType)}: GOAL for ${sideName} (${executionQuality})`
      );
      this.flashGoalBanner(sideName);
      return;
    }

    this.setCommentary(
      `${chanceTypeDisplayName(chanceType)}: ${sideName} denied (${executionQuality})`
    );
  }

  private flashGoalBanner(sideName: string) {
    const bannerX = this.pitchLeft + this.pitchWidth / 2;
    const bannerY = this.pitchTop + this.pitchHeight / 2;
    const bannerHorizontalMargin = Math.max(8, Math.round(this.pitchWidth * 0.015));
    const bannerWidth = Math.max(220, this.pitchWidth - bannerHorizontalMargin * 2);
    const bannerHeight = Math.round(clamp(40, 48, this.pitchHeight * 0.028));
    const goalLabel = `GOAL - ${sideName}`;
    const fontSize = Math.round(Phaser.Math.Clamp(34 - Math.max(0, goalLabel.length - 18), 21, 32));

    const banner = this.add
      .rectangle(bannerX, bannerY, bannerWidth, bannerHeight, 0x8d2c24, 0.95)
      .setStrokeStyle(2, 0xf8fafc, 1);
    const text = this.add
      .text(bannerX, bannerY, goalLabel, {
        fontFamily: "Barlow Condensed, Arial",
        fontSize: `${fontSize}px`,
        color: "#f8fafc",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: bannerWidth - 20, useAdvancedWrap: true },
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

    const displayClock = toDisplayClockState(Math.min(finalResult.durationSeconds, MATCH_DURATION_SECONDS));
    this.timerText.setText(displayClock.clockText);
    this.refreshScoreHud(finalResult.homeGoals, finalResult.awayGoals);
    void this.runFullTimeSequence(finalResult);
  }

  private async runFullTimeSequence(finalResult: MatchRuntimeResult) {
    if (this.fullTimeSequenceActive) {
      return;
    }

    this.fullTimeSequenceActive = true;
    this.setBallVisible(false);

    try {
      const homeName = this.ui.homeName;
      const awayName = this.ui.awayName;
      const homeWon = finalResult.homeGoals > finalResult.awayGoals;
      const awayWon = finalResult.awayGoals > finalResult.homeGoals;

      if (homeWon || awayWon) {
        const winningSide: Side = homeWon ? "HOME" : "AWAY";
        const losingSide: Side = winningSide === "HOME" ? "AWAY" : "HOME";
        const winnerName = winningSide === "HOME" ? homeName : awayName;
        const loserName = losingSide === "HOME" ? homeName : awayName;

        this.setCommentary(`FULL-TIME: ${loserName} WALK OFF`);
        await this.walkTeamOffPitchLeft(losingSide, TEAM_WALK_DURATION_MS);

        this.setCommentary(`FULL-TIME: ${winnerName} CELEBRATE`);
        await this.celebrateWinningTeam(winningSide);
      } else {
        this.setCommentary("FULL-TIME: DRAW - BOTH TEAMS WALK OFF");
        await this.walkBothTeamsOffPitchLeft(TEAM_WALK_DURATION_MS);
      }
    } finally {
      this.fullTimeSequenceActive = false;
      this.onFinished(finalResult);
    }
  }

  private async celebrateWinningTeam(side: Side): Promise<void> {
    const winners = this.getSidePlayers(side);
    await Promise.all(
      winners.map(
        (player, idx) =>
          new Promise<void>((resolve) => {
            const startY = player.container.y;
            this.tweens.add({
              targets: player.container,
              y: startY - 9,
              duration: 150,
              delay: idx * 26,
              yoyo: true,
              repeat: WIN_CELEBRATION_REPEAT,
              ease: "Sine.easeInOut",
              onUpdate: () => {
                player.container.setDepth(500 + player.container.y);
              },
              onComplete: () => {
                player.container.setY(startY);
                player.container.setDepth(500 + player.container.y);
                resolve();
              },
            });
          })
      )
    );
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

function toDisplayClockState(seconds: number): DisplayClockState {
  const clamped = Math.max(0, Math.min(seconds, MATCH_DURATION_SECONDS));
  const virtualMatchSeconds = clamp(
    0,
    VIRTUAL_HALF_SECONDS * 2,
    Math.round((clamped / Math.max(1, MATCH_DURATION_SECONDS)) * VIRTUAL_HALF_SECONDS * 2)
  );
  const half: 1 | 2 = virtualMatchSeconds <= VIRTUAL_HALF_SECONDS ? 1 : 2;
  const mins = Math.floor(virtualMatchSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(virtualMatchSeconds % 60)
    .toString()
    .padStart(2, "0");

  return {
    half,
    halfLabel: half === 1 ? "1ST HALF" : "2ND HALF",
    clockText: `${mins}:${secs}`,
  };
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
  teams: { home: RuntimeTeam; away: RuntimeTeam };
}): { scored: boolean; scoreProbability: number; executionQuality: TapQuality } {
  const { event, chanceType, teams } = options;
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
  const attackingExecution = computeAiExecution(options.seed, options.eventIndex, "attack", attacking, chanceType, true);
  const defendingExecution = computeAiExecution(options.seed, options.eventIndex, "defend", defending, chanceType, false);
  const executionEdge = clampSigned((attackingExecution - defendingExecution) * 0.28, 0.18);
  const keeperEdge =
    chanceType === "ONE_ON_ONE"
      ? clampSigned((defending.goalkeepingRating - attacking.attackRating) / 240, 0.09)
      : clampSigned((defending.goalkeepingRating - attacking.attackRating) / 320, 0.06);

  const scoreProbability = clamp01(
    baseFromEngine + statEdge + staminaEdge + qualityEdge + chanceTypeEdge + executionEdge + keeperEdge * -1
  );
  const roll = hashUnit(
    `${options.seed}:${options.eventIndex}:resolve:auto:${attackingExecution.toFixed(4)}:${defendingExecution.toFixed(4)}`
  );
  const executionBlend = clamp01(
    attackingExecution * 0.5 + (1 - defendingExecution) * 0.32 + event.quality * 0.18 + (roll <= scoreProbability ? 0.08 : -0.08)
  );
  return {
    scored: roll <= scoreProbability,
    scoreProbability: Number(scoreProbability.toFixed(4)),
    executionQuality: executionToTapQuality(executionBlend),
  };
}

function computeAiExecution(
  seed: string,
  eventIndex: number,
  mode: "attack" | "defend",
  team: RuntimeTeam,
  chanceType: ChanceType,
  isAttacking: boolean
): number {
  const base =
    mode === "attack"
      ? team.attackRating * 0.34 +
        team.controlRating * 0.24 +
        team.staminaRating * 0.16 +
        team.strength * 0.14 +
        team.goalkeepingRating * 0.02 +
        chanceTypeAttackBonus(chanceType) * 100
      : team.defenseRating * 0.34 +
        team.goalkeepingRating * 0.3 +
        team.controlRating * 0.16 +
        team.staminaRating * 0.12 +
        team.strength * 0.08 +
        chanceTypeDefenseBonus(chanceType) * 100;

  const normalized = clamp01(base / 100);
  const variance = (hashUnit(`${seed}:${eventIndex}:ai:${mode}:${isAttacking ? "A" : "D"}`) * 2 - 1) * 0.14;
  return clamp01(normalized + variance);
}

function chanceTypeAttackBonus(type: ChanceType): number {
  if (type === "CLOSE_RANGE") return 0.06;
  if (type === "CENTRAL_SHOT") return 0.02;
  if (type === "ANGLED_SHOT") return -0.02;
  return 0.01;
}

function chanceTypeDefenseBonus(type: ChanceType): number {
  if (type === "ONE_ON_ONE") return 0.05;
  if (type === "ANGLED_SHOT") return 0.02;
  return 0;
}

function executionToTapQuality(value: number): TapQuality {
  if (value >= 0.72) {
    return "PERFECT";
  }
  if (value >= 0.48) {
    return "GOOD";
  }
  return "POOR";
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

function toTeamCode(name: string): string {
  const cleaned = (name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .trim();

  if (!cleaned) {
    return "CLB";
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  const shortWord = words.find((word) => word.length === 3);
  if (shortWord) {
    return shortWord;
  }

  if (words.length >= 3) {
    return words
      .slice(0, 3)
      .map((word) => word[0])
      .join("");
  }

  if (words.length === 2) {
    const [first, second] = words;
    return `${first[0]}${second.slice(0, 2)}`.padEnd(3, second[0] ?? "X");
  }

  return words[0].slice(0, 3).padEnd(3, "X");
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

function clampOrdered(a: number, b: number, value: number): number {
  return clamp(Math.min(a, b), Math.max(a, b), value);
}

function clampSigned(value: number, maxAbs: number): number {
  return Math.min(maxAbs, Math.max(-maxAbs, value));
}

function shouldStopEarly(homeGoals: number, awayGoals: number): boolean {
  const totalGoals = homeGoals + awayGoals;
  return totalGoals >= MAX_TOTAL_GOALS;
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

    const totalGoals = homeGoals + awayGoals;

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
  const totalGoals = result.homeGoals + result.awayGoals;

  if (result.durationSeconds < 1 || result.durationSeconds > MATCH_DURATION_SECONDS) {
    return false;
  }

  if (totalGoals > MAX_TOTAL_GOALS) {
    return false;
  }

  if (totalGoals === MAX_TOTAL_GOALS && result.endReason !== "TEN_TOTAL_GOALS") {
    return false;
  }

  if (totalGoals < MAX_TOTAL_GOALS && result.endReason !== "TIMER_EXPIRED") {
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
      earlyFinishGoalLead: config.rules?.earlyFinishGoalLead ?? DISABLED_EARLY_FINISH_GOAL_LEAD,
      maxChanceGapSeconds: config.rules?.maxChanceGapSeconds ?? MAX_EVENT_GAP_SECONDS,
    },
  };
}

function resolveRuntimeTeam(team: MatchRuntimeConfig["homeTeam"]): RuntimeTeam {
  return {
    name: team.name,
    strength: team.strength,
    formation: normalizeFormationCode(team.formation),
    attackRating: team.attackRating ?? team.strength,
    defenseRating: team.defenseRating ?? team.strength,
    controlRating: team.controlRating ?? team.strength,
    goalkeepingRating: team.goalkeepingRating ?? team.strength,
    staminaRating: team.staminaRating ?? 100,
    momentumBias: team.momentumBias,
  };
}

function normalizeFormationCode(value: unknown): FormationCode {
  if (typeof value !== "string") {
    return "4-4-2";
  }

  const normalized = value.trim() as FormationCode;
  return SUPPORTED_FORMATIONS.includes(normalized) ? normalized : "4-4-2";
}

function resolveFormationLayout(code: unknown): FormationNode[] {
  const formation = normalizeFormationCode(code);
  const layout = TOP_FORMATION_LAYOUTS[formation] ?? TOP_FORMATION_LAYOUTS["4-4-2"];
  return layout.map((node) => ({ ...node }));
}

function mirrorFormationVertically(formation: FormationNode[]): FormationNode[] {
  return formation.map((node) => ({
    ...node,
    y: 1 - node.y,
  }));
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
