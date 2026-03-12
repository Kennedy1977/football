# Football Manager Arcade v1 - Living Implementation Spec (As-Built + Scope Creep)

Last updated: 2026-03-11

## 1. Purpose

This document is now the **as-built source of truth** for what is currently implemented, including post-MVP scope creep and UX calibration work completed after the original plan.

## 2. Product + Tech Constraints

- Monorepo architecture.
- Web shell: Next.js App Router.
- Mobile shell: Expo/React Native (currently scaffold-only).
- API: Express mounted at `/api` in the same deployment.
- Database: MySQL.
- Auth: Clerk (with local dev fallback header).
- State: Redux Toolkit + RTK Query.
- Shared package: TypeScript contracts/formulas/sim logic in `packages/game-core`.
- Match runtime: Phaser (portrait-first), mounted by web shell.

Boundary rules:
- Phaser handles rendering/gameplay and emits result callback.
- Phaser does not call API/DB directly.
- Next/Expo shell owns auth/session, API calls, navigation, persistence.

## 3. Current Monorepo Status

```text
football/
  apps/
    web/            # Production app shell + Phaser host (implemented)
    server/         # API routes + DB logic (implemented)
    mobile/         # Minimal scaffold only (not feature-complete)
  packages/
    game-core/      # shared types, constants, formulas, sim + phaser contracts
  database/
    schema.sql
    migrations/
```

Implemented highlights:
- Full web route surface for onboarding, dashboard, squad, match flow, league, shop, profile.
- Fully mounted API route surface for auth/onboarding/dashboard/squad/match/shop/rewards/league.
- Match runtime contract wiring (`MatchRuntimeConfig` -> Phaser -> `MatchRuntimeResult`).
- Anti-replay protection on match submit via unique `(club_id, simulation_seed)`.

## 4. Current User Flow

1. Sign-in/sign-up (Clerk).
2. `POST /api/auth/session` syncs/creates account row.
3. Onboarding creates manager and club.
4. Club creation seeds starter squad and league membership.
5. Home loop: claim daily reward, manage squad, buy packs, play matches, check league.
6. Match loop:
   - `POST /api/match/start`
   - Phaser live simulation
   - `POST /api/match/submit`
7. Result UI shows full-time card, timeline/lineups/stats, rewards, promotion claim.

## 5. Match Runtime Spec (As Implemented)

### 5.1 Runtime rules

- Real-time duration: `60s` (`MATCH_DURATION_SECONDS`).
- Virtual clock mapping: real-time maps to `0-90` match minutes.
- Chance cadence guard: max gap `20s`.
- Max total goals: `10`.
- Early finish by 3-goal lead is currently disabled in runtime/start payload (`earlyFinishGoalLead = 99`).

### 5.2 Pitch + simulation presentation

- Portrait pitch uses `/assets/pitch/vertical-pitch.svg`.
- Pitch fills the simulation container edge-to-edge (no inner card/padding effect).
- Match UI chrome (topbar, bottom nav, build footer) is hidden while live match runs.
- Players animate with tactical ambient movement + chance-event transitions.
- Teams swap ends at halftime with a short transition (`~2.5s`).
- Team shape now honors each club's selected formation independently (e.g. `4-2-4` vs `4-3-3`).

### 5.3 HUD / overlays (scope-creep calibration)

- TV-style scoreboard bug is rendered inside top-left of the pitch.
- Connected timer + score unit (single combined visual group).
- Team abbreviations shown in score bug.
- Team color dots shown beside each abbreviation.
- Half label was removed from the compact HUD to save space.
- Commentary strip is centered on pitch with semi-transparent backdrop.
- Commentary is forced to single-line fit with ellipsis truncation.
- GOAL banner appears centered across middle of pitch, single-line emphasis.

### 5.4 Pre-kickoff and match-state behavior

- Before kickoff, top metrics panel shows:
  - Team Strength
  - Attack Matchup
  - Defensive Matchup
