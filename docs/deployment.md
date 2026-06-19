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
DATA_MODE=mock
NEXT_PUBLIC_APP_URL=https://apka-seven.vercel.app
MOBILE_ALLOWED_ORIGINS=https://apka-seven.vercel.app,capacitor://localhost
STEAM_WEB_API_KEY=
CRON_SECRET=
```

Use the pooled Neon host for `DATABASE_URL` and the direct Neon host for `DIRECT_URL`. Replace `TWOJE_HASLO` only inside Vercel settings or local ignored env files.

6. Start the deployment.
7. After deployment, check:

```text
https://apka-seven.vercel.app
https://apka-seven.vercel.app/api/admin/status
https://apka-seven.vercel.app/api/games/search?q=cyberpunk
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
DATA_MODE=mock
REPOSITORY_PROVIDER=prisma
DATABASE_URL=...
DIRECT_URL=...
NEXT_PUBLIC_APP_URL=https://apka-seven.vercel.app
MOBILE_ALLOWED_ORIGINS=https://apka-seven.vercel.app,capacitor://localhost
STEAM_WEB_API_KEY=
# Legacy fallback name is still accepted, but new environments should use STEAM_WEB_API_KEY.
STEAM_API_KEY=
CRON_SECRET=
PRICE_API_PROVIDER=mock
PRICE_API_KEY=
ISTHEREANYDEAL_API_KEY=
GG_DEALS_API_KEY=
```

Notes:

- `REPOSITORY_PROVIDER=prisma` makes API routes use PostgreSQL through Prisma repositories.
- `DATA_MODE` controls external integrations/mock fallbacks, not the database provider.
- `MOBILE_ALLOWED_ORIGINS` should be explicit in production. Do not use `*`.
- `STEAM_WEB_API_KEY` is backend-only. It enables real Steam catalog sync and real current-player refreshes.
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
https://apka-seven.vercel.app/api/stats/overview
https://apka-seven.vercel.app/api/admin/steam-catalog/status
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

The Vercel backend owns Steam catalog sync, search fallback, player-count refreshes and stats aggregation. Mobile builds only receive the public `VITE_API_BASE_URL`.

Useful production checks after deploy:

```text
https://apka-seven.vercel.app/api/games/search?q=palworld
https://apka-seven.vercel.app/api/stats/overview
https://apka-seven.vercel.app/api/stats/top-players
https://apka-seven.vercel.app/api/stats/best-value
https://apka-seven.vercel.app/api/admin/steam-catalog/status
```

If `STEAM_WEB_API_KEY`, legacy `STEAM_API_KEY` or provider-specific API keys are not configured, the app continues in mock/fallback mode and records integration logs. Never add those secrets to `mobile/.env.production` or any committed file.

Manual Steam catalog sync:

```bash
curl -X POST https://apka-seven.vercel.app/api/admin/steam-catalog/sync \
  -H "Content-Type: application/json" \
  -d "{\"dryRun\":true,\"maxPages\":1,\"maxResults\":1000}"
```

After verifying the dry run, run a limited write sync:

```bash
curl -X POST https://apka-seven.vercel.app/api/admin/steam-catalog/sync \
  -H "Content-Type: application/json" \
  -d "{\"dryRun\":false,\"maxPages\":1,\"maxResults\":1000}"
```

Manual player-count refresh:

```bash
curl -X POST https://apka-seven.vercel.app/api/admin/player-counts/refresh \
  -H "Content-Type: application/json" \
  -d "{\"mode\":\"top\",\"limit\":25}"
```

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
