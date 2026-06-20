# Current Production State

Last verified: 2026-06-20

## Target

- Production URL: `https://ludolog.vercel.app`
- GitHub repo: `https://github.com/Ludolog/Ludolog`
- Database: Neon Ludolog

## Public Smoke Results

All listed public endpoints returned HTTP 200:

- `/api/top-games?limit=100`
- `/api/prices/status`
- `/api/stats/overview`
- `/api/deals/best`
- `/api/categories/overview`
- `/api/games/dota-2/prices`

TOP 100 coverage:

- tracked: 100
- imported: 100
- with player count: 100
- with fresh player count: 100
- with Steam price: 95
- with fresh Steam price: 95
- full score: 95
- insufficient data: 5
- no player data: 0
- no price data: 5
- public mock count in TOP 100: 0

Price status:

- real offers: 97
- mock offers: 0
- Steam Store offers: 96
- Steam Store price snapshots: 102
- catalog store offers: 118
- mock price snapshots: 0

## Cron Guard

Unauthenticated POST requests returned 401:

- `/api/cron/refresh-top-games`
- `/api/cron/refresh-prices`
- `/api/cron/refresh-player-counts`

## Known Issues

- `/api/admin/steam-catalog/status` reports `hasSteamApiKey=false`; `STEAM_WEB_API_KEY` still needs to be added.
- Admin status reports `DATA_MODE=mock`; Vercel Ludolog should be set to `DATA_MODE=api`.
- `/api/deals/best` can expose one legacy `game.source=mock` metadata field for Cyberpunk 2077. This is not a mock price or player source, but should be cleaned or hidden.
- Local Vercel CLI was not linked to the Ludolog Vercel project during verification.
- Local `.env` was missing during verification, so Prisma migration status and DB row counts could not be checked locally.

## After STEAM_WEB_API_KEY Is Added

1. Redeploy Vercel Ludolog.
2. Confirm `/api/admin/steam-catalog/status` reports `hasSteamApiKey=true` and `dataMode=api`.
3. Run dry-run admin TOP refreshes.
4. Run real TOP 100 refresh only after dry-run is clean.
5. Recheck `/api/top-games?limit=100` coverage.