- Kickoff preview card includes club/opponent/rank pills over pitch.
- During active sim, kickoff UI and menus are hidden; only in-pitch HUD + overlays remain.

## 6. Match Result UX (As Implemented)

- Full-time hero card modeled after broadcast/score-app layout.
- Uses fake placeholder badges for clubs.
- Uses real club/opponent names; abbreviations used where compact display is needed.
- Goal lists include scorer names + minute labels.
- Timeline/Lineups/Stats tabbed sections.
- Timeline does not show a TAP column.
- Match event times displayed as virtual 90-minute timeline.
- Promotion claim panel shown when threshold reached (claim-once enforcement server-side).

## 7. Web Feature Surface (Current)

- `/start`: manager + club onboarding flow with manager portrait picker.
- `/home`: dashboard summary, manager portrait, reward CTA, quick actions.
- `/squad`: lineup editor with formation switching, XI/bench validation, drag/drop swaps, automatic best-XI pick on formation change, auto-save, and rarity-coded player borders on pitch/bench.
- `/match/prep`: pre-match setup and start.
- `/match/live`: Phaser runtime host.
- `/match/result`: full-time presentation + rewards/promotion (navigation handled by app shell menu/nav, without duplicate local nav buttons).
- `/league`: full table and rank context.
- `/shop`: pack catalogue, purchase flow, reward decision flow.
- `/profile`: manager/club summary + editable manager portrait picker.
- `/playercards`: player card visual preview route.
- `/settings`, `/help`: placeholder pages.

## 8. API Surface (Current)

Auth + onboarding:
- `POST /api/auth/session`
- `POST /api/onboarding/manager`
- `PUT /api/onboarding/manager/avatar`
- `POST /api/onboarding/club`
- `POST /api/onboarding/reset-club`
- `POST /api/onboarding/bootstrap-world` (scope creep: world seeding utility)

Core:
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

## 9. Data/Validation/Hardening (Current)

- DB includes league, players, lineups, matches, economy, rewards, pack systems, and `player_pool`.
- Match submit sanitizes and bounds simulation payload size/content.
- Replay prevention:
  - App-layer duplicate seed rejection.
  - DB unique key on `(club_id, simulation_seed)`.
- Reward idempotency:
  - Unique daily claim per date.
  - Unique promotion claim per tier.

## 10. Build + Versioning

- Root scripts include:
  - `prebuild:web`: `version:patch` + `build:meta`
  - `build:meta`: writes:
    - `apps/web/src/lib/build-meta.ts`
    - `apps/web/public/version.json`
- Runtime app footer reads version from `version.json` on load (with build-meta fallback).
- Package version in `package.json` is the single version source of truth.
- Commit protocol requires version artifact updates + patch notes + changelog + living spec updates per commit.

## 11. Scope-Creep Delta vs Original Plan

1. Match duration changed from 3-minute runtime to 60-second runtime with 90-minute virtual display mapping.
2. Early 3-goal lead finish effectively disabled for current gameplay.
3. Phaser implementation consolidated around one orchestrated simulation scene (instead of strict multi-scene storyboard).
4. Broadcast-style in-pitch HUD introduced (compact top-left bug).
5. Centered single-line commentary and centered GOAL bar added.
6. Halftime side-swap transition implemented.
7. App chrome hidden during live sim to maximize pitch area.
8. Result page upgraded to full-time presentation with fake badges + scorer attribution.
9. Added world bootstrap endpoint (`/onboarding/bootstrap-world`) for CPU/player-pool seeding.
10. Added player card preview route and card asset pipeline.
11. Added manager avatar sprite system with onboarding selection + profile-time updates.

## 12. Remaining Gaps / Next Work

1. Mobile app implementation (Expo screens + match runtime bridge) is still pending.
2. Shared `game-core` module split is incomplete (`chance-model`, `momentum-model`, `minigame-resolution`, standalone `validation/*` files are not fully separated yet).
3. Post-result promotion staging flow with condensed 9-team table still needs dedicated implementation.
4. Automated inactive-club lifecycle process (30/90-day scheduler) still pending.
5. Telemetry/logging pipeline for runtime/submit failures still pending.

