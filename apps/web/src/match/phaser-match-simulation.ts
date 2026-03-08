import * as Phaser from "phaser";
import { MATCH_DURATION_SECONDS } from "../../../../packages/game-core/src/constants";
import { simulateMatch } from "../../../../packages/game-core/src/engine/simulateMatch";
import type { MatchChanceEvent, MatchSimulationInput, MatchSimulationOutput } from "../../../../packages/game-core/src/types";

export interface PhaserMatchOptions {
  width?: number;
  height?: number;
  homeName?: string;
  awayName?: string;
  homeColor?: number;
  awayColor?: number;
  backgroundColor?: string;
}

export interface MountedPhaserMatch {
  result: MatchSimulationOutput;
  destroy: () => void;
}

export function mountPhaserMatchSimulation(
  container: HTMLElement,
  input: MatchSimulationInput,
  options: PhaserMatchOptions = {}
): MountedPhaserMatch {
  const result = simulateMatch(input);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: options.width ?? 390,
    height: options.height ?? 780,
    backgroundColor: options.backgroundColor ?? "#0b1a2f",
    scene: new MatchSimulationScene(result, {
      homeName: options.homeName ?? "Your Team",
      awayName: options.awayName ?? "Rival Team",
      homeColor: options.homeColor ?? 0x3b82f6,
      awayColor: options.awayColor ?? 0xef4444,
    }),
    fps: { target: 60 },
    audio: { noAudio: true },
  });

  return {
    result,
    destroy: () => game.destroy(true),
  };
}

class MatchSimulationScene extends Phaser.Scene {
  private readonly result: MatchSimulationOutput;
  private readonly ui: {
    homeName: string;
    awayName: string;
    homeColor: number;
    awayColor: number;
  };

  private elapsed = 0;
  private eventCursor = 0;
  private homeGoals = 0;
  private awayGoals = 0;

  private timerText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private commentaryText!: Phaser.GameObjects.Text;
  private homeMarker!: Phaser.GameObjects.Arc;
  private awayMarker!: Phaser.GameObjects.Arc;

  constructor(
    result: MatchSimulationOutput,
    ui: {
      homeName: string;
      awayName: string;
      homeColor: number;
      awayColor: number;
    }
  ) {
    super("match-simulation-scene");
    this.result = result;
    this.ui = ui;
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
      delay: 1000,
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
    if (this.elapsed >= this.result.durationSeconds) {
      this.finishMatch();
      return;
    }

    this.elapsed += 1;
    this.timerText.setText(formatMatchClock(this.elapsed));

    while (this.eventCursor < this.result.events.length) {
      const event = this.result.events[this.eventCursor];
      if (event.second > this.elapsed) break;

      this.resolveChanceEvent(event);
      this.eventCursor += 1;
    }

    if (this.elapsed >= this.result.durationSeconds) {
      this.finishMatch();
    }
  }

  private resolveChanceEvent(event: MatchChanceEvent) {
    const marker = event.attackingSide === "HOME" ? this.homeMarker : this.awayMarker;
    const sideName = event.attackingSide === "HOME" ? this.ui.homeName : this.ui.awayName;

    this.tweens.add({
      targets: marker,
      scale: 1.55,
      duration: 200,
      yoyo: true,
      ease: "Quad.Out",
    });

    if (event.scored) {
      if (event.attackingSide === "HOME") this.homeGoals += 1;
      else this.awayGoals += 1;

      this.scoreText.setText(`${this.ui.homeName} ${this.homeGoals} - ${this.awayGoals} ${this.ui.awayName}`);

      this.commentaryText.setText(`GOAL! ${sideName} scores at ${formatMatchClock(event.second)}`);
      this.flashGoalBanner(sideName);
      return;
    }

    this.commentaryText.setText(`Chance for ${sideName}... saved!`);
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
    if (this.commentaryText.text.startsWith("FINAL")) {
      return;
    }

    this.timerText.setText(formatMatchClock(Math.min(this.result.durationSeconds, MATCH_DURATION_SECONDS)));
    this.scoreText.setText(`${this.ui.homeName} ${this.result.homeGoals} - ${this.result.awayGoals} ${this.ui.awayName}`);

    this.commentaryText.setText(
      `FINAL: ${this.result.result} (${this.result.endReason.replaceAll("_", " ")})`
    );

    this.homeMarker.setFillStyle(this.ui.homeColor, 0.85);
    this.awayMarker.setFillStyle(this.ui.awayColor, 0.85);
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
