# Football Manager Arcade v1 - Updated Phaser Implementation Plan

## 1. Product + Tech Constraints (Source of Truth)

- Single monorepo
- Web app shell: Next.js
- Mobile app shell: Expo / React Native
- Backend: Express wrapper around Next.js runtime
- Database: MySQL
- Auth: Clerk (email/password, Google, Apple, Facebook)
- State: Redux Toolkit + RTK Query
- Shared logic package: TypeScript rules/types/formulas/validators
- Match gameplay runtime: Phaser only (portrait-first)

Non-negotiable architecture boundaries:
- Phaser handles match presentation + gameplay interactions only.
- Phaser never talks to DB or backend directly.
- App shell (Next/Expo) owns API calls, session, navigation, and persistence.
- Shared rules package is the only source for deterministic gameplay formulas.

## 2. Monorepo Structure

```text
football/
  apps/
    web/                        # Next.js app shell
      app/
      src/
        components/
        state/
        match/                  # Phaser integration layer (web canvas host)
    mobile/                     # Expo app shell
      src/
        screens/
        state/
        match/                  # Phaser alternative adapter / scene host bridge
    server/                     # Express API (mounted under /api)
      src/
        routes/
        middleware/
        lib/
        config/
  packages/
    game-core/                  # shared deterministic rules + contracts
      src/
        api-contracts.ts
        constants.ts
        types.ts
        formulas.ts
        validation/
          lineup.ts
          match-submit.ts
        engine/
          simulateMatch.ts
          chance-model.ts
          momentum-model.ts
        phaser-contracts.ts     # scene config/output contracts (no Phaser imports)
  database/
    schema.sql
    migrations/
  docs/
    implementation-plan.md
```

## 3. Gameplay Architecture (Phaser Included)

### App Shell vs Phaser Responsibilities

- App Shell (Next/Expo):
  - Auth, onboarding, dashboard, squad/shop/league screens
  - Pre-match setup and API start call
  - Starts Phaser with `MatchRuntimeConfig`
  - Receives `MatchRuntimeResult` callback
  - Calls `POST /api/match/submit`

- Phaser Runtime:
  - Top-down mini-sim in portrait mode
  - Score/time HUD + commentary ticker
  - Chance-event transitions
  - Shot/save timing-bar minigame scenes
  - Emits final result object only

### Data Contract Boundary

From app shell into Phaser:
- `matchSeed`
- team snapshots (overall/formation/fatigue modifiers)
- rules (3-minute timer, max 10 goals, 3-goal lead)
- chance interval rules (max 20s)

From Phaser back to app shell:
- final score
- duration
- end reason (`THREE_GOAL_LEAD` | `TEN_TOTAL_GOALS` | `TIMER_EXPIRED`)
- compact simulation payload (events, timings, chance outcomes)

## 4. Core Flow Mapping

1. Sign in/up (Clerk)
2. `POST /api/auth/session` creates/syncs account row only
3. Create manager profile
4. Create club identity
5. Generate starter squad (15 players, all Common)
6. Dashboard loop (daily claim, squad, shop, league, profile)
7. Match loop:
   - `/api/match/start`
   - Phaser runtime
   - `/api/match/submit`
8. Result flow + league movement + optional promotion claim

## 5. Database Scope

Keep and use current schema as the v1 base:
- `accounts`, `managers`, `clubs`
- `league_tiers`, `league_memberships`
- `players`, `lineups`, `formation_unlocks`
- `matches`
- `daily_reward_claims`, `promotion_reward_claims`
- `pack_catalogue`, `pack_purchases`, `pack_rewards`
- `economy_transactions`

Additional v1 recommendation for inactive CPU automation:
- Add a scheduled worker (or cron-trigger endpoint) to:
  - toggle inactive clubs to CPU after 30 days
  - mark reusable CPU slots after 90 days

## 6. Shared Rule Modules (`packages/game-core`)

Required deterministic modules:
- `engine/simulateMatch.ts`
  - chance cadence (<= 20 seconds)
  - momentum bursts
  - underdog adjustment (mild)
  - early stop conditions
- `engine/chance-model.ts`
  - chance ownership probability using team quality + fatigue + momentum
- `engine/minigame-resolution.ts`
  - timing bar outcome resolution with stat-based green zone + variance