## 13. Deployment Base URLs

- App: `https://football.andrewkennedydev.com/`
- API: `https://football.andrewkennedydev.com/api`

## 14. Patch Notes Feed

Latest patch notes (newest first):
<!-- PATCH_NOTES_FEED_START -->
- [2026-03-12 - v0.0.73 - add emergent support-triangle behavior in live sim](docs/patch-notes/2026-03-12-v0.0.73-add-emergent-support-triangle-behavior-in-live-sim.md)
- [2026-03-12 - v0.0.72 - Convert shop packs to reward chests and align squad card visuals](docs/patch-notes/2026-03-12-v0.0.72-convert-shop-packs-to-reward-chests-and-align-squad-card-visuals.md)
- [2026-03-12 - v0.0.71 - Remove duplicate home route buttons and hide claimed reward CTA](docs/patch-notes/2026-03-12-v0.0.71-remove-duplicate-home-route-buttons-and-hide-claimed-reward-cta.md)
- [2026-03-12 - v0.0.70 - Improve squad layout hierarchy and topbar notification layering](docs/patch-notes/2026-03-12-v0.0.70-improve-squad-layout-hierarchy-and-topbar-notification-layering.md)
- [2026-03-12 - v0.0.69 - Remove duplicate result-page navigation buttons](docs/patch-notes/2026-03-12-v0.0.69-remove-duplicate-result-page-navigation-buttons.md)
- [2026-03-11 - v0.0.68 - Fix oversized top-nav profile avatar](docs/patch-notes/2026-03-11-v0.0.68-fix-oversized-top-nav-profile-avatar.md)
- [2026-03-11 - v0.0.67 - Add rarity borders to pitch and bench player avatars](docs/patch-notes/2026-03-11-v0.0.67-add-rarity-borders-to-pitch-and-bench-player-avatars.md)
- [2026-03-11 - v0.0.66 - Fix squad pitch player hover position jump](docs/patch-notes/2026-03-11-v0.0.66-fix-squad-pitch-player-hover-position-jump.md)
- [2026-03-11 - v0.0.65 - Auto-pick and auto-save lineup when formation changes](docs/patch-notes/2026-03-11-v0.0.65-auto-pick-and-auto-save-lineup-when-formation-changes.md)
- [2026-03-11 - v0.0.64 - Apply each team's own formation in match sim](docs/patch-notes/2026-03-11-v0.0.64-apply-each-team-s-own-formation-in-match-sim.md)
- [2026-03-11 - v0.0.63 - Add manager avatar sprite selection and profile updates](docs/patch-notes/2026-03-11-v0.0.63-add-manager-avatar-sprite-selection-and-profile-updates.md)
- [2026-03-11 - v0.0.61 - Enhance manager profile dashboard and season insights](docs/patch-notes/2026-03-11-v0.0.61-enhance-manager-profile-dashboard-and-season-insights.md)
- [2026-03-11 - v0.0.60 - Add walk-on sequences and compact commit message enforcement](docs/patch-notes/2026-03-11-v0.0.60-add-walk-on-sequences-and-compact-commit-message-enforcement.md)
- [2026-03-11 - v0.0.59 - Fix footer version typing and confirm dependency currency](docs/patch-notes/2026-03-11-v0.0.59-fix-footer-version-typing-and-confirm-dependency-currency.md)
- [2026-03-11 - v0.0.58 - Enforce commit protocol and runtime version file loading](docs/patch-notes/2026-03-11-v0.0.58-enforce-commit-protocol-and-runtime-version-file-loading.md)
- [2026-03-11 - v0.0.57 - Introduce patch notes and git workflow format](docs/patch-notes/2026-03-11-v0.0.57-introduce-patch-notes-and-git-workflow-format.md)
<!-- PATCH_NOTES_FEED_END -->
