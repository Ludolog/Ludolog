# GameValue Radar deployment

Target production architecture:

```text
Android App -> Vercel Next.js API -> Neon PostgreSQL
```

The Android app stays a client. The backend, Prisma and PostgreSQL are not packaged into the APK.

## Vercel deployment

1. Open Vercel.
2. Choose `Add New -> Project`.
3. Import the GitHub repository `gamevalue-radar`.
4. Keep framework preset as `Next.js`.
5. Add environment variables in Vercel Project Settings:

```env
DATABASE_URL="postgresql://neondb_owner:TWOJE_HASLO@ep-muddy-dust-as4vb87r-pooler.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://neondb_owner:TWOJE_HASLO@ep-muddy-dust-as4vb87r.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require"
REPOSITORY_PROVIDER=prisma
DATA_MODE=api
NEXT_PUBLIC_APP_URL=https://apka-seven.vercel.app
MOBILE_ALLOWED_ORIGINS=https://apka-seven.vercel.app,capacitor://localhost
STEAM_WEB_API_KEY=
ADMIN_API_SECRET=
CRON_SECRET=
PRICE_PROVIDER=gamevalue
PRICE_MODE=internal
ENABLE_LEGACY_PRICE_PROVIDERS=false
```

Use the pooled Neon host for `DATABASE_URL` and the direct Neon host for `DIRECT_URL`. Replace `TWOJE_HASLO` only inside Vercel settings or local ignored env files.

6. Start the deployment.
   After changing `STEAM_WEB_API_KEY`, `PRICE_PROVIDER`, `PRICE_MODE`, `ADMIN_API_SECRET`, `CRON_SECRET` or `DATA_MODE`, trigger a new deployment from
   `Project -> Deployments -> Redeploy`. Vercel does not apply changed environment variables to an already-running
   deployment.
7. After deployment, check:

```text
https://apka-seven.vercel.app
https://apka-seven.vercel.app/api/admin/status
https://apka-seven.vercel.app/api/games/search?q=cyberpunk&limit=16&offset=0
https://apka-seven.vercel.app/api/deals/best
```

If Prisma migrations were not executed yet, run them locally against Neon with the ignored `.env.local` file configured:

```bash
npm run db:migrate:deploy
npm run db:seed
```

Do not run destructive commands such as `prisma migrate reset` against Neon without an explicit backup and approval.

## 1. Create a Neon PostgreSQL database

1. Create a Neon project.
2. Create a PostgreSQL database, for example `gamevalue_radar`.
3. Copy the pooled connection string for runtime usage.
4. Copy the direct connection string for migrations.

