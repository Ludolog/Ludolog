# GameValue Radar architecture map

This document maps the current production-oriented flow:

```text
Android/Web -> Vercel Next.js API -> Neon PostgreSQL -> Steam Web API -> Search/Stats/Home
```

The Android app is a client only. It never talks to Steam, Neon or Prisma directly, and it never receives backend secrets.

## Runtime layers

- Android mobile: `mobile/src/api/client.ts` reads public `VITE_API_BASE_URL`, uses `CapacitorHttp` on native Android and `fetch` in browser preview.
- Web frontend: Next.js pages call the same API routes or server-side services.
- API routes: `src/app/api/**` validate input, call services and return shared DTO shapes from `packages/shared/src/api-types.ts`.
- Services: search, import, Steam sync, player refresh, price providers, stats and scoring live in `src/lib/services`.
- Repository layer: `REPOSITORY_PROVIDER=mock` uses in-memory fixtures; `REPOSITORY_PROVIDER=prisma` uses Neon through Prisma.
- Database: Prisma stores imported games, Steam catalog entries, snapshots, offers, watchlist, alerts and integration logs.

## Environment split

- `DATABASE_URL`: pooled/pooler PostgreSQL URL for runtime queries on Vercel.
- `DIRECT_URL`: direct/unpooled PostgreSQL URL for Prisma migrations.
- `STEAM_WEB_API_KEY`: backend-only Steam key used by Steam catalog sync and live player count reads.
- `ADMIN_API_SECRET`: backend-only secret required by manual admin POST endpoints via `x-admin-secret`.
- `CRON_SECRET`: backend-only secret required by cron refresh endpoints in production.
- `PRICE_PROVIDER`: active default is `gamevalue`.
- `PRICE_MODE`: active default is `internal`.
- `ENABLE_LEGACY_PRICE_PROVIDERS`: must stay `false` unless a future legal/API-safe external adapter is intentionally enabled.
- `DATA_MODE`: `mock` uses deterministic fixtures; `api` enables API-oriented adapters with fallback logging.
- `REPOSITORY_PROVIDER`: `mock` or `prisma`.
- `VITE_API_BASE_URL`: public mobile backend URL. It is bundled into Android and must never contain secrets.

## Search flow

1. Mobile/web calls `GET /api/games/search?q=...`.
2. `GameSearchService.searchCatalog()` searches imported/library games first.
3. It searches `SteamCatalogEntry` in Neon through `repositories.steamCatalog.search()`.
4. If the synced catalog has no matches, it falls back to the local mock catalog.
5. Results are returned as `kind: "library"` or `kind: "catalog"` with `source: "database"`, `"steam-catalog"` or `"mock-catalog"`.
6. Library results can open details immediately. Catalog results are importable.

## Import game flow

1. UI posts `POST /api/games/import` with a simple body such as `{ "steamAppId": 570 }` or `{ "query": "Dota 2" }`.
2. `GameSearchService.importGame()` resolves the app from `SteamCatalogEntry` first, then mock fallback.
3. If the game already exists, the endpoint returns the existing summary with `created: false`, `source: "library"` and `imported: false`.
4. If missing, the repository creates `Game`, a Steam offer, initial price snapshot and initial player snapshots.
5. For `source: "steam-api"` imports, the backend attempts a current-player refresh after import.
6. The response includes `created`, `source`, `steamAppId`, `gameId`, `summary` and the backwards-compatible `imported` flag. Search then returns the imported game as `kind: "library"`.

## Bulk import flow

1. Admin calls `POST /api/admin/games/bulk-import` with `x-admin-secret`.
2. The body accepts `steamAppIds`, `queries`, `refreshPlayers` and `limit`; the route caps one request at 50 targets.
3. The service imports each game independently through the same catalog resolution path as public import.
4. Optional player refresh runs only for imported or existing games with a Steam App ID.
5. The response reports `imported`, `skipped`, `refreshed`, `failed`, per-game results and per-game errors. One failing target does not roll back successful imports.

## Steam catalog sync flow

1. Admin/web calls `POST /api/admin/steam-catalog/sync` with `x-admin-secret`.
2. The request body supports `dryRun`, `maxPages`, `maxResults` and optional `startAfterAppId`.
3. `SteamCatalogSyncService` calls `IStoreService/GetAppList/v1`.
4. `dryRun: true` fetches and reports counts without writing to Neon.
5. `dryRun: false` upserts by unique `steamAppId`, so repeated syncs update existing rows instead of duplicating them.
6. The result reports `lastAppId`; public status exposes `nextSteamCatalogStartAfterAppId` so small follow-up syncs can continue from the highest stored app id.
7. Errors are recorded as `IntegrationLog` entries and returned as safe messages. Secrets are never returned by status endpoints.

`maxResults` is a total cap for one sync request. If `maxResults` is `100`, the sync stops after 100 fetched entries even when `maxPages` is higher.

## Player count refresh flow

