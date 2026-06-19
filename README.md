# GameValue Radar

GameValue Radar is a web MVP for an engineering thesis: a decision support system for PC game purchases. It combines game metadata, store offers, price history, Steam player activity, a custom GameValue Score and a recommendation such as `Kup teraz`, `Warto poczekać` or `Słaba okazja`.

The project is educational and is not officially affiliated with Steam, Valve, GG.deals or SteamDB. It does not scrape SteamDB, GG.deals or Steam Store HTML.

## Tech stack

- Next.js App Router, TypeScript, Tailwind CSS
- API routes in the same Next.js project
- PostgreSQL model with Prisma
- Recharts for price and player-count charts
- Zod validation
- Vitest tests
- Mock/API adapter mode via `DATA_MODE`

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The application works in `DATA_MODE=mock` without external API keys or a database connection. Prisma and PostgreSQL are prepared for persistent storage and seeding.

## Android mobile client

The Android MVP lives in `mobile/`. It is a Capacitor client that calls the existing Next.js API; it does not package the backend, Prisma or PostgreSQL into the APK.

Useful commands:

```bash
npm install --prefix mobile
npm run mobile:build
npm run mobile:sync
npm run android:open
npm run android:run
npm run android:build
```

For Android emulator, set `mobile/.env.local` to:

```env
VITE_API_BASE_URL=http://10.0.2.2:3000
```

Full instructions are in [docs/android.md](docs/android.md).

## Production deployment

Target production architecture:

```text
Android App -> Vercel Next.js API -> Neon PostgreSQL
```

Deployment instructions are in [docs/deployment.md](docs/deployment.md). The current data-flow map is in
[docs/architecture-map.md](docs/architecture-map.md).

## PostgreSQL and Prisma

Start PostgreSQL with Docker:

```bash
docker compose up -d
npm run prisma:generate
npm run db:push
npm run db:seed
```

Important environment variables:

```env
DATA_MODE=mock
REPOSITORY_PROVIDER=mock
DATABASE_URL="postgresql://gamevalue:gamevalue@localhost:5432/gamevalue_radar?schema=public"
DIRECT_URL="postgresql://gamevalue:gamevalue@localhost:5432/gamevalue_radar?schema=public"
# Backend-only Steam Web API key. Never expose this to mobile.
STEAM_WEB_API_KEY=""
# Legacy name accepted for backward compatibility; prefer STEAM_WEB_API_KEY.
STEAM_API_KEY=""
ADMIN_API_SECRET=""
PRICE_PROVIDER="gamevalue"
PRICE_MODE="internal"
ENABLE_LEGACY_PRICE_PROVIDERS="false"
# Legacy fallbacks:
PRICE_API_PROVIDER="gamevalue"
PRICE_API_KEY=""
ISTHEREANYDEAL_API_KEY=""
GG_DEALS_API_KEY=""
MOBILE_ALLOWED_ORIGINS="capacitor://localhost,http://localhost,http://localhost:5173,http://127.0.0.1:5173"
CRON_SECRET=""
```

## Data modes

`DATA_MODE=mock`

- uses deterministic demo fixtures,
- all views, charts and endpoints work without keys,
- no external requests are required.

`DATA_MODE=api`

- adapters try API-oriented behavior where possible,
- missing keys or provider errors are logged in the admin dashboard,
- the app falls back to mock data instead of crashing.

## API endpoints

- `GET /api/games/search?q=&limit=&offset=`
- `POST /api/games/import`
- `POST /api/games/resolve`
- `GET /api/games/:id`
- `GET /api/games/:id/prices`
- `GET /api/games/:id/players`
- `POST /api/games/:id/refresh`
- `GET /api/deals/best`
- `GET /api/prices/status`
- `GET /api/stats/overview`
- `GET /api/stats/steam`
- `GET /api/stats/categories`
- `GET /api/categories/overview`
- `GET /api/categories/:slug`
- `GET /api/stats/trending`
- `GET /api/stats/top-players`
- `GET /api/stats/best-value`
- `GET /api/admin/steam-catalog/status`
- `POST /api/admin/steam-catalog/sync`
- `POST /api/admin/steam-catalog/sync-until`
- `POST /api/admin/games/bulk-import`
- `GET /api/admin/prices/status`
- `POST /api/admin/prices/manual-offer`
- `POST /api/admin/prices/import-json`
- `POST /api/admin/prices/import-csv`
- `GET /api/admin/prices/mock-cleanup/preview`
- `POST /api/admin/prices/mock-cleanup/run`
- `POST /api/admin/prices/snapshot`
- `POST /api/admin/prices/recalculate`
- `POST /api/admin/prices/refresh` (legacy disabled)
- `POST /api/admin/prices/refresh-best` (legacy disabled)
- `POST /api/admin/prices/provider-diagnostics` (legacy disabled)
- `POST /api/admin/player-counts/refresh`
- `GET /api/admin/steam-store-prices/status`
- `POST /api/admin/steam-store-prices/test`
- `POST /api/admin/steam-store-prices/refresh`
- `POST /api/games/:id/refresh-players`
- `POST /api/cron/refresh-player-counts`
- `GET /api/watchlist`
- `POST /api/watchlist`
- `DELETE /api/watchlist/:id`
- `POST /api/alerts`
- `GET /api/admin/status`

