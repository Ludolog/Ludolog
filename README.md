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
PRICE_PROVIDER="mock"
PRICE_MODE="mock"
GGDEALS_API_KEY=""
# Legacy fallbacks:
PRICE_API_PROVIDER="mock"
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

- `GET /api/games/search?q=`
- `POST /api/games/import`
- `POST /api/games/resolve`
- `GET /api/games/:id`
- `GET /api/games/:id/prices`
- `GET /api/games/:id/players`
- `POST /api/games/:id/refresh`
- `GET /api/deals/best`
- `GET /api/stats/overview`
- `GET /api/stats/steam`
- `GET /api/stats/categories`
- `GET /api/stats/trending`
- `GET /api/stats/top-players`
- `GET /api/stats/best-value`
- `GET /api/admin/steam-catalog/status`
- `POST /api/admin/steam-catalog/sync`
- `POST /api/admin/games/bulk-import`
- `POST /api/admin/prices/refresh`
- `POST /api/admin/prices/refresh-best`
- `POST /api/admin/player-counts/refresh`
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

Search now combines local database results, synced Steam catalog entries stored in PostgreSQL and the larger mock fallback catalog. If a result is already stored, clients can open its profile immediately. If it only exists in the catalog, the client can call `POST /api/games/import` with a `steamAppId`, `query` or legacy `slug`; the backend creates the game, attempts a current-player refresh and keeps the import working even when Steam is unavailable. The response includes `created`, `source`, `steamAppId`, `gameId`, `summary` and the backwards-compatible `imported` flag. UI components never hardcode the catalog.

Steam Stats are exposed through `GET /api/stats/overview`. The overview includes top current players, trending games, biggest growth/drop, best value, watchlist popularity, hidden gems, genre categories, data freshness and source counts. Trends are calculated from the latest two `PlayerCountSnapshot` records. If live Steam data is unavailable, the app uses mock snapshots and logs the fallback.

Android never calls Steam directly and never receives API keys. The mobile app calls the Vercel/Next.js API, and backend services own Steam catalog sync and player-count refreshes.

## Real price provider

Price data flows through `PriceProviderService`. The active provider is selected with `PRICE_PROVIDER` and `PRICE_MODE`:

- `PRICE_PROVIDER=ggdeals`
- `PRICE_MODE=api`
- `GGDEALS_API_KEY=...`

The default GG.deals endpoint is `https://gg.deals/api/prices/by-steam-app-id/` and the adapter sends `key` plus `ids=<steamAppId>`. Use `GGDEALS_API_BASE_URL` only if GG.deals provides a project-specific endpoint.

If `PRICE_MODE=mock`, `PRICE_PROVIDER=mock` or the GG.deals key is missing, the backend falls back to `MockPriceProvider` and records an integration log. The key is backend-only: do not commit it and do not expose it through `VITE_` mobile variables. Android and Web call only our API.

GG.deals API terms require personal/hobby use only for free access, visible attribution with an active GG.deals hyperlink wherever GG.deals data is displayed, and preserving GG.deals referral/affiliate links. The UI attribution components link to the stored provider URL when available, falling back to `https://gg.deals/`.

Normalized offers store `provider`, `storeType` (`official`, `keyshop`, `marketplace`, `unknown`), `price`, `regularPrice`, `historicalLow`, `isHistoricalLow`, currency, URL, raw provider id and fetched time. `StoreOffer` stores the current best offers and `GamePriceSnapshot` stores durable price history used by GameValue Score, Best deals and Stats.

Admin price operations:

```bash
curl -X POST https://apka-seven.vercel.app/api/admin/prices/refresh \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: TU_WKLEJ_ADMIN_API_SECRET_LOKALNIE" \
  -d "{\"mode\":\"imported\",\"limit\":10}"

curl -X POST https://apka-seven.vercel.app/api/admin/prices/refresh \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: TU_WKLEJ_ADMIN_API_SECRET_LOKALNIE" \
  -d "{\"steamAppIds\":[570,730],\"limit\":2}"
```

ITAD and CheapShark are intentionally not active providers yet, but the provider interface is ready for additional adapters.

Admin/dev Steam operations:

```bash
curl -X POST https://apka-seven.vercel.app/api/admin/steam-catalog/sync \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: TU_WKLEJ_ADMIN_API_SECRET_LOKALNIE" \
  -d "{\"dryRun\":true,\"maxPages\":1,\"maxResults\":100}"

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
