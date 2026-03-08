import { buildMatchRuntimeConfig, mountPhaserMatchSimulation } from "./phaser-match-simulation";

export function runMatchSimulationDemo(container: HTMLElement) {
  return mountPhaserMatchSimulation(
    container,
    buildMatchRuntimeConfig({
      matchSeed: `demo-${Date.now()}`,
      homeTeam: { name: "City FC", strength: 46, momentumBias: 0.05 },
      awayTeam: { name: "Rival United", strength: 44, momentumBias: 0 },
    }),
    {
      width: 390,
      height: 780,
    }
  );
}
