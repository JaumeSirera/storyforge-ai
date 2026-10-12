import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { listSocialQueue } from "@/lib/social.functions";
import { STATUS_LABEL, networkName } from "@/lib/social-shared";

export const Route = createFileRoute("/_authenticated/app/admin/social/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const fetchQueue = useServerFn(listSocialQueue);
  const q = useQuery({ queryKey: ["social-queue"], queryFn: () => fetchQueue(), retry: 1 });

  const groups = new Map<string, NonNullable<typeof q.data>>();
  for (const item of q.data ?? []) {
    const key = new Date(item.scheduled_at).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return (
    <div className="space-y-5">
      {q.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
      {q.data?.length === 0 && <p className="text-sm text-muted-foreground">No hay capítulos programados. Programa una serie desde el Estudio.</p>}
      {[...groups.entries()].map(([day, items]) => (
        <div key={day}>
          <h3 className="mb-2 text-sm font-semibold capitalize">{day}</h3>
          <div className="space-y-2">
            {items.map((i) => (
              <Link key={i.id} to="/app/admin/social/$id" params={{ id: i.story_id }} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 hover:shadow-soft">
                <span className="w-12 text-sm tabular-nums text-muted-foreground">
                  {new Date(i.scheduled_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{i.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{i.story_title} · {i.networks.map(networkName).join(", ") || "sin redes"}</div>
                </div>
                <Badge variant={i.status === "error" ? "destructive" : i.status === "publicado" ? "default" : "secondary"}>{STATUS_LABEL[i.status]}</Badge>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
