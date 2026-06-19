# GameValue Radar Android

This document describes the Android MVP added through Capacitor.

## Architecture

The Android app is a mobile API client. It does not package the Next.js backend, Prisma or PostgreSQL into the APK. The existing Next.js project remains the web app and backend API. The mobile client lives in `mobile/` and calls the existing endpoints through `VITE_API_BASE_URL`.

## Local backend

Start the Next.js backend/web app from the repository root:

```bash
npm install
npm run dev
```

The backend should be available at:

```text
http://127.0.0.1:3000
```

## Mobile client in browser

For browser testing on the same computer, create `mobile/.env.local`:

```env
VITE_API_BASE_URL=http://127.0.0.1:3000
```

Then run:

```bash
npm run mobile:dev
```

Open the Vite URL shown in the terminal.

## Android emulator backend URL

Android emulator cannot use `127.0.0.1:3000` to reach the computer. Inside the emulator, `127.0.0.1` means the emulator itself.

Use:

```env
VITE_API_BASE_URL=http://10.0.2.2:3000
```

`10.0.2.2` is the Android emulator alias for the host machine.

Use this URL only for local development builds. Production Android builds should use the deployed Vercel backend instead.

## Physical Android phone

Use your computer IP address in the same LAN:

```env
VITE_API_BASE_URL=http://192.168.x.x:3000
```

The computer firewall must allow inbound traffic to port `3000`. The phone and computer must be on the same network.

## Build and sync Android

From the repository root:

```bash
npm install --prefix mobile
npm run mobile:build
npm run mobile:sync
```

Development build:

```bash
npm run mobile:build:dev
npm run mobile:sync
```

Production build:

```bash
npm run mobile:build:prod
npm run mobile:sync:prod
```

Production Android builds use the public API URL from `mobile/.env.production`:

```env
VITE_API_BASE_URL=https://apka-seven.vercel.app
```

`mobile/.env.production` is local-only and must not be committed. It may contain public `VITE_` values only. Do not put `DATABASE_URL`, `DIRECT_URL`, Neon credentials, API keys, signing secrets or Firebase secrets into any mobile env file.

Open Android Studio:

```bash
npm run android:open
```

Run on an emulator:

```bash
npm run android:run
```

Build debug APK:

```bash
npm run android:build
```

The debug APK is produced under:

```text
mobile/android/app/build/outputs/apk/debug/
```

## Jak poprawnie otworzyć projekt w Android Studio

Nie otwieramy głównego folderu repozytorium jako projektu Android:

```text
C:\Users\kacpe\Documents\Apka Pawełek
```

Projekt Android wygenerowany przez Capacitor znajduje się w osobnym katalogu:

```text
C:\Users\kacpe\Documents\Apka Pawełek\mobile\android
```

W Android Studio wybierz `File -> Open`, wskaż folder:

```text
C:\Users\kacpe\Documents\Apka Pawełek\mobile\android
```

Następnie poczekaj na `Gradle Sync`. Po synchronizacji Android Studio powinno widzieć moduł aplikacji `app` / `:app`, a w konfiguracji `Run/Debug Configurations` dla typu `Android App` należy wybrać moduł `app`.

Jeśli w konfiguracji nadal widać `Module: <no module>` albo `Module not specified`, usuń starą konfigurację uruchomieniową i utwórz nową:

1. Otwórz `Run -> Edit Configurations`.
2. Usuń konfigurację z `Module: <no module>`.
3. Kliknij `+` i wybierz `Android App`.
4. Ustaw `Module` na `app`.
5. Zapisz konfigurację i uruchom aplikację zielonym przyciskiem `Run`.

Jeśli lista modułów jest pusta, wymuś ponowną synchronizację przez `File -> Sync Project with Gradle Files` albo przez przycisk odświeżania w panelu `Gradle`. Poprawny projekt Gradle po otwarciu `mobile/android` zawiera moduł `:app`.

## HTTP and HTTPS

Debug Android builds allow cleartext HTTP so the emulator can call `http://10.0.2.2:3000`.

Production releases should use HTTPS and a deployed backend URL:

```env
VITE_API_BASE_URL=https://apka-seven.vercel.app
```

## Search, Steam Stats and backend ownership

The Android app now uses backend endpoints for expanded search and Steam/player statistics:

- `GET /api/games/search?q=`
- `POST /api/games/import`
- `POST /api/games/{id}/refresh-players`
- `GET /api/stats/overview`
- `GET /api/admin/status`

Search results can come from the local database, the backend-synced Steam catalog or the backend mock fallback catalog. Mobile search shows source badges:

- `In library` for games already imported into `Game`,
- `Steam catalog` for synced `SteamCatalogEntry` rows from Neon,
- `Mock fallback` when the real catalog is empty or unavailable.

Importing a catalog result is also a backend operation. The APK never calls Steam directly and must never contain `STEAM_WEB_API_KEY`, `STEAM_API_KEY`, database URLs, Neon credentials or signing secrets.

Steam Stats in the mobile UI are based on backend `PlayerCountSnapshot` records. Trends use the latest two player snapshots. If live Steam access is unavailable, the backend returns mock/fallback values and records an integration log; the Android app simply displays the API response.

The Stats screen shows a data mode badge:

- `Real data` when catalog and player snapshots are real,
- `Mixed data` when real and fallback data are combined,
- `Mock fallback` when the app is running on demonstration data.

Game details can call `POST /api/games/{id}/refresh-players`. This still goes through the Next.js backend, which owns the Steam Web API key and stores the refreshed `PlayerCountSnapshot`.

Diagnostics should show:

- `API base URL`,
- backend status,
- Steam catalog entry count,
- imported game count,
- last Steam catalog sync,
- last player-count refresh,
- current data mode.

For production CORS, set `MOBILE_ALLOWED_ORIGINS` explicitly on the backend. Do not rely on development defaults.

Local Android development:

```env
VITE_API_BASE_URL=http://10.0.2.2:3000
```

Production Android build:

```env
VITE_API_BASE_URL=https://apka-seven.vercel.app
```

For a production API debug APK, build in this order:

```bash
npm run mobile:build:prod
npm run mobile:sync:prod
npm run android:build
```

After installation on the emulator, open Diagnostics and confirm:

- API base URL is `https://apka-seven.vercel.app`,
- backend status is OK,
- Home, Search, Deals, Game Details and Stats load through the Vercel API,
- no screen reports `10.0.2.2`, `localhost` or `127.0.0.1` in the production bundle.

## Release build notes

For a production API debug APK, build and sync the mobile client with the production `VITE_API_BASE_URL`, then assemble the Android debug APK:

```bash
npm run mobile:build:prod
npm run mobile:sync:prod
npm run android:build
```

The debug APK is produced under:

```text
mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

For a release build, configure Android signing in Android Studio or Gradle, build the mobile client with the production `VITE_API_BASE_URL`, run `npm run mobile:sync:prod`, then create a signed bundle/APK from Android Studio.

The root script `npm run android:build:release` runs a production mobile build and Gradle `assembleRelease`, but release signing still needs to be configured before producing a store-ready artifact.

## Current limitations

- The app uses API data from the current backend and does not yet cache offline data.
- Price alerts are still mock/backend-side structures, not native Android notifications.
- Push notifications, background sync and local persistence are future work.
- Recharts increases the mobile bundle size; code splitting can be added later.
