# Mock price cleanup

This cleanup is intentionally narrow. It removes old demo/mock price data only:

- `StoreOffer` rows with `source=mock`, `provider=mock` or a mock `PriceSource`.
- `GamePriceSnapshot` rows with `source=mock`, `provider=mock` or a mock `PriceSource`.
- mock `PriceSource` rows.

It keeps:

- `Game`
- `SteamCatalogEntry`
- `GogCatalogEntry`
- `GameExternalMapping`
- `PlayerCountSnapshot`
- manual/internal price rows
- GOG price rows
- Steam Store price rows

Always preview first:

```powershell
if ([string]::IsNullOrWhiteSpace($env:ADMIN_API_SECRET)) {
  throw "Set ADMIN_API_SECRET in this PowerShell session first."
}

$headers = @{ "x-admin-secret" = $env:ADMIN_API_SECRET.Trim() }
Invoke-RestMethod "https://apka-seven.vercel.app/api/admin/prices/mock-cleanup/preview" -Headers $headers
```

Only run after reviewing the preview:

```powershell
$body = @{ confirm = "DELETE_MOCK_PRICE_DATA_ONLY" } | ConvertTo-Json -Compress
Invoke-RestMethod `
  -Uri "https://apka-seven.vercel.app/api/admin/prices/mock-cleanup/run" `
  -Method POST `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body
```

Do not use this endpoint for broad database cleanup. It is not a replacement for migrations or manual DBA work.
