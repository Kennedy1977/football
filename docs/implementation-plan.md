# Football Manager Arcade v1 - Practical Implementation Plan

## 1. Monorepo Structure (single repository)

```text
football/
  apps/
    server/                  # Express API wrapper around Next runtime (v1 scaffold)
      src/routes/
    web/                     # Next.js app (planned)
    mobile/                  # Expo app (planned)
  packages/
    game-core/               # Shared rules, simulation, formulas, constants, TS types
      src/
        constants.ts
        formulas.ts
        types.ts
        engine/simulateMatch.ts
  database/
    schema.sql               # MySQL schema + seeds for leagues and packs
  docs/
    implementation-plan.md
```

Why this split:
- `packages/game-core` is imported by `apps/web`, `apps/mobile`, and `apps/server`.
- UI can diverge by platform while rules and calculations stay identical.
- API remains light validation + persistence, as required.

## 2. Storyboard-to-Screen Plan

Storyboard panel mapping from your image:
1. Start Game -> `/(auth)` sign-in + onboarding gate.
2. Create Club -> `/onboarding/club` multi-step form.
3. Daily Reward Pop-up -> dashboard modal + persistent claim button.
4. Main Dashboard -> `/home` modules for Play/Squad/League/Shop/Profile.
5. Play Match -> `/match/prep` showing opponent, strengths, start CTA.
6. In-Match -> `/match/live` Phaser-driven top-down mini-sim + chance events.
7. Squad Management -> `/squad` lineup, bench, stamina, formation locks.
8. League Table -> `/league` condensed table + movement markers.
9. Match Result -> `/match/result` staged rewards + progression + promotion reveal.

## 3. MySQL Schema

Implemented in `database/schema.sql`.

Core tables:
- Identity: `accounts` (Clerk link)
- Profile: `managers`
- Club: `clubs`
- Leagues: `league_tiers`, `league_memberships`
- Squad: `players`, `lineups`, `formation_unlocks`
- Match: `matches`
- Rewards: `daily_reward_claims`, `promotion_reward_claims`
- Shop/Packs: `pack_catalogue`, `pack_purchases`, `pack_rewards`
- Economy ledger: `economy_transactions`

Included seeds:
- All league tiers from Beginner I to Legends
- Pack catalogue prices: 250, 500, 1000, 2500, 5000, 10000

## 4. Shared TypeScript Domain Models

Implemented starter interfaces in `packages/game-core/src/types.ts`:
- `ManagerProfile`, `ClubSummary`
- `PlayerCard`, `Lineup`
- `MatchSimulationInput`, `MatchSimulationOutput`, `MatchChanceEvent`
- Domain enums/unions for positions, rarities, results, leagues, formations

## 5. Backend API Route Plan

Scaffolded under `apps/server/src/routes`.

Primary endpoint groups:
- Onboarding
  - `POST /api/onboarding/manager`
  - `POST /api/onboarding/club`
  - `POST /api/onboarding/reset-club`
- Dashboard
  - `GET /api/dashboard/summary`
- Squad
  - `GET /api/squad/players`
  - `PUT /api/squad/lineup`
  - `POST /api/squad/sell`
- Match
  - `POST /api/match/start`
  - `POST /api/match/submit`
- Shop
  - `GET /api/shop/packs`
  - `POST /api/shop/packs/purchase`
  - `POST /api/shop/packs/reward-decision`
- Rewards
  - `POST /api/rewards/daily-claim`
  - `POST /api/rewards/promotion-claim`
- League
  - `GET /api/league/table`
  - `GET /api/league/legends`

## 6. Shared Match Engine Module Breakdown

Implemented starter engine in `packages/game-core/src/engine/simulateMatch.ts`.

Module responsibilities:
- `simulateMatch(input)`
  - Runs 180-second match timeline
  - Spawns chance events at random intervals (never >20s)
  - Resolves scoring using strength edge + variance + mild underdog bias
  - Ends early on 3-goal lead or 10 total goals
- `formulas.ts`
  - League points (0/1/3)
  - Coin reward (goals + result bonus)
  - EXP gains (manager + starter players)
  - Fatigue + recovery rules
  - Team overall and out-of-position penalties
  - Player sell value

## 7. Redux Toolkit + RTK Query State Plan

Recommended slices:
- `authSlice`
  - clerk user identity + session flags
- `clubSlice`
  - manager summary, club summary, coins, team overall, unlocks
- `squadSlice`
  - players, lineup, formation lock states, compare target
- `matchSlice`
  - pre-match selection, live state, events, result payload
- `leagueSlice`
  - tier info, table snapshot, legends view
- `shopSlice`
  - pack catalogue, pending purchase, opened rewards
- `rewardsSlice`
  - daily reward status, promotion reward statuses
- `uiSlice`
  - modals, toasts, staged result-step progress

RTK Query APIs:
- `onboardingApi`
- `dashboardApi`
- `squadApi`
- `matchApi`
- `shopApi`
- `rewardsApi`
- `leagueApi`

Current scaffold in repo:
- `apps/web/src/state/apis/gameApi.ts`
- `apps/web/src/state/store.ts`
- `apps/web/src/state/slices/*`

## 8. Build Order (MVP stages)

1. Foundation
- Workspace setup, shared package wiring, Clerk integration, MySQL connection.

2. Onboarding + Data Bootstrapping
- Manager creation, club creation, starter squad generation (15 players all Common).

3. Dashboard + Daily Reward
- Summary view, daily claim at 01:00 reset, coin ledger updates.

4. Squad + Formation Unlocks
- 4-4-2 baseline, lineup validation, unlock 4-3-3 (3 wins), unlock 4-5-1 (5 wins).

5. Match Loop
- Pre-match selection, simulation run, submit result, apply EXP/stamina/coins/league points.

6. League + Promotion Flow
- Condensed table, thresholds, one-time promotion rewards.

7. Shop + Pack Open Flow
- Purchase, reveal, keep/convert decisions, squad cap checks.

8. Polish + Hardening
- Validation, anti-duplication checks, idempotent reward claims, telemetry.

## 9. Risks and Edge Cases

Critical:
- Duplicate reward claims (daily/promotion) under retries.
- Invalid lineup submissions (no GK, <11 players, red stamina starters).
- Pack reward race conditions when squad is full.
- Match submission replay/fraud; require server-side invariant checks.

Gameplay balance:
- Strong team dominance if chance quality scaling is too steep.
- Underdog boost becoming too strong and flattening progression.
- Stamina loops causing hard lock if recovery + selection rules conflict.

Platform consistency:
- Drift between web/mobile if game-core is bypassed.
- Different timer behavior by platform for live match scene.

## 10. Next Code Scaffolding Targets

Immediate next implementation files:
- `apps/server/src/app.ts` to mount the API router and middleware
- `apps/web/app/(game)/...` route tree
- `apps/mobile/src/screens/...` navigation stack
- `packages/game-core/src/pack-generation.ts`
- `packages/game-core/src/validation/lineup.ts`
- `apps/web/src/match/phaser-match-simulation.ts`

This keeps v1 aligned with your non-negotiables while staying shippable in stages.

## Deployment Base URLs

- App domain: `https://football.andrewkennedydev.com/`
- API base: `https://football.andrewkennedydev.com/api`
