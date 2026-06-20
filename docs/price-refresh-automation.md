# Price refresh automation

This document describes the production-safe refresh pipeline for GameValue Radar.

## Goals

- Refresh Steam Store prices for imported games in small batches.
- Refresh GOG prices only for approved mapped games.
- Backfill Steam and GOG catalog prices without importing the full catalog into `Game`.
- Refresh Steam player counts from backend-only cron/admin routes.
- Refresh the curated TOP 100 Steam scope without touching the full catalog.
- Expose freshness and source counts through public API responses.

The pipeline does not use GG.deals, ITAD, CheapShark, scraping, browser automation, cookies, sessions, proxies or Cloudflare bypasses.

## Data model

Tracked games use the existing price tables:

- `StoreOffer`
- `GamePriceSnapshot`
- `Store`
- `PriceSource`

Catalog-only Steam and GOG prices use:

- `CatalogStoreOffer`
- `CatalogPriceCheckStatus`

The curated daily production scope uses:

- `TopTrackedGame`

`CatalogStoreOffer` is intentionally separate from `Game`. It lets the backend store a small price backfill for synced catalog rows without creating thousands of tracked games. `CatalogPriceCheckStatus` records available/no-price/unavailable/unsupported/error cooldowns so the same no-price or unsupported item is not retried on every run. Public search can show catalog prices when present, while import still remains an intentional user/admin action.

`TopTrackedGame` is intentionally separate from `SteamCatalogEntry`. It stores the 100 Steam App IDs that are practical to keep fresh every day. TOP 100 refreshes may import missing tracked rows into `Game`, refresh current players and refresh Steam Store prices, but they must not expand into a full catalog refresh.

GOG catalog backfill reads stored `GogCatalogEntry` rows first. If GOG returns no price, or a fallback catalog lookup cannot find an already stored product, the run reports a skipped warning and leaves a cooldown instead of counting it as `failed`. Failed is reserved for technical lookup errors such as invalid JSON, HTTP/provider errors or network timeouts.

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

TOP_GAMES_REFRESH_ENABLED=true
TOP_GAMES_PLAYER_REFRESH_LIMIT=100
TOP_GAMES_PRICE_REFRESH_LIMIT=100
TOP_GAMES_STALE_PLAYER_HOURS=6
TOP_GAMES_STALE_PRICE_HOURS=12
```

Keep catalog backfill disabled by default. Run it manually with dry runs first, then enable the scheduled cron only when production behavior is stable.

## Cron endpoints

All cron endpoints require `CRON_SECRET` through `Authorization: Bearer ...` or `x-cron-secret`.

- `GET|POST /api/cron/refresh-player-counts`
- `GET|POST /api/cron/refresh-prices`
- `GET|POST /api/cron/refresh-top-games`
- `GET|POST /api/cron/backfill-catalog-prices`

Current `vercel.json` schedules:

- player counts once daily,
- imported/mapped price refresh once daily.
- TOP 100 player and Steam Store price refresh once daily.

Vercel Hobby accounts only allow daily cron frequency. Catalog backfill has a protected cron endpoint but is not scheduled by default. Run it manually from admin automation while `PRICE_REFRESH_CATALOG_BACKFILL_ENABLED=false`, then add a schedule later only after dry runs, production limits and plan constraints are understood.

## Admin endpoints

All admin endpoints below require `x-admin-secret`.

- `POST /api/admin/automation/refresh-prices`
- `POST /api/admin/automation/backfill-catalog-prices`
- `POST /api/admin/top-games/import`
- `POST /api/admin/top-games/refresh-players`
- `POST /api/admin/top-games/refresh-prices`
- `POST /api/admin/top-games/bootstrap`
- `POST /api/admin/steam-store-prices/refresh`
- `POST /api/admin/gog/mappings/suggest`
- `POST /api/admin/gog/mappings/approve`
- `POST /api/admin/gog/prices/refresh`
- `POST /api/admin/gog/prices/backfill-catalog`
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

```json
{ "limit": 100, "dryRun": true }
```

Real writes should stay capped and should follow a successful dry run.

GOG catalog backfill supports conservative product filters:

```json
{
  "limit": 10,
  "dryRun": true,
  "includeDlc": false,
  "includeSoundtracks": false,
  "includeBundles": false
}
```

If GOG returns USD while `GOG_CURRENCY=PLN`, store USD and surface `currencyMismatch=true`; do not convert currencies.

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
- Keep TOP 100 refreshes capped at 100 and do not reuse them as full catalog backfill.
- Do not store HTML or provider challenge pages as offers or snapshots.
- Count no-price catalog checks as skipped/no-price, not failed; failed is for technical errors.
- Count unavailable GOG catalog products and unsupported product types as skipped warnings with cooldowns, not failed.
- Do not delete `Game`, `SteamCatalogEntry`, `GogCatalogEntry`, `GameExternalMapping`, `PlayerCountSnapshot` or real price data during cleanup.
- Keep secrets in Vercel or local terminal sessions only.
- Use dry runs before `dryRun=false`.
