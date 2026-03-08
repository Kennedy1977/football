# Web App (Next.js)

Implemented routes:
- `/` redirects to onboarding start
- `/sign-in` Clerk sign-in
- `/sign-up` Clerk sign-up
- `/start` onboarding flow (manager + club)
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

Run locally:

```bash
npm run web:dev
```

Required auth env:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY` (required by API runtime for verified Clerk sessions)

## Phaser Match Simulation

Implemented starter module:
- `apps/web/src/match/phaser-match-simulation.ts`
- Contract-driven input/output from shared package:
  - `packages/game-core/src/phaser-contracts.ts`

Entry helper:
- `apps/web/src/match/demo.ts`

The Phaser scene is driven by shared engine output from:
- `packages/game-core/src/engine/simulateMatch.ts`

Runtime flow:
- App shell passes `MatchRuntimeConfig`
- Phaser runs portrait match + chance timing bars
- Phaser emits `MatchRuntimeResult` via callback
- Timing-bar window size and speed are now stat-driven from `match/start` arcade ratings.

Minimal usage:

```ts
import { runMatchSimulationDemo } from "./src/match/demo";

const container = document.getElementById("match-root");
if (container) {
  runMatchSimulationDemo(container);
}
```
