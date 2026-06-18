# GameValue Radar - analiza projektu

## Android mobile client extension

The Android app is implemented as a separate API client in `mobile/`. The Next.js backend, Prisma and PostgreSQL are not packed into the APK. This keeps a clean client-server architecture: Android renders the mobile UI, while the existing backend owns integrations, snapshots and GameValue Score calculation.

Communication model:

```text
Android / Capacitor / React -> HTTP API -> Next.js API routes -> domain services -> mock/API/PostgreSQL
```

The mobile app uses `VITE_API_BASE_URL`. For the Android emulator the local backend is available as `http://10.0.2.2:3000`; for a physical phone it should use the computer LAN IP, for example `http://192.168.x.x:3000`. Production should use HTTPS.

The mobile app does not duplicate the scoring algorithm. It displays the score, recommendation and factors returned by the backend. Shared API DTO types are stored in `packages/shared`.

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
