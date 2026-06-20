# GOG Connector

GOG is the first real store connector for the internal GameValue Price API. It is backend-only: web and Android clients
continue to call GameValue Radar API endpoints and never call GOG directly.

## Configuration

```env
GOG_ENABLED=false
GOG_API_BASE_URL=https://api.gog.com
GOG_CATALOG_BASE_URL=https://catalog.gog.com
GOG_COUNTRY_CODE=PL
GOG_CURRENCY=PLN
GOG_REQUEST_LIMIT_PER_HOUR=200
```

`GOG_ENABLED=false` is the safe default. Set it to `true` only after deploy and after checking `/api/admin/gog/status`.
The code caps `GOG_REQUEST_LIMIT_PER_HOUR` at 200 and admin refreshes are limited to small batches.

## Safety Rules

- Use public JSON API responses only.
- Do not scrape HTML.
- Do not bypass Cloudflare.
- Do not use browser automation, cookies, sessions, Playwright/Puppeteer or proxies.
- Reject non-JSON responses and never save HTML into `StoreOffer` or `GamePriceSnapshot`.
- Treat uncertain title matches as suggestions, not approved mappings.

## Data Flow

1. Admin searches the GOG catalog through `POST /api/admin/gog/catalog/search`.
2. The backend stores small `GogCatalogEntry` records for review.
3. Admin can run `POST /api/admin/gog/catalog/discover` to search imported/top tracked games or explicit queries.
4. Discovery returns suggested and uncertain mappings, but it does not create `GameExternalMapping` rows automatically.
5. Admin can run `POST /api/admin/gog/mappings/suggest` for exact/review/uncertain suggestions.
6. Admin approves one mapping through `POST /api/admin/gog/mappings/approve`.
7. `POST /api/admin/gog/prices/test` checks one mapped product without writing prices.
8. `POST /api/admin/gog/prices/refresh` defaults to `dryRun=true`. Dry runs return parsed price previews and do not
   write `StoreOffer` or `GamePriceSnapshot` rows.
9. `dryRun=false` writes official GOG offers and price snapshots for approved mappings only.

Written offers use:

- `storeName=GOG`
- `storeType=official`
- `sourceName=gog`
- `sourceType=store-api`
- `drm=DRM-free`
- `source=gog`

The persisted `DataSource` value is `gog`, and UI badges render it as `GameValue / GOG store API`.

## Admin Endpoints

- `GET /api/admin/gog/status`
- `GET /api/admin/gog/mappings` with `x-admin-secret`
- `POST /api/admin/gog/mappings` with `x-admin-secret`
- `POST /api/admin/gog/mappings/suggest` with `x-admin-secret`
- `POST /api/admin/gog/mappings/approve` with `x-admin-secret`
- `POST /api/admin/gog/resolve-game` with `x-admin-secret`
- `POST /api/admin/gog/catalog/search` with `x-admin-secret`
- `POST /api/admin/gog/catalog/discover` with `x-admin-secret`
- `POST /api/admin/gog/prices/test` with `x-admin-secret`
- `POST /api/admin/gog/prices/refresh` with `x-admin-secret`

Example mapping:

```json
{
  "gameId": "cyberpunk-2077",
  "gogProductId": "2093619782",
  "externalSlug": "cyberpunk_2077",
  "confidence": "manual"
}
```

Example suggestion:

```json
{
  "mode": "imported-games",
  "limit": 20
}
```

Example approval:

```json
{
  "gameId": "the-witcher-3",
  "gogProductId": "1207658924",
  "confidence": "manual"
}
```

Example safe refresh:

```json
{
  "mode": "mapped-games",
  "gameIds": ["cyberpunk-2077"],
  "limit": 1,
  "dryRun": true
}
```

Example discovery:

```json
{
  "mode": "imported-games",
  "limit": 10
}
```
