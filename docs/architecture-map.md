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
- Services: search, import, Steam sync, player refresh, stats and scoring live in `src/lib/services`.
- Repository layer: `REPOSITORY_PROVIDER=mock` uses in-memory fixtures; `REPOSITORY_PROVIDER=prisma` uses Neon through Prisma.
- Database: Prisma stores imported games, Steam catalog entries, snapshots, offers, watchlist, alerts and integration logs.

## Environment split

- `DATABASE_URL`: pooled/pooler PostgreSQL URL for runtime queries on Vercel.
- `DIRECT_URL`: direct/unpooled PostgreSQL URL for Prisma migrations.
- `STEAM_WEB_API_KEY`: backend-only Steam key used by Steam catalog sync and live player count reads.
- `ADMIN_API_SECRET`: backend-only secret required by manual admin POST endpoints via `x-admin-secret`.
- `CRON_SECRET`: backend-only secret required by cron refresh endpoints in production.
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

1. UI posts `POST /api/games/import` with a simple body such as `{ "steamAppId": 570 }`.
2. `GameSearchService.importGame()` resolves the app from `SteamCatalogEntry` first, then mock fallback.
3. If the game already exists, the endpoint returns the existing summary with `imported: false`.
4. If missing, the repository creates `Game`, a Steam offer, initial price snapshot and initial player snapshots.
5. For `source: "steam-api"` imports, the backend attempts a current-player refresh after import.
6. Search then returns the imported game as `kind: "library"`.

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
2. `PlayerCountRefreshService` resolves Steam App IDs from `watchlist`, `top` or `all-imported`.
3. `SteamApiService.refreshPlayerCount()` fetches current players from Steam when `DATA_MODE=api` and a Steam key is configured.
4. Successful refreshes append `PlayerCountSnapshot` rows with `source: "steam-api"`.
5. Failures are logged and cached/mock data can still keep the UI usable.

Public `GET /api/games/:id/players` can read current/cached player data, but it does not store a durable snapshot. Durable refreshes stay admin/cron controlled.

## Stats overview flow

1. Mobile/web calls `GET /api/stats/overview`.
2. `StatsService` loads game profiles, watchlists, catalog status and snapshot counts.
3. It calculates top players, trending, drops, best value, watchlist popularity, hidden gems and categories.
4. It returns `mode: "real" | "mixed" | "mock"` based on real/mock player snapshot counts.
5. Home and Stats screens display `updatedAt`, source counts and category sections.

## Android diagnostics flow

1. Mobile reads runtime info from `apiClient.getRuntimeInfo()`.
2. Diagnostics calls `GET /api/admin/status` and `GET /api/stats/overview`.
3. It shows API base URL, HTTP transport, backend status, data mode, catalog count, imported count, real/mock snapshot counts, last sync, last player refresh and Capacitor platform.

## Fallback model

- `DATA_MODE=mock`: everything works from deterministic fixtures.
- `DATA_MODE=api` with missing Steam key: Steam calls are skipped, warnings are logged and cached/mock data is used.
- `REPOSITORY_PROVIDER=mock`: no Neon required.
- `REPOSITORY_PROVIDER=prisma`: API routes persist to Neon and use Prisma migrations/schema.

## Operational guardrails

- Do not put `STEAM_WEB_API_KEY`, `ADMIN_API_SECRET`, `CRON_SECRET`, `DATABASE_URL` or `DIRECT_URL` into mobile env files.
- Do not run a full Steam catalog sync automatically or from user traffic.
- Start with `dryRun: true`, `maxPages: 1`, `maxResults: 100`.
- Use `startAfterAppId` or the status cursor for controlled follow-up batches.
- Keep admin secrets in local form state or terminal environment only; do not commit them.
