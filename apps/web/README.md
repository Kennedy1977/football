# Web App (Next.js)

Planned routes:
- `/` auth gate + onboarding redirect
- `/home` dashboard
- `/squad`
- `/league`
- `/shop`
- `/profile`
- `/match/prep`
- `/match/live`
- `/match/result`

Consume shared rules from `@football/game-core`.

API base target:
- Production: `https://football.andrewkennedydev.com/api`
- Local: `http://localhost:4000/api`

Redux Toolkit + RTK Query scaffold:
- `apps/web/src/state/store.ts`
- `apps/web/src/state/apis/gameApi.ts`
- `apps/web/src/state/slices/*`

## Phaser Match Simulation

Implemented starter module:
- `apps/web/src/match/phaser-match-simulation.ts`

Entry helper:
- `apps/web/src/match/demo.ts`

The Phaser scene is driven by shared engine output from:
- `packages/game-core/src/engine/simulateMatch.ts`

Minimal usage:

```ts
import { runMatchSimulationDemo } from "./src/match/demo";

const container = document.getElementById("match-root");
if (container) {
  runMatchSimulationDemo(container);
}
```
