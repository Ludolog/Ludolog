# GameValue Radar - analiza projektu

## Android mobile client extension

The Android app is implemented as a separate API client in `mobile/`. The Next.js backend, Prisma and PostgreSQL are not packed into the APK. This keeps a clean client-server architecture: Android renders the mobile UI, while the existing backend owns integrations, snapshots and GameValue Score calculation.

Communication model:

```text
Android / Capacitor / React -> HTTP API -> Next.js API routes -> domain services -> mock/API/PostgreSQL
```

The mobile app uses `VITE_API_BASE_URL`. For the Android emulator the local backend is available as `http://10.0.2.2:3000`; for a physical phone it should use the computer LAN IP, for example `http://192.168.x.x:3000`. Production should use HTTPS.

The mobile app does not duplicate the scoring algorithm. It displays the score, recommendation and factors returned by the backend. Shared API DTO types are stored in `packages/shared`.

The detailed live data-flow map is maintained in `docs/architecture-map.md`.

Current limitations:

- no offline cache,
- no native push notifications,
- no production signing configuration in the repository,
- HTTP is enabled only for Android debug builds.

Future development:

- native promotion notifications,
- push notifications for price alerts,
- cached last-known game profiles,
- background synchronization,
- deployed HTTPS backend and signed release build.

## Production architecture: Vercel and Neon

The production target is:

```text
Android App -> Vercel Next.js API -> Neon PostgreSQL
```

`DATABASE_URL` is used for Prisma runtime access. `DIRECT_URL` is reserved for direct migration access, which is important when Neon connection pooling is enabled. Runtime repository selection is controlled by `REPOSITORY_PROVIDER`; local MVP defaults to `mock`, while production can use `prisma`.

The repository layer introduces contracts for games, watchlist, alerts, snapshots and diagnostics. Current implementations are `mock` and `prisma`. A future Firestore migration should add Firebase implementations behind the same contracts instead of changing API responses or Android client DTOs.

Steam catalog sync is an admin-controlled backend operation. It is intentionally batched with `maxResults`,
`maxPages` and optional `startAfterAppId`, and it writes `SteamCatalogEntry` rows by unique `steamAppId`. Search can
then combine imported library games and synced catalog entries without exposing Steam,
Neon or admin secrets to Android.

`POST /api/admin/steam-catalog/sync-until` is a safer operational wrapper for growing the catalog toward a target count
through capped one-page batches. Dry runs report `estimatedFinalCount` and do not change Neon, which makes larger search
coverage testable before a real write.

The production refresh scope is deliberately narrower than the searchable catalog. `TopTrackedGame` stores a curated
TOP 100 Steam list. Web, Android and public API clients use `GET /api/top-games` to show ranking, coverage and
score-readiness for this practical daily scope. Admin endpoints can import the list, refresh player counts and refresh
Steam Store prices in capped batches. This keeps useful data fresh without turning the whole Steam catalog into tracked
`Game` rows.

## Cel systemu

GameValue Radar to aplikacja webowa wspomagająca decyzje zakupowe graczy PC. System łączy dane o cenach, ofertach sklepów, historii cen, liczbie aktywnych graczy oraz autorskim wskaźniku opłacalności zakupu. Projekt nie jest kopią SteamDB ani GG.deals i nie wykonuje scrapingu stron HTML. Integracje są zamknięte w adapterach, a tryb demonstracyjny działa na danych mockowych.

## Zakres MVP

- wyszukiwanie gier po nazwie,
- profil gry z ceną, historycznym minimum, ofertami i liczbą graczy,
- wykres historii cen i popularności,
- GameValue Score w skali 0-100,
- rekomendacja zakupowa,
- watchlista,
- podstawowe alerty cenowe,
- panel admin/dev z podglądem danych, integracji i odświeżaniem snapshotów,
- tryb `DATA_MODE=mock` oraz `DATA_MODE=api`,
- schemat Prisma dla PostgreSQL,
- seed danych demonstracyjnych,
- testy algorytmu, usług, walidacji i endpointu.

## Proponowana struktura katalogów

```text
src/
  app/
    api/                 Route handlers Next.js
    games/[id]/          Profil gry
    search/              Wyniki wyszukiwania
    watchlist/           Lista obserwowanych
    admin/               Panel techniczny
    about/               Kontekst inżynierski
  components/
    charts/              Komponenty Recharts
    forms/               Formularze i akcje klienta
    layout/              Nawigacja, stopka, shell
  lib/
    services/            Adaptery i logika domenowa
    mock-data.ts         Dane demonstracyjne
    store.ts             Warstwa dostępu do danych mock
    types.ts             Typy domenowe
    validation.ts        Schematy Zod
prisma/
  schema.prisma          Model bazy danych
  seed.ts                Seed demonstracyjny
tests/
  *.test.ts              Testy jednostkowe i endpointu
```