Recommended variables:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/gamevalue_radar?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/gamevalue_radar?sslmode=require"
```

Use `DATABASE_URL` for the app runtime and `DIRECT_URL` for Prisma migrations. Do not commit either value.

## 2. Configure Vercel environment variables

Set these in Vercel Project Settings -> Environment Variables:

```env
DATA_MODE=api
REPOSITORY_PROVIDER=prisma
DATABASE_URL=...
DIRECT_URL=...
NEXT_PUBLIC_APP_URL=https://apka-seven.vercel.app
MOBILE_ALLOWED_ORIGINS=https://apka-seven.vercel.app,capacitor://localhost
STEAM_WEB_API_KEY=
# Legacy fallback name is still accepted, but new environments should use STEAM_WEB_API_KEY.
STEAM_API_KEY=
ADMIN_API_SECRET=
CRON_SECRET=
PRICE_PROVIDER=gamevalue
PRICE_MODE=internal
GOG_ENABLED=false
GOG_API_BASE_URL=https://api.gog.com
GOG_CATALOG_BASE_URL=https://catalog.gog.com
GOG_COUNTRY_CODE=PL
GOG_CURRENCY=PLN
GOG_REQUEST_LIMIT_PER_HOUR=200
ENABLE_LEGACY_PRICE_PROVIDERS=false
# Legacy fallbacks:
PRICE_API_PROVIDER=gamevalue
PRICE_API_KEY=
ISTHEREANYDEAL_API_KEY=
GG_DEALS_API_KEY=
```

Notes:

- `REPOSITORY_PROVIDER=prisma` makes API routes use PostgreSQL through Prisma repositories.
- `DATA_MODE=api` enables API-oriented adapters. If Steam is missing or fails, backend services still fall back to cached/mock data.
- `MOBILE_ALLOWED_ORIGINS` should be explicit in production. Do not use `*`.
- `STEAM_WEB_API_KEY` is backend-only. It enables real Steam catalog sync and real current-player refreshes.
- `PRICE_PROVIDER=gamevalue` and `PRICE_MODE=internal` enable the internal GameValue Price API.
- `GOG_ENABLED=false` keeps the GOG connector disabled until you explicitly test it. When enabled, it reads public GOG
  JSON endpoints in small backend-only batches and writes `sourceName=gog` official-store offers into the internal price
  tables.
- `GOG_REQUEST_LIMIT_PER_HOUR` is capped at 200 in code. Keep manual refresh limits small and do not run mass syncs.
- GG.deals, ITAD and CheapShark are legacy/disabled providers in active production flow. Do not set them as active providers unless a future legal/API-safe integration is added intentionally.
- GG.deals was disabled after Vercel received Cloudflare challenge HTML instead of API JSON. Do not bypass Cloudflare with browser sessions, cookies, Playwright/Puppeteer, proxies or scraping, and do not store raw HTML as price data.
- Admin price writes use internal sources such as `manual-admin`, `json-import`, `csv-import`, `mock-seed` and future legal partner/store feeds.
- `ADMIN_API_SECRET` protects manual admin POST endpoints through the `x-admin-secret` header.
- `CRON_SECRET` protects `/api/cron/refresh-player-counts` in production. Do not expose it to mobile.
- Mobile public config uses `VITE_API_BASE_URL`; secrets must never use the `VITE_` prefix.

## 3. Deploy to Vercel

The repository includes `vercel.json` and a `postinstall` script that runs `prisma generate`.

Typical flow:

```bash
npm install
npm run build
```

Vercel will run install and build automatically after connecting the repository.

## 4. Run Prisma migrations

Create and review migrations locally. Deploy migrations to Neon with:

```bash
npm run db:migrate:deploy
```

Run this with `DATABASE_URL` and `DIRECT_URL` pointing at Neon. Do not run destructive reset commands on production.

The first migration is stored in:

```text
prisma/migrations/000001_init/migration.sql
```

The Steam catalog migration is stored in:

```text
prisma/migrations/000002_steam_catalog/migration.sql
```

The price provider metadata migration is stored in:

```text
prisma/migrations/000003_price_provider_metadata/migration.sql
```

The GameValue Price API schema migration is stored in:

```text
prisma/migrations/000004_gamevalue_price_api/migration.sql
```

The GOG connector schema migration is stored in:

```text
prisma/migrations/000005_gog_connector/migration.sql
```

## 5. Seed demo data

For a demo production database:

```bash
npm run db:seed
```

Use seed only when you intentionally want demo games/offers/watchlist data in that database.

## 6. Verify deployed API

After Vercel deployment and migration:

```text
https://apka-seven.vercel.app/api/admin/status
https://apka-seven.vercel.app/api/deals/best
https://apka-seven.vercel.app/api/games/search?q=cyberpunk
https://apka-seven.vercel.app/api/games/dota-2/prices
https://apka-seven.vercel.app/api/stats/overview
https://apka-seven.vercel.app/api/categories/overview
https://apka-seven.vercel.app/api/categories/popularne-teraz
https://apka-seven.vercel.app/api/admin/steam-catalog/status
https://apka-seven.vercel.app/api/admin/gog/status
```

`/api/admin/status` should show non-zero game and snapshot counts after seed.

## 7. Configure Android production API

Production Android builds should call Vercel:

```env
VITE_API_BASE_URL=https://apka-seven.vercel.app
```

Create `mobile/.env.production` from `mobile/.env.production.example`, then build:

```bash
npm run mobile:build:prod
npm run mobile:sync:prod
npm run android:build
```

`mobile/.env.production` is ignored by Git and must not be committed. It may contain only public mobile values such as `VITE_API_BASE_URL`. Do not add `DATABASE_URL`, `DIRECT_URL`, Neon credentials, API keys, signing secrets or Firebase secrets to the mobile app.

The production fallback in code is also `https://apka-seven.vercel.app`, so production builds do not fall back to `10.0.2.2`, `localhost` or `127.0.0.1`.

## Expanded search and Steam Stats deployment notes

The Vercel backend owns Steam catalog sync, search fallback, game taxonomy, player-count refreshes and stats aggregation. Mobile builds only receive the public `VITE_API_BASE_URL`.

Useful production checks after deploy:

```text
https://apka-seven.vercel.app/api/games/search?q=palworld&limit=16&offset=0
https://apka-seven.vercel.app/api/stats/overview
https://apka-seven.vercel.app/api/categories/overview
https://apka-seven.vercel.app/api/stats/top-players
https://apka-seven.vercel.app/api/stats/best-value
https://apka-seven.vercel.app/api/admin/steam-catalog/status
```

