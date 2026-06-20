# Environment Variables

This project uses Vercel and Neon for production. Never commit real values.

## Production Target

- Production URL: `https://ludolog.vercel.app`
- GitHub repo: `https://github.com/Ludolog/Ludolog`
- Database: Neon Ludolog

## Required Production Variables

| Name | Expected production value/status |
| --- | --- |
| `DATABASE_URL` | SET, pooled Neon Ludolog URL |
| `DIRECT_URL` | SET, direct/unpooled Neon Ludolog URL |
| `REPOSITORY_PROVIDER` | `prisma` |
| `DATA_MODE` | `api` |
| `PRICE_PROVIDER` | `gamevalue` |
| `PRICE_MODE` | `internal` |
| `NEXT_PUBLIC_APP_URL` | `https://ludolog.vercel.app` |
| `MOBILE_ALLOWED_ORIGINS` | includes `https://ludolog.vercel.app` and mobile origins |
| `ADMIN_API_SECRET` | SET secret |
| `CRON_SECRET` | SET secret |
| `STEAM_WEB_API_KEY` | MISSING until the user adds it |
| `STEAM_STORE_PRICE_ENABLED` | `true` |
| `STEAM_STORE_COUNTRY` | `PL` |
| `STEAM_STORE_CURRENCY` | `PLN` |
| `GOG_ENABLED` | `true` |
| `GOG_COUNTRY_CODE` | `PL` |
| `GOG_CURRENCY` | `PLN` |
| `SHOW_GOG_PUBLIC` | `false` |
| `ENABLE_DEV_MOCK_FALLBACK` | `false` |

## Current Handoff Notes

- `STEAM_WEB_API_KEY` is waiting for user setup.
- Without `STEAM_WEB_API_KEY`, real Steam player/catalog refreshes should report missing key or blocked state.
- Public endpoints should continue to serve cached/stored real data where available.
- Production smoke on 2026-06-20 showed Ludolog admin status reporting `DATA_MODE=mock`; update Vercel Ludolog to `DATA_MODE=api` and redeploy.

## Database URL Rules

- Runtime `DATABASE_URL` may use Neon pooler.
- Prisma migrations and transfer operations must use `DIRECT_URL`.
- `DIRECT_URL` must not contain `pooler`.
- Do not use `pg_dump` or `pg_restore` with pooled URLs.

## Do Not Commit

- `.env`
- `.env.local`
- `env.txt`
- Neon connection strings
- admin/cron/Steam secrets
- database dumps
- mobile signing artifacts
