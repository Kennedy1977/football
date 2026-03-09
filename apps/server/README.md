# Server App (Express Wrapper)

This folder now contains a runnable TypeScript API implementation.

Run:

```bash
npm run api:dev
```

In production deploy, API is mounted by the root app server at `/api`.

Implemented endpoints:
- `POST /api/auth/session`
- `POST /api/onboarding/manager`
- `POST /api/onboarding/club`
- `POST /api/onboarding/reset-club`
- `GET /api/dashboard/summary`
- `GET /api/squad/players`
- `PUT /api/squad/lineup`
- `POST /api/squad/sell`
- `POST /api/match/start`
- `POST /api/match/submit`
- `GET /api/shop/packs`
- `POST /api/shop/packs/purchase`
- `POST /api/shop/packs/reward-decision`
- `POST /api/rewards/daily-claim`
- `POST /api/rewards/promotion-claim`
- `GET /api/league/table`
- `GET /api/league/legends`

Match start payload note:
- `POST /api/match/start` now includes `arcadeRatings` (attack/defense/control/goalkeeping/stamina) for both clubs so Phaser timing bars can be stat-driven.

Match submit payload note:
- `POST /api/match/submit` now validates and sanitizes `simulationPayload` (events + chanceOutcomes) before storing to DB.
- Replay safeguard: duplicate submissions with the same `matchSeed` for the same club are rejected.
- Recommended DB migration for hard enforcement:
  - `database/migrations/20260309_add_unique_match_seed_per_club.sql`

Auth uses Clerk:
- If `CLERK_SECRET_KEY` is configured, Express mounts Clerk middleware and reads authenticated user id from Clerk session/cookies.
- For local scripts/dev fallback, API still accepts `x-clerk-user-id` header.

First sign-in flow:
- Call `POST /api/auth/session` to create or sync `accounts` row before manager/club onboarding.

Deployment target:
- App domain: `https://football.andrewkennedydev.com/`
- API base: `https://football.andrewkennedydev.com/api`

DB migration note:
- If your DB was created before pack reward payload support, run:
  - `database/migrations/20260308_add_pack_reward_payload.sql`
