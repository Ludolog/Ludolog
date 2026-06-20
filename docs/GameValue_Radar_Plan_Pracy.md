# Plan / propozycja pracy dyplomowej

**Uczelnia:** MAŁOPOLSKA UCZELNIA PAŃSTWOWA IMIENIA ROTMISTRZA WITOLDA PILECKIEGO W OŚWIĘCIMIU  
**Instytut:** [DO UZUPEŁNIENIA]  
**Kierunek studiów:** Informatyka  
**Poziom studiów:** 1 stopień  
**Moduł specjalnościowy:** [DO UZUPEŁNIENIA]  
**Forma studiów:** niestacjonarna  
**Autor:** [IMIĘ I NAZWISKO DO UZUPEŁNIENIA], nr albumu [DO UZUPEŁNIENIA]  
**Promotor:** [PROMOTOR DO UZUPEŁNIENIA]  
**Miejscowość i data:** Oświęcim, [DATA DO UZUPEŁNIENIA]

## Tytuł pracy

ZAPROJEKTOWANIE I IMPLEMENTACJA SYSTEMU WSPOMAGANIA DECYZJI ZAKUPOWYCH DLA GIER PC Z WYKORZYSTANIEM DANYCH CENOWYCH ORAZ STATYSTYK AKTYWNOŚCI GRACZY

## Propozycja Tytułu Pracy (PL)

**Tytuł główny:**  
Zaprojektowanie i implementacja systemu wspomagania decyzji zakupowych dla gier PC z wykorzystaniem danych cenowych oraz statystyk aktywności graczy.

**Alternatywnie:**  
Zaprojektowanie i implementacja platformy analitycznej do oceny wartości gier PC na podstawie cen, aktywności graczy oraz danych katalogowych.

## Propozycja Tytułu Pracy (EN)

**Main title:**  
Design and implementation of a decision-support system for PC game purchases using price data and player activity statistics.

**Alternative:**  
Design and implementation of an analytical platform for evaluating the value of PC games based on prices, player activity and catalog data.

## Streszczenie PL

Celem pracy jest zaprojektowanie i implementacja aplikacji GameValue Radar / Ludolog, czyli systemu wspomagania decyzji zakupowych dla gier PC. System ma pomagać użytkownikowi w ocenie, czy dana gra jest atrakcyjna zakupowo, łącząc informacje o katalogu gier, aktualnych cenach ze Steam Store oraz liczbie aktywnych graczy w serwisie Steam. Głównym zakresem produkcyjnym aplikacji jest obecnie lista TOP 100 śledzonych gier, dzięki czemu możliwe jest utrzymywanie świeżych danych bez konieczności przetwarzania pełnego katalogu Steam jako zbioru gier obserwowanych. W przypadku pozycji, dla których Steam Store nie zwraca używalnej ceny, system oznacza brak danych i nie generuje pełnej rekomendacji zakupowej.

Aplikacja wykorzystuje własny backend API, który odpowiada za komunikację z zewnętrznymi źródłami danych, walidację odpowiedzi, zapis informacji w bazie PostgreSQL oraz ochronę kluczy dostępowych przed klientami końcowymi. Historia cen i aktywności graczy jest budowana od momentu uruchomienia cyklicznych snapshotów, dlatego nie zakłada się pełnej historii wstecznej dostępnej od razu po wdrożeniu. Na podstawie zebranych danych system oblicza GameValue Score oraz rekomendacje, takie jak: warto kupić, neutralnie, poczekaj na promocję albo brak danych. Frontend webowy oraz aplikacja Android komunikują się wyłącznie z własnym API, natomiast integracje ze Steam, Steam Store i bazą danych pozostają po stronie serwera. Panel administracyjny umożliwia kontrolę integracji, statusu systemu, odświeżania danych i zakresu TOP 100. Moduł GOG pozostaje obecnie rozwiązaniem eksperymentalnym i administracyjnym, niewidocznym publicznie do czasu pełnego domknięcia mapowań produktów. W pracy wykorzystano m.in. Next.js, TypeScript, Prisma, PostgreSQL/Neon, Vercel, React/Vite, Capacitor Android, Steam API oraz konektor Steam Store. Zakres pracy obejmuje projekt architektury, implementację, testy, wdrożenie produkcyjne oraz analizę ograniczeń integracji z zewnętrznymi źródłami danych.

## Streszczenie EN

The aim of this thesis is to design and implement GameValue Radar / Ludolog, a decision-support system for PC game purchases. The application helps users assess whether a given PC game represents an attractive purchase by combining catalog information, Steam Store price data and Steam player activity statistics. The current production scope is focused on the TOP 100 tracked games, which makes it possible to keep the most relevant data up to date without treating the entire Steam catalog as a set of actively tracked titles. When Steam Store does not provide usable price information for a selected game, the system explicitly marks the record as missing data instead of producing a complete purchase recommendation.

The system is built around its own backend API, which is responsible for external integrations, response validation, data persistence and the protection of backend-only credentials. Price history and player-activity history are created from periodic snapshots collected after the refresh processes are enabled; therefore, the project does not assume that a complete historical time series is available immediately after deployment. Based on the collected data, the application calculates a GameValue Score and presents recommendations such as buy, neutral, wait for a sale or insufficient data. Both the web frontend and the Android application communicate only with the project's own API, while Steam, Steam Store and database operations remain server-side. An administrative panel supports integration status monitoring, controlled data refreshes, TOP 100 management and operational diagnostics. The GOG module is currently treated as an experimental, admin-only component and is hidden from public price output until product mappings are fully verified. The project uses Next.js, TypeScript, Prisma, PostgreSQL/Neon, Vercel, React/Vite, Capacitor Android, Steam API and a Steam Store connector. The thesis covers architecture design, implementation, testing, production deployment and an analysis of limitations resulting from external data sources.

## Słowa kluczowe (PL)

gry PC, analiza cen, Steam API, aktywność graczy, system rekomendacji, aplikacja webowa, aplikacja mobilna, PostgreSQL, Next.js, TypeScript, automatyzacja danych

## Keywords (EN)

PC games, price analysis, Steam API, player activity, recommendation system, web application, mobile application, PostgreSQL, Next.js, TypeScript, data automation