## Model danych

Główne encje:

- `Game` - dane gry, Steam App ID, opis, okładka, metadane.
- `StoreOffer` - aktualne oferty sklepów, cena, rabat, DRM, źródło.
- `GamePriceSnapshot` - cykliczne snapshoty ceny i historycznego minimum.
- `PlayerCountSnapshot` - cykliczne snapshoty liczby graczy online.
- `DealScoreSnapshot` - wynik GameValue Score oraz składowe oceny.
- `User` - użytkownik demonstracyjny i przyszłe konto.
- `Watchlist` - obserwowane gry i opcjonalny próg ceny.
- `PriceAlert` - alerty cenowe, próg, status i data wyzwolenia.
- `IntegrationLog` - błędy i status adapterów API.

## Algorytm GameValue Score

Algorytm jest jawny, deterministyczny i łatwy do opisania w pracy:

- 35% `pricePosition` - jak blisko obecna cena jest historycznego minimum.
- 20% `discountQuality` - procent aktualnej zniżki.
- 20% `activity` - aktualna liczba graczy, normalizowana logarytmicznie.
- 15% `trend` - relacja ostatniej liczby graczy do średniej z historii.
- 10% `offerAvailability` - jakość i liczba dostępnych ofert.

Rekomendacje:

- `buy_now` - wynik co najmniej 75 lub cena bardzo blisko historycznego minimum.
- `wait` - wynik od 55 do 74.
- `weak_deal` - wynik poniżej 55.

## Kolejność implementacji

1. Konfiguracja projektu, layout i routing.
2. Schemat Prisma oraz seed danych demonstracyjnych.
3. Serwisy `SteamApiService`, `PriceApiService`, `GameSearchService`, `DealScoreService`, `SnapshotService`.
4. Endpointy API.
5. Widoki frontendowe.
6. Wykresy i prezentacja scoringu.
7. Watchlista oraz alerty cenowe.
8. Panel admin/dev.
9. Testy.
10. README i dokumentacja uruchomienia.

## Ryzyka i ograniczenia

- Dane mockowe nie reprezentują rzeczywistych cen ani aktualnej aktywności graczy.
- Integracje API mogą wymagać kluczy, limitów lub indywidualnych warunków licencyjnych.
- Aplikacja nie deklaruje oficjalnej relacji ze Steam, Valve, GG.deals ani SteamDB.
- Historia danych w MVP powstaje przez snapshoty aplikacji, więc realna wartość analityczna rośnie wraz z czasem działania systemu.

## Expanded catalog search and Steam Stats

Search now goes beyond the records already stored in the active repository. `GameSearchService` first asks the `Game` repository, then checks synced `SteamCatalogEntry` records stored in PostgreSQL. `SteamAppCatalogService` remains a local/dev mock fallback only and is disabled in production API mode unless `ENABLE_DEV_MOCK_FALLBACK=true` is set intentionally. Catalog results are marked as importable. `POST /api/games/import` accepts `steamAppId`, `query` or legacy `slug`, turns an importable catalog game into a normal observable game and attempts a backend player-count refresh.

Search responses include pagination metadata (`limit`, `offset`, `total`, `nextOffset`) and keep ordering stable: library games first, synced Steam catalog entries second, with mock fallback only in local/dev mode.

`SteamCatalogEntry` stores the synced Steam application catalog separately from imported games. This prevents the app from creating thousands of full `Game` records before a title is actually observed by the user. Catalog sync is manual/admin-only and uses capped pagination through `IStoreService/GetAppList`; it must not run during Next.js build or on every page visit.

`CategoryRankingService` centralizes product taxonomy for Home, Stats, admin and mobile. It classifies games from `Game.genres`, known Steam App ID fallback mappings and data-state checks. UI surfaces receive DTOs with `slug`, `title`, `description`, `type`, `gameCount`, `topGames` and `updatedAt`, so category membership is not hardcoded in components.

## GameValue Price API layer

Prices now come from the internal GameValue Price API rather than active external aggregators. `PRICE_PROVIDER=gamevalue` and `PRICE_MODE=internal` are the defaults. GG.deals, ITAD and CheapShark are legacy/disabled in active flow because GG.deals returned Cloudflare challenge HTML from Vercel instead of API JSON. The application does not bypass Cloudflare, scrape protected HTML, use browser automation, cookies, proxies or fake sessions.

The internal price layer adds:

