import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { BookOpen, CalendarDays, Share2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/admin/social")({
  head: () => ({ meta: [{ title: "Redes sociales — Xandralyze" }] }),
  component: SocialLayout,
});

const tab =
  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground";

function SocialLayout() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Redes sociales</h2>
          <p className="text-sm text-muted-foreground">
            Convierte un texto en una serie de capítulos y publícalos con Ayrshare.
          </p>
        </div>
        <nav className="flex gap-1 rounded-lg border border-border bg-card p-1" aria-label="Secciones de redes sociales">
          <Link to="/app/admin/social" activeOptions={{ exact: true }} className={tab} activeProps={{ className: "bg-accent text-foreground font-medium" }}>
            <BookOpen className="h-4 w-4" /> Estudio
          </Link>
          <Link to="/app/admin/social/calendar" className={tab} activeProps={{ className: "bg-accent text-foreground font-medium" }}>
            <CalendarDays className="h-4 w-4" /> Calendario
          </Link>
          <Link to="/app/admin/social/networks" className={tab} activeProps={{ className: "bg-accent text-foreground font-medium" }}>
            <Share2 className="h-4 w-4" /> Redes
          </Link>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
