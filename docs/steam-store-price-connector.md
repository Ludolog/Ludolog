# Steam Store price connector

The Steam Store connector is experimental and backend-only. It uses the Steam Store `appdetails` JSON endpoint and does not scrape Steam Store HTML.

Default environment:

```env
STEAM_STORE_PRICE_ENABLED=false
STEAM_STORE_API_BASE_URL=https://store.steampowered.com/api
STEAM_STORE_COUNTRY=PL
STEAM_STORE_CURRENCY=PLN
STEAM_STORE_PRICE_CACHE_TTL_MINUTES=360
STEAM_STORE_PRICE_MAX_PER_RUN=20
```

Stored records use:

- `source=steam-store`
- `sourceName=steam-store`
- `sourceType=store-api-experimental`
- `sourceConfidence=experimental-store-api`
- `storeName=Steam`
- `storeType=official`
- `drm=Steam`

Status:

```powershell
Invoke-RestMethod "https://apka-seven.vercel.app/api/admin/steam-store-prices/status"
```

Safe Dota 2 dry run:

```powershell
if ([string]::IsNullOrWhiteSpace($env:ADMIN_API_SECRET)) {
  throw "Set ADMIN_API_SECRET in this PowerShell session first."
}

$headers = @{ "x-admin-secret" = $env:ADMIN_API_SECRET.Trim() }
$body = @{ steamAppIds = @(570); limit = 1; dryRun = $true } | ConvertTo-Json -Compress

Invoke-RestMethod `
  -Uri "https://apka-seven.vercel.app/api/admin/steam-store-prices/refresh" `
  -Method POST `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body
```

Do not run with `dryRun=false` until `STEAM_STORE_PRICE_ENABLED=true` has been deployed and the dry run confirms JSON-derived price data. Non-JSON responses are rejected and are never stored as offers or snapshots.
