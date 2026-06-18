import { BookOpen, Database, Smartphone, Wifi } from "lucide-react";

export function AboutView(): React.ReactElement {
  return (
    <div className="space-y-4">
      <section className="surface rounded-lg p-4">
        <h1 className="text-2xl font-semibold text-white">Engineering / Android</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Android MVP działa jako klient API. Backend Next.js, Prisma i PostgreSQL zostają poza APK, a aplikacja mobilna
          pobiera dane przez endpointy HTTP.
        </p>
      </section>

      <InfoCard
        icon={<Smartphone size={20} />}
        title="Klient mobilny"
        body="React + Vite + Capacitor renderują lekki interfejs telefonu z dolną nawigacją i dużymi CTA."
      />
      <InfoCard
        icon={<Wifi size={20} />}
        title="Komunikacja"
        body="API_BASE_URL wskazuje backend. Development emulator uses the host alias described in the Android docs."
      />
      <InfoCard
        icon={<Database size={20} />}
        title="Backend"
        body="Next.js nadal obsługuje web, API route’y, mock/API mode, snapshoty i scoring GameValue."
      />
      <InfoCard
        icon={<BookOpen size={20} />}
        title="Rozwój"
        body="Kolejne kroki to push notifications, offline cache, natywne alerty cenowe i release signing."
      />
    </div>
  );
}

function InfoCard({
  icon,
  title,
  body
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}): React.ReactElement {
  return (
    <article className="surface rounded-lg p-4">
      <div className="mb-3 text-radar-cyan">{icon}</div>
      <h2 className="font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{body}</p>
    </article>
  );
}
