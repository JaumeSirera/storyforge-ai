import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/logo-xandralyze.png";
import { AssistantAvatarWidget } from "@/components/AssistantAvatarWidget";
import { FileText, LayoutDashboard, Library, Plus, Settings, Video } from "lucide-react";

const TITLE = "Muestra del asistente personal | Xandralyze";
const DESCRIPTION = "Vista previa del asistente de Xandralyze con avatar animado: pregúntale por voz o por escrito cómo usar la aplicación.";

export const Route = createFileRoute("/muestra-asistente")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantSamplePage,
});

function AssistantSamplePage() {
  const nav = [
    { Icon: LayoutDashboard, label: "Inicio" },
    { Icon: Library, label: "Mis simulaciones" },
    { Icon: Plus, label: "Nueva" },
    { Icon: Video, label: "Grabaciones" },
    { Icon: FileText, label: "Evaluaciones" },
    { Icon: Settings, label: "Ajustes" },
  ];
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <img src={logo} alt="" className="h-8 w-8" /> Xandralyze
          </Link>
          <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex" aria-label="Menú de ejemplo">
            {nav.map(({ Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5 rounded-md px-3 py-1.5">
                <Icon className="h-4 w-4" /> {label}
              </span>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 pb-[60dvh] sm:pb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Muestra</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Tu asistente personal dentro de la app</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Así se vería el asistente en cualquier pantalla. Pulsa «Escuchar saludo», escríbele o háblale con el
          micrófono. Ciérralo con la X y vuelve a abrirlo desde su foto, abajo a la derecha.
        </p>

        <div className="mt-8 grid max-w-2xl gap-4 sm:grid-cols-2" aria-hidden>
          {["Mis simulaciones", "Evaluaciones", "Grabaciones", "Ajustes"].map((t) => (
            <div key={t} className="rounded-xl border bg-card p-5">
              <div className="font-semibold">{t}</div>
              <div className="mt-3 h-2 w-3/4 rounded bg-muted" />
              <div className="mt-2 h-2 w-1/2 rounded bg-muted" />
            </div>
          ))}
        </div>
      </main>

      <AssistantAvatarWidget />
    </div>
  );
}