If `STEAM_WEB_API_KEY`, legacy `STEAM_API_KEY` or provider-specific API keys are not configured, the app continues in mock/fallback mode and records integration logs. Never add those secrets to `mobile/.env.production` or any committed file.

Before real Steam sync, confirm this endpoint:

```text
https://apka-seven.vercel.app/api/admin/steam-catalog/status
```

It should expose only booleans and counts, for example `hasSteamApiKey`, `dataMode`, `canUseRealSteamApi`,
`steamCatalogEntryCount`, `lastSteamCatalogSync`, `nextSteamCatalogStartAfterAppId` and recent integration logs. It must never return the actual
`STEAM_WEB_API_KEY`, `ADMIN_API_SECRET` or `CRON_SECRET`.

Manual Steam catalog sync in PowerShell. Paste the real admin secret only into your local terminal, never into code:

```powershell
$headers = @{
  "Content-Type" = "application/json"
  "x-admin-secret" = "TU_WKLEJ_ADMIN_API_SECRET_LOKALNIE"
}

$body = '{"dryRun":true,"maxPages":1,"maxResults":100}'

Invoke-WebRequest -Uri "https://apka-seven.vercel.app/api/admin/steam-catalog/sync" -Method POST -Headers $headers -Body $body
```

After verifying the dry run, run a small real write sync:

```powershell
$body = '{"dryRun":false,"maxPages":1,"maxResults":100}'

Invoke-WebRequest -Uri "https://apka-seven.vercel.app/api/admin/steam-catalog/sync" -Method POST -Headers $headers -Body $body
```

Start with `maxResults=100`. If Vercel and Neon stay stable, increase cautiously to 500 and then 1000 in later manual runs.
`maxResults` is the total cap for a sync request. If `maxResults=100`, the request stops after 100 entries even when
`maxPages` is higher. For follow-up batches, read `nextSteamCatalogStartAfterAppId` from status and pass it as
`startAfterAppId`:

```powershell
$status = Invoke-RestMethod -Uri "https://apka-seven.vercel.app/api/admin/steam-catalog/status"
$payload = @{
  dryRun = $true
  maxPages = 1
  maxResults = 100
}

if ($status.nextSteamCatalogStartAfterAppId) {
  $payload.startAfterAppId = $status.nextSteamCatalogStartAfterAppId
}

$body = $payload | ConvertTo-Json
```

Manual player-count refresh:

```powershell
$body = '{"mode":"top","limit":25}'

Invoke-WebRequest -Uri "https://apka-seven.vercel.app/api/admin/player-counts/refresh" -Method POST -Headers $headers -Body $body
```

GameValue Price API status:

```powershell
Invoke-WebRequest -Uri "https://apka-seven.vercel.app/api/prices/status" | ConvertFrom-Json
```

Mock price cleanup preview. Run this before any destructive cleanup and review the counts/examples:

```powershell
Invoke-WebRequest -Uri "https://apka-seven.vercel.app/api/admin/prices/mock-cleanup/preview" -Headers $headers | ConvertFrom-Json
```

The destructive cleanup endpoint requires the exact confirmation phrase. Do not run it until the preview report is approved:

```powershell
$body = @{ confirm = "DELETE_MOCK_PRICE_DATA_ONLY" } | ConvertTo-Json -Compress

Invoke-WebRequest -Uri "https://apka-seven.vercel.app/api/admin/prices/mock-cleanup/run" -Method POST -Headers $headers -ContentType "application/json" -Body $body
```

Manual offer for Dota 2:

```powershell
$body = @{
  steamAppId = 570
  storeName = "Steam"
  storeType = "official"
  price = 0
  regularPrice = 0
  currency = "PLN"
  externalUrl = "https://store.steampowered.com/app/570"
  region = "PL"
  drm = "Steam"
  isOfficialStore = $true
  available = $true
} | ConvertTo-Json -Compress

Invoke-WebRequest -Uri "https://apka-seven.vercel.app/api/admin/prices/manual-offer" -Method POST -Headers $headers -ContentType "application/json" -Body $body
```

JSON price import:

```powershell
$body = @{
  sourceName = "manual-json-import"
  offers = @(
    @{
      steamAppId = 570
      storeName = "Steam"
      storeType = "official"
      price = 0
      regularPrice = 0
      currency = "PLN"
      externalUrl = "https://store.steampowered.com/app/570"
      region = "PL"
      drm = "Steam"
      isOfficialStore = $true
      available = $true
    }
  )
} | ConvertTo-Json -Compress

Invoke-WebRequest -Uri "https://apka-seven.vercel.app/api/admin/prices/import-json" -Method POST -Headers $headers -ContentType "application/json" -Body $body
```

