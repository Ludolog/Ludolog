# Ludolog Onboarding

## First Checks

1. Read `AGENTS.md`.
2. Confirm Git remote:

```powershell
git remote -v
git branch --show-current
git status --short
```

3. Confirm local secrets are not tracked:

```powershell
git check-ignore .env .env.local env.txt mobile/.env mobile/.env.production mobile/.env.local
```

4. Do not paste connection strings or secrets into chat, docs, commits or logs.

## Local Environment

Create a local `.env` from the current Vercel/Neon values only when needed. Keep it ignored.

Expected database shape:

- `DATABASE_URL`: pooled Neon Ludolog URL.
- `DIRECT_URL`: direct/unpooled Neon Ludolog URL.
- `DIRECT_URL` must not contain `pooler`.

Run:

```powershell
npm run prisma:generate
npx prisma migrate status
```

Do not run `db push`, reset, seed or destructive migrations against production unless explicitly requested.

## Production Smoke

Base URL:

```text
https://ludolog.vercel.app
```

Check:

```text
GET /api/top-games?limit=100
GET /api/prices/status
GET /api/stats/overview
GET /api/deals/best
GET /api/categories/overview
GET /api/games/dota-2/prices
```

Cron guard checks without a secret should return 401:

```text
POST /api/cron/refresh-top-games
POST /api/cron/refresh-prices
POST /api/cron/refresh-player-counts
```

## After Adding STEAM_WEB_API_KEY

1. Add `STEAM_WEB_API_KEY` in Vercel Ludolog.
2. Redeploy.
3. Confirm `/api/admin/steam-catalog/status` reports the key available and `dataMode=api`.
4. Run admin dry runs first.
5. Only then run real TOP 100 refreshes.
