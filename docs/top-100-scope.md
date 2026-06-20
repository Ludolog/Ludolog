# TOP 100 production scope

`TopTrackedGame` is the current production tracking scope for GameValue Radar. It contains a curated list of 100 Steam App IDs that can be imported, scored and refreshed without turning the full searchable Steam catalog into tracked `Game` rows.

## Public API contract

- `GET /api/top-games` returns up to 100 ranked Steam games plus coverage metrics.
- Public TOP 100 items never expose `playerSource="mock"` when `DATA_MODE=api` and `ENABLE_DEV_MOCK_FALLBACK=false`.
- Missing real player data is reported as `currentPlayers=null`, `playerSource="no-data"` and `playerFreshness="missing"`.
- `gameValueScore` is nullable and `recommendation="insufficient-data"` until both a public player snapshot and a trusted Steam/manual price are available.
- `coverage.mockPublicDataCount` must stay `0` in production public responses.

## Coverage metrics

The coverage block includes:

- `topTrackedCount`
- `importedCount`
- `withPlayerCount`
- `withFreshPlayerCount`
- `withSteamPrice`
- `withFreshSteamPrice`
- `fullScoreCount`
- `insufficientDataCount`
- `noPlayerDataCount`
- `noPriceDataCount`
- `mockPublicDataCount`

## Refresh operations

All admin TOP 100 operations require `x-admin-secret` and are capped at 100 rows:

- `POST /api/admin/top-games/import`
- `POST /api/admin/top-games/refresh-players`
- `POST /api/admin/top-games/refresh-prices`
- `POST /api/admin/top-games/bootstrap`

`refresh-players` calls Steam current-player data and writes real `PlayerCountSnapshot` rows when Steam returns data. If Steam returns no data, the result increments `noData` and does not write a mock snapshot.

`refresh-prices` calls the backend-only Steam Store connector for imported TOP 100 games. Free-to-play games store `0` as a real Steam Store price. No-price or unavailable responses are skipped, not counted as technical failures.

## GOG visibility

GOG remains admin/experimental while the mapping workflow is manual. With `SHOW_GOG_PUBLIC=false`, public rankings, stats and game price endpoints filter GOG out. Admin status and mapping/refresh tools still show GOG state.
