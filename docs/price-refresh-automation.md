# Price refresh automation

This document describes the production-safe refresh pipeline for GameValue Radar.

## Goals

- Refresh Steam Store prices for imported games in small batches.
- Refresh GOG prices only for approved mapped games.
- Backfill Steam catalog prices without importing the full catalog into `Game`.
- Refresh Steam player counts from backend-only cron/admin routes.
- Expose freshness and source counts through public API responses.

The pipeline does not use GG.deals, ITAD, CheapShark, scraping, browser automation, cookies, sessions, proxies or Cloudflare bypasses.

## Data model

Tracked games use the existing price tables:

- `StoreOffer`
- `GamePriceSnapshot`
- `Store`
- `PriceSource`

Catalog-only Steam prices use:

- `CatalogStoreOffer`

`CatalogStoreOffer` is intentionally separate from `Game`. It lets the backend store a small price backfill for synced `SteamCatalogEntry` rows without creating thousands of tracked games. Public search can show catalog prices when present, while import still remains an intentional user/admin action.

## Environment variables

```env
PRICE_REFRESH_ENABLED=true
PRICE_REFRESH_IMPORTED_LIMIT=20
PRICE_REFRESH_STEAM_STORE_LIMIT=20
PRICE_REFRESH_GOG_LIMIT=10
PRICE_REFRESH_CATALOG_BACKFILL_ENABLED=false
PRICE_REFRESH_CATALOG_BACKFILL_LIMIT=10
PRICE_REFRESH_MAX_RUNTIME_MS=25000

PLAYER_COUNT_REFRESH_LIMIT=25
PLAYER_COUNT_REFRESH_MAX_RUNTIME_MS=25000
PLAYER_COUNT_STALE_MINUTES=30

STEAM_STORE_PRICE_STALE_HOURS=6
GOG_PRICE_STALE_HOURS=12
CATALOG_PRICE_STALE_HOURS=168
```

Keep catalog backfill disabled by default. Run it manually with dry runs first, then enable the scheduled cron only when production behavior is stable.

## Cron endpoints

All cron endpoints require `CRON_SECRET` through `Authorization: Bearer ...` or `x-cron-secret`.

- `GET|POST /api/cron/refresh-player-counts`
- `GET|POST /api/cron/refresh-prices`
- `GET|POST /api/cron/backfill-catalog-prices`

Current `vercel.json` schedules:

- player counts every 30 minutes,
- imported/mapped price refresh every 6 hours.

Catalog backfill has a protected cron endpoint but is not scheduled by default. Run it manually from admin automation while `PRICE_REFRESH_CATALOG_BACKFILL_ENABLED=false`, then add a schedule later only after dry runs and production limits are understood.

## Admin endpoints

All admin endpoints below require `x-admin-secret`.

- `POST /api/admin/automation/refresh-prices`
- `POST /api/admin/automation/backfill-catalog-prices`
- `POST /api/admin/steam-store-prices/refresh`
- `POST /api/admin/gog/mappings/suggest`
- `POST /api/admin/gog/mappings/approve`
- `POST /api/admin/gog/prices/refresh`
- `POST /api/admin/player-counts/refresh`

Safe dry run examples:

```json
{ "dryRun": true, "includeCatalogBackfill": false }
```

```json
{ "dryRun": true }
```

```json
{ "mode": "catalog-backfill", "limit": 10, "dryRun": true }
```

Real writes should stay capped and should follow a successful dry run.

## Freshness

Freshness is exposed in:

- `GET /api/games/search`
- `GET /api/games/:id/prices`
- `GET /api/stats/overview`
- `GET /api/prices/status`
- `GET /api/admin/status`

Public search results can include `catalogOffer`, `freshness`, `nextRefreshAt`, `dataSource` and `confidence` for catalog rows. Game price responses include the latest price refresh timestamp and next expected refresh time.

## Guardrails

- Do not run mass refreshes across all 2000 catalog entries.
- Do not store HTML or provider challenge pages as offers or snapshots.
- Do not delete `Game`, `SteamCatalogEntry`, `GogCatalogEntry`, `GameExternalMapping`, `PlayerCountSnapshot` or real price data during cleanup.
- Keep secrets in Vercel or local terminal sessions only.
- Use dry runs before `dryRun=false`.