## GameValue Score

The scoring algorithm is implemented in `src/lib/services/deal-score-service.ts`. It returns a 0-100 score, factor breakdown and recommendation.

## Expanded search and Steam Stats

Search now combines local database results, synced Steam catalog entries stored in PostgreSQL and the larger mock fallback catalog. Results are ordered as library, Steam catalog, then mock fallback, and `GET /api/games/search?q=&limit=&offset=` returns pagination metadata (`total`, `nextOffset`). If a result is already stored, clients can open its profile immediately. If it only exists in the catalog, the client can call `POST /api/games/import` with a `steamAppId`, `query` or legacy `slug`; the backend creates the game, attempts a current-player refresh and keeps the import working even when Steam is unavailable. The response includes `created`, `source`, `steamAppId`, `gameId`, `summary` and the backwards-compatible `imported` flag. UI components never hardcode the catalog.

Steam Stats are exposed through `GET /api/stats/overview`. The overview includes top current players, trending up/down, best value, free-to-play games, tracked deals, watchlist popularity, hidden gems, genre categories, missing-data hints, data freshness and source counts. Trends are calculated from the latest two `PlayerCountSnapshot` records. If live Steam data is unavailable, the app uses mock snapshots and logs the fallback.

Game taxonomy is built server-side by `CategoryRankingService` and `GameTagNormalizer`. It uses `Game.genres`, known Steam App ID fallback mappings and data-source/price status to return production-friendly categories through `GET /api/categories/overview`, `GET /api/categories/:slug` and `GET /api/stats/categories`. Current category groups include Popularne teraz, Największy wzrost graczy, Największy spadek graczy, Najlepsza wartość, Darmowe gry, Gry premium, Ceny śledzone, Brak danych cenowych, Real player data, Dane mieszane, Dane demonstracyjne and genre categories such as Action, RPG, Strategy, Simulation, Indie, Multiplayer, Co-op, Survival, Shooter, Sports/Racing, Management, Sandbox, Horror and Adventure.

Android never calls Steam directly and never receives API keys. The mobile app calls the Vercel/Next.js API, and backend services own Steam catalog sync and player-count refreshes.

## GameValue Price API

The active price module is internal:

- `PRICE_PROVIDER=gamevalue`
- `PRICE_MODE=internal`
- `ENABLE_LEGACY_PRICE_PROVIDERS=false`

GG.deals, ITAD and CheapShark are legacy/disabled providers in the active application flow. GG.deals was disabled because Vercel received Cloudflare challenge HTML instead of API JSON. The project does not bypass Cloudflare, scrape protected pages, use Playwright/Puppeteer, cookies, proxies or browser sessions.

Price data now enters through GameValue-controlled sources: `manual-admin`, `csv-import`, `json-import`, `gog`, `steam-store`, `mock-seed` and future legal store APIs. `StoreOffer` stores current tracked offers, `Store` stores normalized store metadata, `PriceSource` stores the ingest source, and `GamePriceSnapshot` stores durable price history for charts, deals and GameValue Score.

Public summaries and scoring prefer real/internal sources in this order: GOG, Steam Store, manual/internal. Mock price rows can remain in historical storage until cleanup, but they are not treated as normal live prices in public deal summaries.

The first store connector is GOG. It is backend-only, disabled by default and feeds the same internal price tables with
`sourceName=gog`, `sourceType=store-api`, `storeName=GOG`, `storeType=official` and `drm=DRM-free`. It uses public GOG JSON
API responses only. It does not scrape HTML, bypass Cloudflare, use browser sessions, cookies, Playwright/Puppeteer or
proxies, and it rejects non-JSON responses instead of storing them.

GOG configuration:

```env
GOG_ENABLED=false
GOG_API_BASE_URL=https://api.gog.com
GOG_CATALOG_BASE_URL=https://catalog.gog.com
GOG_COUNTRY_CODE=PL
GOG_CURRENCY=PLN
GOG_REQUEST_LIMIT_PER_HOUR=200
```

