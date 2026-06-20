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
- `TopTrackedGame` is the curated TOP 100 Steam production scope.
- `Game` contains only imported/tracked games, not the whole Steam catalog.
- `PlayerCountSnapshot` stores real and fallback player-count snapshots.
- GameValue Price API is the first-party price module.
- GOG connector exists.
- GOG is admin/experimental and hidden from public price output by default unless `SHOW_GOG_PUBLIC=true`.
- GOG catalog discovery stores review entries and suggestions, not automatic mappings.
- GOG price refresh defaults to dry run.
- GOG catalog price backfill reads existing `GogCatalogEntry` records first and treats missing/no-price catalog prices as skipped cooldown states, not technical failures.
- GOG catalog prices may return a currency different from `GOG_CURRENCY`; store the returned currency and report the mismatch. Do not perform FX conversion.
- GOG catalog price backfill stores catalog-only offers in `CatalogStoreOffer`, not `Game`.
- Steam Store price connector exists and is experimental.
- Price refresh automation exists for small Steam Store, GOG and catalog backfill batches.
- `CatalogStoreOffer` stores catalog-only Steam Store backfill prices without importing rows into `Game`.
- `CatalogPriceCheckStatus` stores available, no-price, unavailable, unsupported and error cooldowns for catalog price backfills.
- GG.deals, ITAD, and CheapShark are legacy/disabled and are not active price providers.

## Technical Decisions

- Do not use GG.deals because Vercel/serverless requests hit Cloudflare challenges.
- Do not bypass Cloudflare.
- Do not use Playwright, Puppeteer, proxies, browser sessions, or cookies for provider access.
- Do not scrape protected HTML pages.
- Do not work on Firebase now.
- Do not work on Google Play release or release signing now.
- Mock/demo prices must never be treated as trusted or real prices.
- Production API mode must not silently substitute mock catalog, mock price, fake deal, fake chart, or mock player data.
- Public API mode reports missing real player data as no-data/missing instead of `playerSource="mock"` when `ENABLE_DEV_MOCK_FALLBACK=false`.
- Dev mock fallback is allowed only behind `ENABLE_DEV_MOCK_FALLBACK=true` or local mock mode.
- Do not import the full Steam catalog into `Game`; keep the large catalog in `SteamCatalogEntry`.
- Do not run mass price refreshes over the full Steam catalog.
- Use `TopTrackedGame` for daily practical refresh scope instead of the full Steam catalog.
- Keep TOP 100 refreshes capped at 100 entries.
- Use `CatalogStoreOffer` for catalog price backfill instead of creating tracked `Game` records.
- GOG mapping suggestions require manual approval before price writes.
- GOG soundtrack, DLC, demo, tool and bundle-like catalog entries are skipped by default during catalog price backfill unless an admin explicitly enables that product type in the request.

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
- `ENABLE_DEV_MOCK_FALLBACK`
- `NEXT_PUBLIC_APP_URL`
- `MOBILE_ALLOWED_ORIGINS`
- `STEAM_WEB_API_KEY`
- `ADMIN_API_SECRET`
- `CRON_SECRET`
- `GOG_ENABLED`
- `GOG_COUNTRY_CODE`
- `GOG_CURRENCY`
- `SHOW_GOG_PUBLIC`
- `STEAM_STORE_PRICE_ENABLED`
- `STEAM_STORE_COUNTRY`
- `STEAM_STORE_CURRENCY`
- `PRICE_REFRESH_ENABLED`
- `PRICE_REFRESH_IMPORTED_LIMIT`
- `PRICE_REFRESH_STEAM_STORE_LIMIT`
- `PRICE_REFRESH_GOG_LIMIT`
- `PRICE_REFRESH_CATALOG_BACKFILL_ENABLED`
- `PRICE_REFRESH_CATALOG_BACKFILL_LIMIT`
- `PRICE_REFRESH_MAX_RUNTIME_MS`
- `PLAYER_COUNT_REFRESH_LIMIT`
- `PLAYER_COUNT_REFRESH_MAX_RUNTIME_MS`
- `PLAYER_COUNT_STALE_MINUTES`
- `STEAM_STORE_PRICE_STALE_HOURS`
- `GOG_PRICE_STALE_HOURS`
- `CATALOG_PRICE_STALE_HOURS`
- `TOP_GAMES_REFRESH_ENABLED`
- `TOP_GAMES_PLAYER_REFRESH_LIMIT`
- `TOP_GAMES_PRICE_REFRESH_LIMIT`
- `TOP_GAMES_STALE_PLAYER_HOURS`
- `TOP_GAMES_STALE_PRICE_HOURS`

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
- `POST /api/admin/steam-catalog/sync-until`
- `GET /api/categories/overview`
- `GET /api/categories/:slug`
- `GET /api/games/search`
- `POST /api/games/import`
- `POST /api/games/resolve`
- `GET /api/stats/overview`
- `GET /api/prices/status`
- `GET /api/deals/best`
- `GET /api/top-games`
- `GET /api/admin/gog/status`
- `POST /api/admin/gog/catalog/search`
- `POST /api/admin/gog/catalog/discover`
- `POST /api/admin/gog/mappings`
- `POST /api/admin/gog/mappings/suggest`
- `POST /api/admin/gog/mappings/approve`
- `POST /api/admin/gog/prices/test`
- `POST /api/admin/gog/prices/refresh`
- `POST /api/admin/gog/prices/backfill-catalog`
- `GET /api/admin/steam-store-prices/status`
- `POST /api/admin/steam-store-prices/test`
- `POST /api/admin/steam-store-prices/refresh`
- `POST /api/admin/top-games/import`
- `POST /api/admin/top-games/refresh-players`
- `POST /api/admin/top-games/refresh-prices`
- `POST /api/admin/top-games/bootstrap`
- `POST /api/admin/automation/refresh-prices`
- `POST /api/admin/automation/backfill-catalog-prices`
- `GET|POST /api/cron/refresh-player-counts`
- `GET|POST /api/cron/refresh-prices`
- `GET|POST /api/cron/refresh-top-games`
- `GET|POST /api/cron/backfill-catalog-prices`
- `GET /api/admin/prices/mock-cleanup/preview`
- `POST /api/admin/prices/mock-cleanup/run`
- `GET /api/admin/maintenance/static-data/preview`
- `POST /api/admin/maintenance/static-data/run`

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

- `SteamCatalogEntry` is around 2000 rows.
- `Game` is around 20 rows.
- GOG is enabled; mappings are still manual approval only.
- GOG public output is hidden by default; admin GOG status/tools remain visible.
- TOP 100 Steam scope exists for practical daily tracking and scoring readiness.
- TOP 100 coverage tracks full score, insufficient data, no-player-data, no-price-data and public mock counts; public mock count should remain zero.
- Steam Store prices are enabled for small imported-game refreshes and catalog backfill.
- `CatalogStoreOffer` keeps catalog price backfill separate from imported `Game` rows.
- Steam Store no-price catalog checks count as `skippedNoPrice`, not `failed`, and retry only after cooldown.
- Stats mode is `mixed`.
- Search/import/details works.
- Categories work.
- Mock/demo prices are excluded from trusted rankings; production mock price rows have been cleaned when status shows zero mock offers/snapshots.
