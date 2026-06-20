# Ludolog Handoff

## Current Target

- Production URL: `https://ludolog.vercel.app`
- GitHub repo: `https://github.com/Ludolog/Ludolog`
- Production database: Neon project Ludolog

## Safety

- Do not commit `.env`, `.env.local`, `env.txt`, dumps, APK/AAB artifacts, keystores or secrets.
- Do not print `DATABASE_URL`, `DIRECT_URL`, `ADMIN_API_SECRET`, `CRON_SECRET` or `STEAM_WEB_API_KEY`.
- Use `DIRECT_URL` only for Prisma migrations and database transfer operations.
- Use pooled `DATABASE_URL` for runtime.
- Do not run destructive admin endpoints without preview and explicit user confirmation.
- Do not run mass refreshes/backfills over the full Steam catalog.

## Known State On 2026-06-20

- Local Git `origin` points to `https://github.com/Ludolog/Ludolog.git`.
- Local branch is `main`.
- `.env*` files are ignored.
- `env.txt` is ignored because it may contain copied secret fragments.
- Local `.env` was not present during the handoff verification, so local Prisma DB checks were blocked by missing `DIRECT_URL`.
- Vercel CLI on this machine was not linked to the Ludolog Vercel project during the handoff check.
- Ludolog public smoke tests returned HTTP 200 for TOP games, prices status, stats overview, deals, categories and Dota 2 prices.
- Cron guard without a secret returned 401 for top-games, prices and player-count refresh routes.
- Ludolog `/api/admin/steam-catalog/status` reports `hasSteamApiKey=false` and `dataMode=mock`.
- `STEAM_WEB_API_KEY` is intentionally waiting for the user to add it.

## Open Items

- Link local Vercel CLI to the Ludolog project or log into the correct Vercel team/account.
- In Vercel Ludolog, set `DATA_MODE=api`.
- Add `STEAM_WEB_API_KEY`, redeploy, then run safe admin dry runs before real refreshes.
- Verify `NEXT_PUBLIC_APP_URL=https://ludolog.vercel.app`.
- Verify `DATABASE_URL` is pooled and `DIRECT_URL` is direct/unpooled.
- Clean or hide the legacy `Game.source=mock` metadata row that appears in `/api/deals/best` for Cyberpunk 2077.

## Verification Commands

```powershell
npm run prisma:generate
npx prisma migrate status
npm run typecheck
npm test
npm run build
```

Use production smoke checks against `https://ludolog.vercel.app`.