The experimental Steam Store connector is also backend-only and disabled by default. It uses the official Steam Store
`appdetails` JSON endpoint, rejects non-JSON responses and writes `sourceName=steam-store`,
`sourceType=store-api-experimental`, `storeName=Steam`, `storeType=official` and `drm=Steam` only after an admin call.

Steam Store configuration:

```env
STEAM_STORE_PRICE_ENABLED=false
STEAM_STORE_API_BASE_URL=https://store.steampowered.com/api
STEAM_STORE_COUNTRY=PL
STEAM_STORE_CURRENCY=PLN
STEAM_STORE_PRICE_CACHE_TTL_MINUTES=360
STEAM_STORE_PRICE_MAX_PER_RUN=20
```

Public price endpoints:

- `GET /api/prices/status`
- `GET /api/games/:id/prices`
- `GET /api/deals/best`
- `GET /api/stats/best-value`
- `GET /api/stats/overview`

Admin price operations require `x-admin-secret`:

```bash
curl -X POST https://apka-seven.vercel.app/api/admin/prices/manual-offer \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: TU_WKLEJ_ADMIN_API_SECRET_LOKALNIE" \
  -d "{\"steamAppId\":570,\"storeName\":\"Steam\",\"storeType\":\"official\",\"price\":0,\"regularPrice\":0,\"currency\":\"PLN\",\"externalUrl\":\"https://store.steampowered.com/app/570\",\"region\":\"PL\",\"drm\":\"Steam\",\"isOfficialStore\":true,\"available\":true}"

curl -X POST https://apka-seven.vercel.app/api/admin/prices/import-json \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: TU_WKLEJ_ADMIN_API_SECRET_LOKALNIE" \
  -d "{\"sourceName\":\"manual-json-import\",\"offers\":[{\"steamAppId\":570,\"storeName\":\"Steam\",\"price\":0,\"regularPrice\":0,\"currency\":\"PLN\",\"externalUrl\":\"https://store.steampowered.com/app/570\"}]}"

curl -X POST https://apka-seven.vercel.app/api/admin/prices/snapshot \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: TU_WKLEJ_ADMIN_API_SECRET_LOKALNIE" \
  -d "{\"steamAppId\":570,\"sourceName\":\"manual-admin\"}"

curl -X POST https://apka-seven.vercel.app/api/admin/prices/recalculate \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: TU_WKLEJ_ADMIN_API_SECRET_LOKALNIE"
```

Legacy `/api/admin/prices/refresh`, `/api/admin/prices/refresh-best` and `/api/admin/prices/provider-diagnostics` return disabled responses and do not call external aggregators.

Mock price cleanup is guarded and should always start with preview:

```bash
curl https://apka-seven.vercel.app/api/admin/prices/mock-cleanup/preview \
  -H "x-admin-secret: TU_WKLEJ_ADMIN_API_SECRET_LOKALNIE"

curl -X POST https://apka-seven.vercel.app/api/admin/prices/mock-cleanup/run \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: TU_WKLEJ_ADMIN_API_SECRET_LOKALNIE" \
  -d "{\"confirm\":\"DELETE_MOCK_PRICE_DATA_ONLY\"}"
```

The cleanup deletes only mock/demo `StoreOffer`, `GamePriceSnapshot` and mock `PriceSource` rows. It keeps `Game`,
`SteamCatalogEntry`, `GogCatalogEntry`, `GameExternalMapping` and all player snapshots.

GOG admin operations:

- `GET /api/admin/gog/status`
- `GET /api/admin/gog/mappings` with `x-admin-secret`
- `POST /api/admin/gog/mappings` with `x-admin-secret`
- `POST /api/admin/gog/resolve-game` with `x-admin-secret`
- `POST /api/admin/gog/catalog/search` with `x-admin-secret`
- `POST /api/admin/gog/catalog/discover` with `x-admin-secret`
- `POST /api/admin/gog/prices/test` with `x-admin-secret`
- `POST /api/admin/gog/prices/refresh` with `x-admin-secret`

Keep GOG discovery and refreshes small. Discovery stores `GogCatalogEntry` review data and returns suggested mappings,
but it does not create mappings automatically. GOG price refresh defaults to `dryRun=true`; use `dryRun=false` only for
approved mappings after a dry run shows valid JSON-derived price previews. Unknown-confidence mappings are skipped by
refresh.

Steam Store admin operations:

