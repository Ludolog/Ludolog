import { BookOpen, Database, Gauge, ShieldCheck } from "lucide-react";

import { getDataMode } from "@/lib/config";

const sections = [
  {
    title: "Cel aplikacji",
    icon: BookOpen,
    body:
      "GameValue Radar wspiera decyzje zakupowe graczy PC przez zestawienie ceny, aktywności społeczności, historii snapshotów i własnego wskaźnika opłacalności."
  },
  {
    title: "Źródła danych",
    icon: Database,
    body:
      "MVP działa w trybie mock, a adaptery oddzielają UI od przyszłych integracji Steam Web API, GOG, Steam Store lub innych dozwolonych API cenowych."
  },
  {
    title: "GameValue Score",
    icon: Gauge,
    body:
      "Score waży cenę względem historycznego minimum, rabat, liczbę graczy, trend popularności oraz dostępność ofert. Wynik jest jawny i deterministyczny."
  },
  {
    title: "Ograniczenia",
    icon: ShieldCheck,
    body:
      "Aplikacja nie wykonuje scrapingu SteamDB, GG.deals ani Steam Store HTML. Klucze API są obsługiwane wyłącznie przez zmienne środowiskowe."
  }
];

export default function AboutPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <section className="surface rounded-lg p-5">
        <p className="mb-2 text-sm font-semibold text-radar-cyan">Engineering thesis context</p>
        <h1 className="text-3xl font-semibold text-white">System wspomagania decyzji zakupowych dla gier PC</h1>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-300">
          Projekt pokazuje integrację wielu źródeł danych, projekt bazy, cykliczne snapshoty, scoring domenowy,
          walidację API, warstwę adapterów oraz interfejs analityczny możliwy do rozbudowy po MVP.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <article key={section.title} className="surface rounded-lg p-5">
              <Icon size={20} className="mb-4 text-radar-green" aria-hidden />
              <h2 className="text-lg font-semibold text-white">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{section.body}</p>
            </article>
          );
        })}
      </section>

      <section className="surface rounded-lg p-5">
        <h2 className="text-lg font-semibold text-white">Architektura systemu</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {["Next.js UI", "API routes", "Service adapters", "PostgreSQL/Prisma"].map((item) => (
            <div key={item} className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm font-semibold text-white">
              {item}
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-400">
          Aktualny tryb danych: <span className="font-semibold text-radar-green">{getDataMode().toUpperCase()}</span>.
          Tryb `api` pokazuje dane z backendu; mock fallback jest dostepny tylko w trybie dev.
        </p>
      </section>
    </div>
  );
}