1. Admin calls `POST /api/admin/player-counts/refresh` with `x-admin-secret`, or cron calls `POST /api/cron/refresh-player-counts` with `CRON_SECRET`.
2. `PlayerCountRefreshService` resolves Steam App IDs from `watchlist`, `top`, `all-imported` or explicit `steamAppIds`.
3. `SteamApiService.refreshPlayerCount()` fetches current players from Steam when `DATA_MODE=api` and a Steam key is configured.
4. Successful refreshes append `PlayerCountSnapshot` rows with `source: "steam-api"`.
5. Failures are returned per Steam App ID and logged; cached/mock data can still keep the UI usable.

Public `GET /api/games/:id/players` can read current/cached player data, but it does not store a durable snapshot. Durable refreshes stay admin/cron controlled.

## GameValue Price API flow

1. Public clients read internal price data through `GET /api/prices/status`, `GET /api/games/:id/prices`, `GET /api/deals/best`, `GET /api/stats/best-value` and `GET /api/stats/overview`.
2. Admin writes use `POST /api/admin/prices/manual-offer`, `POST /api/admin/prices/import-json`, `POST /api/admin/prices/import-csv`, `POST /api/admin/prices/snapshot`, `POST /api/admin/prices/recalculate`, GOG admin routes and Steam Store price routes with `x-admin-secret`.
3. `GameValuePriceService` validates input, creates `Store` and `PriceSource` records when needed, upserts `StoreOffer` rows and appends `GamePriceSnapshot` rows.
4. Internal source names include `manual-admin`, `json-import`, `csv-import`, `mock-seed`, `gog` and experimental `steam-store`.
5. `sourceConfidence` separates `internal-real`, `experimental-store-api`, `internal-mock`, `external-legacy` and `no-price-data` for UI badges and analytics.
6. Legacy `/api/admin/prices/refresh`, `/api/admin/prices/refresh-best` and `/api/admin/prices/provider-diagnostics` return disabled responses and do not call external aggregators.
7. GG.deals, ITAD and CheapShark are not active providers. GG.deals was disabled after Vercel received Cloudflare challenge HTML instead of API JSON. The app does not bypass Cloudflare, scrape protected pages, use Playwright/Puppeteer, cookies, proxies or browser sessions.
8. The GOG connector is admin/backend-only, disabled by default and writes official DRM-free offers only after a manual `GameExternalMapping` exists.
9. The Steam Store price connector is admin/backend-only, disabled by default and writes official Steam offers only from JSON `appdetails` responses.
10. `GET /api/admin/prices/mock-cleanup/preview` reports old mock/demo price rows. `POST /api/admin/prices/mock-cleanup/run` requires `confirm=DELETE_MOCK_PRICE_DATA_ONLY` and deletes only mock price offers, mock price snapshots and mock price sources.

## Stats overview flow

1. Mobile/web calls `GET /api/stats/overview`.
2. `StatsService` loads game profiles, watchlists, catalog status and price/player snapshot counts.
3. It calculates top players, trending, drops, best value, watchlist popularity, hidden gems and categories.
4. It returns `mode: "real" | "mixed" | "mock"` based on real/mock player and price snapshot counts.
5. The overview includes `realInternalPriceSnapshots`, mock/real offer counts, player counts and price provider mode.
6. Home and Stats screens display `updatedAt`, source counts, player source badges, GameValue price source badges and category sections.

## Android diagnostics flow

1. Mobile reads runtime info from `apiClient.getRuntimeInfo()`.
2. Diagnostics calls `GET /api/admin/status` and `GET /api/stats/overview`.
3. It shows API base URL, HTTP transport, backend status, data mode, `priceProvider=gamevalue`, `priceMode=internal`, store/price-source counts, real internal price snapshots, mock price snapshots, GOG enabled/mapping/offer metrics, catalog count, imported count, real/mock player snapshot counts, last sync, last price snapshot, last player refresh and Capacitor platform.

## Fallback model

- `DATA_MODE=mock`: everything works from deterministic fixtures.
- `DATA_MODE=api` with missing Steam key: Steam calls are skipped, warnings are logged and cached/mock data is used.
- Legacy external price providers disabled: price reads continue from GameValue internal offers, GOG, Steam Store, snapshots and mock seed data.
- GOG connector disabled: public price reads continue from existing internal offers, Steam Store and existing stored data.
- Steam Store connector disabled: public price reads continue from existing internal offers, GOG and existing stored data.
- `REPOSITORY_PROVIDER=mock`: no Neon required.
- `REPOSITORY_PROVIDER=prisma`: API routes persist to Neon and use Prisma migrations/schema.

## Operational guardrails

- Do not put `STEAM_WEB_API_KEY`, `ADMIN_API_SECRET`, `CRON_SECRET`, `DATABASE_URL` or `DIRECT_URL` into mobile env files.
- Do not put external provider keys into mobile env files; only Vercel/backend can ever receive backend secrets.
- Do not bypass GG.deals Cloudflare challenges with browser automation, cookies, fake sessions, proxies or HTML scraping.
- Do not run a full Steam catalog sync automatically or from user traffic.
- Start with `dryRun: true`, `maxPages: 1`, `maxResults: 100`.
- Use `startAfterAppId` or the status cursor for controlled follow-up batches.
- Always run mock price cleanup preview before cleanup run.
- Keep Steam Store price refreshes as `dryRun=true` until status/test output confirms valid JSON-derived prices.
- Keep admin secrets in local form state or terminal environment only; do not commit them.
