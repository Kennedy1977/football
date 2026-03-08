# football

Football Manager Arcade v1 architecture scaffold.

## What is included

- Technical implementation plan:
  - `docs/implementation-plan.md`
- MySQL schema and seed data:
  - `database/schema.sql`
- Shared game-core package (TypeScript starter modules):
  - `packages/game-core/src/types.ts`
  - `packages/game-core/src/constants.ts`
  - `packages/game-core/src/formulas.ts`
  - `packages/game-core/src/engine/simulateMatch.ts`
- Backend route scaffolding:
  - `apps/server/src/routes/*`
- Web/mobile route plans:
  - `apps/web/README.md`
  - `apps/mobile/README.md`

## Current runtime app

The existing root Express server from earlier setup is still available:

```bash
npm start
```

The new TypeScript MVP API server runs separately:

```bash
npm run api:dev
```

Database connectivity still uses `.env` with MySQL credentials.

## Recommended next step

Initialize workspace tooling (npm/pnpm workspaces + TypeScript project refs), then wire:

1. `apps/server` as the active API runtime
2. `apps/web` Next.js app
3. `apps/mobile` Expo app
4. shared imports from `packages/game-core`
