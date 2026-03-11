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

Production runtime (single process):

```bash
npm run build
npm start
```

Versioning and cache-bust:
- Semantic version is from `package.json`.
- Build metadata file is generated at build time via `npm run build:meta`.
- Runtime version file is generated at build time: `apps/web/public/version.json`.
- Version bump helpers: `npm run version:patch`, `npm run version:minor`, `npm run version:major`.

Patch notes and git workflow:
- Changelog: `CHANGELOG.md`
- Patch note templates: `docs/patch-notes/`
- Generate a new patch note: `npm run notes:new -- --title "Your update title"`
- Commit/push format: `docs/git-commit-and-push-format.md`
- Optional git commit template: `git config commit.template .gitmessage.txt`
- One-time protocol hook install: `npm run protocol:install`
- Per-update prep: `npm run protocol:prepare`

This serves:
- Next.js frontend on `/`
- Express API on `/api`
- Start entrypoint: `server.js` (auto-builds if `dist/server.js` is missing, then starts runtime)

API-only runtime (optional):

```bash
npm run api:dev
```

Database connectivity still uses `.env` with MySQL credentials.
Authentication uses Clerk (`CLERK_SECRET_KEY` + publishable key via `CLERK_PUBLISHABLE_KEY` or `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`).

## Hostinger Node deploy

- Install command: `npm install`
- Build command: `npm run build`
- Start command: `npm run start`
- Node.js version: `22.x` (minimum supported: `20.9.0`)
- If your platform skips build, `server.js` will attempt a fallback build using local `next` + `tsc` binaries.

## Recommended next step

Initialize workspace tooling (npm/pnpm workspaces + TypeScript project refs), then wire:

1. `apps/server` as the active API runtime
2. `apps/web` Next.js app
3. `apps/mobile` Expo app
4. shared imports from `packages/game-core`
