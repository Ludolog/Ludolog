# GameValue Radar Agent Guide

## Project Goal

GameValue Radar is a web and Android app for analyzing PC games. Its core value is combining a searchable game catalog, Steam player counts, first-party price/offer data, and a GameValue Score that helps decide whether a game is worth tracking or buying.

## Architecture

- Web/backend: Next.js and TypeScript.
- Mobile: separate client in `mobile/`, built with Vite, React, and Capacitor Android.
- Production backend: Vercel.
- Production database: Neon PostgreSQL.
- ORM: Prisma.
- Android and web clients call only the GameValue API.
- Steam, GOG, and Steam Store requests are backend-only.
- Android must never receive secrets.

## Production URL

- `https://apka-seven.vercel.app`

## Data Sources

- Steam API is active for Steam catalog sync and Steam current-player counts.
- `SteamCatalogEntry` is the large search catalog.
- `Game` contains only imported/tracked games, not the whole Steam catalog.
- `PlayerCountSnapshot` stores real and fallback player-count snapshots.
- GameValue Price API is the first-party price module.
- GOG connector exists.
- Steam Store price connector exists and is experimental.
- GG.deals, ITAD, and CheapShark are legacy/disabled and are not active price providers.

## Technical Decisions

- Do not use GG.deals because Vercel/serverless requests hit Cloudflare challenges.
- Do not bypass Cloudflare.
- Do not use Playwright, Puppeteer, proxies, browser sessions, or cookies for provider access.
- Do not scrape protected HTML pages.
- Do not work on Firebase now.
- Do not work on Google Play release or release signing now.
- Mock/demo prices must never be treated as trusted or real prices.
- Do not import the full Steam catalog into `Game`; keep the large catalog in `SteamCatalogEntry`.

## Secrets And Safety

Do not commit:

- `.env`
- `.env.local`
- `mobile/.env.production`
- APK/AAB artifacts
- keystores
- `node_modules`
- `.next`
- build outputs

Never reveal values for:

- `ADMIN_API_SECRET`
- `CRON_SECRET`
- `STEAM_WEB_API_KEY`
- `DATABASE_URL`
- `DIRECT_URL`
- feed/API secrets

Admin POST endpoints require:

- `x-admin-secret: ADMIN_API_SECRET`

Cron endpoints require:

- `CRON_SECRET`

## Important Environment Variable Names

Names only; never write real values in docs, commits, logs, or chat.

- `DATABASE_URL`
- `DIRECT_URL`
- `REPOSITORY_PROVIDER`
- `DATA_MODE`
- `PRICE_PROVIDER`
- `PRICE_MODE`
- `NEXT_PUBLIC_APP_URL`
- `MOBILE_ALLOWED_ORIGINS`
- `STEAM_WEB_API_KEY`
- `ADMIN_API_SECRET`
- `CRON_SECRET`
- `GOG_ENABLED`
- `GOG_COUNTRY_CODE`
- `GOG_CURRENCY`
- `STEAM_STORE_PRICE_ENABLED`
- `STEAM_STORE_COUNTRY`
- `STEAM_STORE_CURRENCY`

## Commands

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run mobile:build:prod`
- `npm run mobile:sync:prod`
- `npm run android:build`
- `npm run db:migrate:deploy`
- `npm run db:seed`

## Important Endpoints

- `GET /api/admin/status`
- `GET /api/admin/steam-catalog/status`
- `POST /api/admin/steam-catalog/sync`
- `GET /api/categories/overview`
- `GET /api/categories/:slug`
- `GET /api/games/search`
- `POST /api/games/import`
- `POST /api/games/resolve`
- `GET /api/stats/overview`
- `GET /api/prices/status`
- `GET /api/deals/best`
- `GET /api/admin/gog/status`
- `POST /api/admin/gog/catalog/search`
- `POST /api/admin/gog/mappings`
- `POST /api/admin/gog/prices/test`
- `POST /api/admin/gog/prices/refresh`
- `GET /api/admin/steam-store-prices/status`
- `POST /api/admin/steam-store-prices/test`
- `POST /api/admin/steam-store-prices/refresh`
- `GET /api/admin/prices/mock-cleanup/preview`
- `POST /api/admin/prices/mock-cleanup/run`

## How To Work On This Repo

- Read `AGENTS.md` first.
- Do not analyze the whole repository from scratch when `AGENTS.md` answers the question.
- Before large changes, check current production status and relevant endpoints.
- Do not add external providers without a user decision.
- Do not run destructive endpoints without preview and explicit confirmation.
- Do not run mass syncs without limits.
- After every larger change, run the full verification chain.
- After changes that require deployment, commit, push, and wait for Vercel.
- Update `AGENTS.md` only when lasting architecture or technical decisions change.

## Current Known State

- `SteamCatalogEntry` is around 500 rows.
- `Game` is around 20 rows.
- GOG is enabled, but production offers/mappings are not present yet.
- Steam Store prices are enabled, but production offers are not present yet.
- Stats mode is `mixed`.
- Search/import/details works.
- Categories work.
- Mock/demo prices are excluded from trusted rankings, but old mock/demo price data still exists in the database until cleanup is safely run.