- `formulas.ts`
  - league points
  - coin rewards
  - manager/starter EXP gains
  - stamina drain/recovery
  - sell values
  - team overall with formation/out-of-position penalties
- `validation/*`
  - lineup validity (11 starters + GK)
  - squad sale constraints
  - match submit bounds (duration/goals/end reason)

## 7. Phaser Scene Plan (Portrait)

Scenes:
1. `MatchIntroScene`
   - team names, kick-off transition
2. `PitchSimScene`
   - lightweight top-down movement
   - timer and score overlay
   - commentary callouts
3. `ChanceTransitionScene`
   - quick zoom/spotlight animation into chance type
4. `ShotMinigameScene`
   - attacker timing-bar
5. `SaveMinigameScene`
   - goalkeeper timing-bar
6. `MatchOutroScene`
   - final whistle + emit result callback

Phaser integration wrappers:
- Web: mount canvas in `/match/live` React host
- Mobile: RN-hosted WebView/bridge adapter (same runtime config + result contract)

## 8. API Surface (v1)

Auth + onboarding:
- `POST /api/auth/session`
- `POST /api/onboarding/manager`
- `POST /api/onboarding/club`
- `POST /api/onboarding/reset-club`

Core loop:
- `GET /api/dashboard/summary`
- `GET /api/squad/players`
- `PUT /api/squad/lineup`
- `POST /api/squad/sell`
- `POST /api/match/start`
- `POST /api/match/submit`
- `GET /api/league/table`
- `GET /api/league/legends`
- `POST /api/rewards/daily-claim`
- `POST /api/rewards/promotion-claim`
- `GET /api/shop/packs`
- `POST /api/shop/packs/purchase`
- `POST /api/shop/packs/reward-decision`

## 9. State Model (Redux + RTK Query)

Slices:
- `authSlice`: Clerk user identity + session-sync status
- `clubSlice`: manager, club, onboarding completion, coins/team overall
- `squadSlice`: players, lineup, unlocked formations
- `matchSlice`: prep state, live events, final submission
- `leagueSlice`: table snapshot + legends nearby
- `shopSlice`: packs, purchases, reward decisions
- `rewardsSlice`: daily + promotion statuses
- `uiSlice`: modals, toasts, staged result flow progress

RTK Query:
- single `gameApi` with tag invalidation by domain (`Dashboard`, `Squad`, `League`, `Packs`)

## 10. Phaser-Specific Acceptance Criteria

- Portrait runtime with stable 60fps target on modern phones
- Chance intervals never exceed 20s
- Early match stop rules always respected
- Minigame result reproducible from seed + input + config
- Phaser returns result via callback only; no network calls from scenes
- Match submit rejects invalid payloads and replays

## 11. MVP Delivery Phases

Phase 1: Foundation
- Repo wiring, shared package, Clerk session sync, MySQL connectivity

Phase 2: Onboarding
- Manager + club creation
- starter squad generation
- default 4-4-2 lineup

Phase 3: Dashboard + Core Modules
- home summary
- squad management
- league table
- shop list + purchase flow skeleton
- daily reward claim

Phase 4: Phaser Match Runtime
- portrait pitch sim scene
- chance transitions
- shot/save timing bars
- callback contract wired to `/api/match/submit`

Phase 5: Progression
- EXP/stamina/coins/post-match staging
- formation unlocks (3 wins and 5 wins)
- promotion flow + claim-once enforcement

Phase 6: Hardening
- idempotent reward handling
- anti-replay checks
- edge-case validation (GK minimum, squad minimum, full squad conversions)
- telemetry/logging for match runtime + submit failures

## 12. Immediate Next Tasks

1. Finalize Clerk production env config and verified session flow on live domain.
2. Complete squad lineup editor for full 11+bench management (starter integrity checks).
3. Lock Phaser live scene contract to a single `MatchRuntimeConfig` + `MatchRuntimeResult` interface and consume it in web match flow.
4. Add promotion staging screen after result + condensed 9-team table.
5. Add automated inactive-club CPU toggle process (30/90-day lifecycle).

## 13. Deployment Base URLs

- App: `https://football.andrewkennedydev.com/`
- API: `https://football.andrewkennedydev.com/api`
