import { mountPhaserMatchSimulation } from "./phaser-match-simulation";

export function runMatchSimulationDemo(container: HTMLElement) {
  return mountPhaserMatchSimulation(
    container,
    {
      seed: `demo-${Date.now()}`,
      homeTeamStrength: 46,
      awayTeamStrength: 44,
      homeMomentumBias: 0.05,
      awayMomentumBias: 0,
    },
    {
      homeName: "City FC",
      awayName: "Rival United",
      width: 390,
      height: 780,
    }
  );
}
