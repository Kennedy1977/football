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
- If these are missing in production, app runs in fallback mode (no Clerk widgets/route protection) instead of crashing.

Build metadata:
- Version is read from root `package.json` (semantic version).
- Build timestamp and cache-bust token are generated on each build into `apps/web/src/lib/build-meta.ts`.
- URL is normalized with `?v={major-minor-patch}-{timestamp}` and footer shows version + copyright.

Player card rarity frames:
- Player cards use a 2x2 rarity sprite (`common`, `rare`, `epic`, `legendary`) at:
  - `apps/web/public/assets/player-cards/rarity-sprite.webp`
- Generate sprite + split WebP files from your source image:

```bash
npm run assets:card-frames
```

Default source path:
- `assets/player-card-frames-source.png`

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
- Tap quality now influences whether each chance is converted/saved, with result normalization before submit.
- Submission payload includes `chanceOutcomes` metadata for replay/debug auditing.

Minimal usage:

```ts
import { runMatchSimulationDemo } from "./src/match/demo";

const container = document.getElementById("match-root");
if (container) {
  runMatchSimulationDemo(container);
}
```