Use `POST /api/admin/prices/snapshot` to append a snapshot from current tracked offers and `POST /api/admin/prices/recalculate` to rebuild snapshots for imported games. Legacy `/api/admin/prices/refresh`, `/api/admin/prices/refresh-best` and `/api/admin/prices/provider-diagnostics` return disabled responses and do not call external aggregators.

Experimental Steam Store price connector envs. Keep it disabled until ready to test:

```text
STEAM_STORE_PRICE_ENABLED=false
STEAM_STORE_API_BASE_URL=https://store.steampowered.com/api
STEAM_STORE_COUNTRY=PL
STEAM_STORE_CURRENCY=PLN
STEAM_STORE_PRICE_CACHE_TTL_MINUTES=360
STEAM_STORE_PRICE_MAX_PER_RUN=20
```

Steam Store status and Dota 2 dry run:

```powershell
Invoke-WebRequest -Uri "https://apka-seven.vercel.app/api/admin/steam-store-prices/status" | ConvertFrom-Json

$body = @{ steamAppIds = @(570); limit = 1; dryRun = $true } | ConvertTo-Json -Compress

Invoke-WebRequest -Uri "https://apka-seven.vercel.app/api/admin/steam-store-prices/refresh" -Method POST -Headers $headers -ContentType "application/json" -Body $body
```

Do not set `dryRun=false` until `STEAM_STORE_PRICE_ENABLED=true` is deployed and the dry run shows valid JSON-derived price data.

Starter import from the already synced Steam catalog. Keep this as a small, intentional batch; it does not run a full catalog import:

```powershell
$starterAppIds = @(730,570,578080,1172470,1091500,292030,1086940,1245620,105600,413150,227300,252490,230410,1085660,440,892970,108600,275850,381210,238960)
$body = @{
  steamAppIds = $starterAppIds
  refreshPlayers = $true
  limit = 20
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://apka-seven.vercel.app/api/admin/games/bulk-import" -Method POST -Headers $headers -Body $body
```

Refresh only imported games:

```powershell
$body = '{"mode":"all-imported","limit":20}'

Invoke-WebRequest -Uri "https://apka-seven.vercel.app/api/admin/player-counts/refresh" -Method POST -Headers $headers -Body $body
```

Refresh explicit Steam App IDs:

```powershell
$body = '{"steamAppIds":[570,730],"limit":2}'

Invoke-WebRequest -Uri "https://apka-seven.vercel.app/api/admin/player-counts/refresh" -Method POST -Headers $headers -Body $body
```

`POST /api/admin/games/bulk-import` reports each imported, skipped and failed game independently. A failed Steam App ID does not roll back the rest of the batch.

Cron readiness:

- `POST /api/cron/refresh-player-counts` is ready for a future Vercel Cron job.
- In production it requires `CRON_SECRET` through the `x-cron-secret` or `authorization: Bearer ...` header.
- Do not refresh the entire Steam catalog on every user request or every build. Catalog sync is manual/admin-only at this stage, and player-count refreshes are capped to small batches.

## 8. Build debug APK

For emulator/local development:

```bash
npm run android:build:debug
```

The debug build allows HTTP so it can call `http://10.0.2.2:3000`.

Do not use `npm run android:build:debug` when you are intentionally preparing an APK that should talk to the production Vercel API, because that script rebuilds and syncs the development mobile bundle.

## 9. Release AAB later

Release signing is not configured in this repository. To prepare a Play Store-ready release later:

1. Set `mobile/.env.production` to `https://apka-seven.vercel.app`.
2. Run `npm run mobile:sync:prod`.
3. Configure signing keys in Android Studio or Gradle.
4. Build a signed AAB from Android Studio.

## 10. Known limitations

- No production auth yet; the MVP still uses a demo user model.
- Alerts are stored and checked by backend logic, but no real push notifications are sent.
- Offline cache is not implemented in the Android client.
- `REPOSITORY_PROVIDER=prisma` expects migrations and seed data to exist in Neon.
- Recharts increases mobile bundle size; route-level code splitting can be added later.

## 11. Future Firestore migration plan

Do not migrate now. The repository layer is prepared so future work can add:

- `FirebaseGameRepository`,
- `FirebaseWatchlistRepository`,
- `FirebaseAlertRepository`,
- `FirebaseSnapshotRepository`.

The API and Android contracts should remain stable while repository implementations change behind the service layer.