- `GET /api/admin/steam-store-prices/status`
- `POST /api/admin/steam-store-prices/test` with `x-admin-secret`
- `POST /api/admin/steam-store-prices/refresh` with `x-admin-secret`

Keep `dryRun=true` while testing. Do not run `dryRun=false` until the status and dry run output show valid JSON prices.

Admin/dev Steam operations:

```bash
curl -X POST https://apka-seven.vercel.app/api/admin/steam-catalog/sync \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: TU_WKLEJ_ADMIN_API_SECRET_LOKALNIE" \
  -d "{\"dryRun\":true,\"maxPages\":1,\"maxResults\":100}"

curl -X POST https://apka-seven.vercel.app/api/admin/steam-catalog/sync-until \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: TU_WKLEJ_ADMIN_API_SECRET_LOKALNIE" \
  -d "{\"dryRun\":true,\"targetCount\":2000,\"batchSize\":500,\"maxBatches\":4}"

curl -X POST https://apka-seven.vercel.app/api/admin/games/bulk-import \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: TU_WKLEJ_ADMIN_API_SECRET_LOKALNIE" \
  -d "{\"steamAppIds\":[570,730],\"refreshPlayers\":true,\"limit\":2}"

curl -X POST https://apka-seven.vercel.app/api/admin/player-counts/refresh \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: TU_WKLEJ_ADMIN_API_SECRET_LOKALNIE" \
  -d "{\"steamAppIds\":[570,730],\"limit\":2}"
```

Manual admin POST endpoints require `ADMIN_API_SECRET` through the `x-admin-secret` header. `POST /api/cron/refresh-player-counts` is prepared for a future Vercel Cron job and is protected by `CRON_SECRET` in production. Do not commit `STEAM_WEB_API_KEY`, `ADMIN_API_SECRET`, `CRON_SECRET`, database URLs or mobile signing secrets.

When those variables are changed in Vercel, redeploy the latest `main` deployment before running sync checks. Android/mobile receives only the public `VITE_API_BASE_URL`.

Steam catalog sync is intentionally manual and batched. `maxResults` is the total cap for one request; if it is `100`,
the sync stops after 100 entries even when `maxPages` is higher. Public catalog status returns
`nextSteamCatalogStartAfterAppId`, which can be passed as `startAfterAppId` for the next small batch.
`POST /api/admin/steam-catalog/sync-until` wraps multiple one-page batches behind one guarded admin call. Use
`dryRun=true` first; it reports `estimatedFinalCount` without changing stored rows.

Weights:

- 35% price against historical low,
- 20% discount quality,
- 20% current player activity,
- 15% player trend,
- 10% offer availability.

This makes the algorithm simple enough to explain in a thesis while still integrating independent data categories.

## Mock data

The seed and mock layer include:

- Counter-Strike 2
- Cyberpunk 2077
- The Witcher 3
- Baldur's Gate 3
- Elden Ring
- Stardew Valley
- Terraria
- Euro Truck Simulator 2

Each game has mock price snapshots, historical lows, player-count snapshots and store offers.

## Project structure

```text
src/app                 Next.js routes and API endpoints
src/components          UI, charts and form actions
src/lib/services        Domain services and API adapters
mobile                  React/Vite/Capacitor Android client
packages/shared         Shared API DTO types
src/lib/mock-data.ts    Demonstration fixtures
src/lib/store.ts        Mock repository layer
src/lib/repositories    Repository contracts and mock/prisma implementations
prisma/schema.prisma    PostgreSQL data model
prisma/migrations       Database migrations, including Steam catalog storage
prisma/seed.ts          Demonstration seed
docs/project-analysis.md
docs/architecture-map.md
tests
```

## Testing

```bash
npm run typecheck
npm test
npm run build
```

Current tests cover:

- GameValue Score,
- mock price service,
- player-count service fallback,
- Zod input validation,
- game profile endpoint.

## Engineering thesis context

GameValue Radar is suitable for thesis chapters about:

- problem analysis and purchase decision support,
- functional and non-functional requirements,
- system architecture,
- database design and Prisma modeling,
- API integration constraints and adapter design,
- implementation of scoring logic,
- testing strategy,
- future development.

Engineering value comes from the integration layer, snapshot-based historical data, domain scoring, mock/API mode separation, validation and an admin dashboard for observing integration health.

## Limitations and future work

- Mock prices and player counts are demonstrative.
- Real price APIs may require keys, contracts or provider-specific terms.
- No real email is sent in MVP; alerts use a mock notification log.
- Authentication is represented by a demo user and can be expanded with NextAuth.
- Future work can add scheduled jobs, Redis cache, real provider adapters, alert delivery and personalized recommendation profiles.