- `PriceSource` for `manual-admin`, `json-import`, `csv-import`, `partner-feed-placeholder`, `mock-seed` and future legal store feeds.
- `Store` for normalized store metadata such as Steam, GOG, Epic Games Store, Fanatical, Green Man Gaming, Humble Store, Eneba and Kinguin.
- extended `StoreOffer` rows for current tracked offers.
- extended `GamePriceSnapshot` rows for durable price history.
- `GogCatalogEntry` and `GameExternalMapping` for manual Steam/GameValue-to-GOG product mapping.
- experimental `steam-store` price records from the Steam Store JSON `appdetails` endpoint.
- `CatalogStoreOffer` for catalog-only Steam Store and GOG price backfill that does not import rows into `Game`.
- `CatalogPriceCheckStatus` for no-price/error cooldowns during catalog price checks.
- `TopTrackedGame` for the curated TOP 100 Steam production scope.

`GameValuePriceService` validates admin inputs, creates stores and sources when needed, upserts offers and appends snapshots. `sourceConfidence` distinguishes `internal-real`, `experimental-store-api`, `internal-mock`, `external-legacy` and `no-price-data`, which lets web and Android show clear badges without exposing technical provider failures.

`GogService` is the first real store connector in that layer. It is disabled by default, uses public GOG JSON endpoints only, respects small admin batches and writes official DRM-free `source=gog` offers after manual mapping approval. It rejects HTML/non-JSON responses and never stores Cloudflare or page HTML as a price record.
Public GOG visibility is disabled by default with `SHOW_GOG_PUBLIC=false`; admin status and mapping/refresh tools remain
available while public deals, stats and game price endpoints filter GOG out.

GOG catalog discovery can search imported/top tracked games or explicit queries and store `GogCatalogEntry` rows for
review. It returns suggested and uncertain mappings separately, but it never creates `GameExternalMapping` records on
its own. GOG price refresh defaults to `dryRun=true`, returning parsed price previews without writing offers or snapshots.
GOG catalog price backfill now uses stored `GogCatalogEntry` rows before fallback lookup, writes catalog-only
`CatalogStoreOffer` rows, and treats no-price/unavailable/unsupported catalog states as skipped warnings with cooldowns
instead of technical failures. GOG currency mismatches are reported and stored as returned by GOG; the app does not do FX
conversion.

`SteamStorePriceService` is the second real/experimental connector. It is disabled by default, uses Steam Store `appdetails` JSON only, keeps admin batches small and writes `source=steam-store` offers/snapshots only when explicitly invoked. It rejects non-JSON responses and never stores HTML.

`PriceRefreshScheduler` coordinates capped imported Steam Store refreshes, mapped GOG refreshes and optional catalog backfill. The cron endpoints are protected by `CRON_SECRET`, while admin automation endpoints require `x-admin-secret` and default to dry-run style operation in the dashboard.

`TopGamesService` coordinates the TOP 100 path. `POST /api/admin/top-games/bootstrap` can dry-run or execute import,
player refresh and Steam Store price refresh for at most 100 entries. `GET|POST /api/cron/refresh-top-games` is the
daily Vercel Hobby-safe cron for that scope. TOP 100 GameValue output returns a nullable score and
`insufficient-data` recommendation when player or trusted price data is missing.

Mock price cleanup is separated from general database maintenance. `GET /api/admin/prices/mock-cleanup/preview` reports affected mock offers, mock snapshots and mock price sources; `POST /api/admin/prices/mock-cleanup/run` requires `DELETE_MOCK_PRICE_DATA_ONLY` and does not delete games, catalogs, external mappings or player snapshots.

Legacy `PriceProviderService` and GG.deals diagnostics remain as disabled safety code, but `/api/admin/prices/refresh`, `/api/admin/prices/refresh-best` and `/api/admin/prices/provider-diagnostics` no longer call external aggregators.

`StatsService` builds analytical sections from `PlayerCountSnapshot`, price snapshots and GameValue Score:

- top current players,
- trending up/down,
- biggest player growth and drop,
- best value,
- free-to-play and tracked deals,
- popular watchlists,
- hidden gems,
- data-source categories and genre categories.

Trend percentage is calculated from the latest two player-count snapshots. If live Steam access is not configured or fails, backend services fall back to mock values and record an integration log. Android remains a client of the backend API and never calls Steam or receives API keys.

The stats overview exposes a data mode:

- `real` when both catalog and player snapshots come from real integrations,
- `mixed` when real data and fallback data coexist,
- `mock` when the app operates fully on demonstration data.

This transparency is important for the thesis because the application can be demonstrated without secrets while still showing where real integrations are active.

Player-count refresh is available through backend routes for a single game, explicit Steam App IDs, admin batches, TOP 100 batches and cron endpoints. Admin bulk import can create a small starter set from the synced catalog and returns per-game success/failure results instead of treating the batch as all-or-nothing. The cron routes are protected by `CRON_SECRET` in production, and batch sizes stay intentionally small to avoid unnecessary Steam API traffic.
