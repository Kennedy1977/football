# Mobile App (Expo)

Planned navigation tabs:
- Home
- Squad
- League
- Shop
- Profile

Match flow stack:
- MatchPrep
- MatchLive
- MatchResult

Consume shared rules from `@football/game-core`.

API base target:
- Production: `https://football.andrewkennedydev.com/api`
- Local: `http://localhost:4000/api`

State scaffold:
- `apps/mobile/src/state/store.ts` (re-exports web store scaffold for parity)
