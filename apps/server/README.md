# Server App (Express Wrapper)

This folder now contains a runnable TypeScript API implementation.

Run:

```bash
npm run api:dev
```

Implemented endpoints:
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

Auth for now uses `x-clerk-user-id` request header until full Clerk middleware is wired.

Deployment target:
- App domain: `https://football.andrewkennedydev.com/`
- API base: `https://football.andrewkennedydev.com/api`

DB migration note:
- If your DB was created before pack reward payload support, run:
  - `database/migrations/20260308_add_pack_reward_payload.sql`
