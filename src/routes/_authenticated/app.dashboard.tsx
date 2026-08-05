import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMySimulations } from "@/lib/simulations.functions";
import { listMySessions } from "@/lib/sessions.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trophy, Star, PlayCircle, ArrowRight, Search, CheckCircle2, Circle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_authenticated/app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "in_progress">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const listSims = useServerFn(listMySimulations);
  const listSess = useServerFn(listMySessions);
  const sims = useQuery({ queryKey: ["my-simulations"], queryFn: () => listSims() });
  const sess = useQuery({ queryKey: ["my-sessions"], queryFn: () => listSess() });

  const filteredSessions = useMemo(() => {
    const rows = (sess.data ?? []) as any[];
    return rows.filter((s) => {
      const isCompleted = !!s.completed_at;
      const statusMatch =
        statusFilter === "all"
          ? true
          : statusFilter === "completed"
            ? isCompleted
            : !isCompleted;
      const text = [s.simulation?.title ?? "", s.candidate_name ?? "", s.candidate_email ?? ""]
        .join(" ")
        .toLowerCase();
      const searchMatch = !searchQuery || text.includes(searchQuery.toLowerCase());
      return statusMatch && searchMatch;
    });
  }, [sess.data, statusFilter, searchQuery]);

  const completedCount = (sess.data ?? []).filter((s: any) => !!s.completed_at).length;
  const inProgressCount = (sess.data ?? []).length - completedCount;

  const totalScore = (sess.data ?? []).reduce((acc, s: any) => acc + (s.score ?? 0), 0);
  const totalStars = (sess.data ?? []).reduce((acc, s: any) => acc + (s.stars ?? 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hola 👋</h1>
          <p className="text-muted-foreground mt-1">
            Crea simulaciones con IA o continúa jugando.
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/app/new" })} className="gap-2">
          <Plus className="h-4 w-4" /> Nueva simulación
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Simulaciones creadas" value={sims.data?.length ?? 0} />
        <StatCard label="Puntos acumulados" value={totalScore} icon={Trophy} />
        <StatCard label="Estrellas ganadas" value={totalStars} icon={Star} />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Mis simulaciones</h2>
          <Link to="/app/simulations" className="text-sm text-primary hover:underline">
            Ver todas
          </Link>
        </div>
        {sims.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : (sims.data?.length ?? 0) === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sims.data!.slice(0, 6).map((s: any) => (
              <Card key={s.id} className="shadow-soft hover:shadow-glow transition">
                <CardHeader>
                  <CardTitle className="text-base line-clamp-2">{s.title}</CardTitle>
                  <CardDescription className="line-clamp-2">{s.objective}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {s.duration_min} min · {s.topic ?? "general"}
                  </span>
                  <Link to="/app/simulations/$id" params={{ id: s.id }}>
                    <Button size="sm" variant="ghost" className="gap-1">
                      Abrir <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Tus últimas partidas</h2>
          <span className="text-xs text-muted-foreground">
            {(sess.data?.length ?? 0)} partida(s) · {completedCount} completada(s) · {inProgressCount} en curso
          </span>
        </div>
        <div className="flex flex-col gap-3 mb-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por simulación, candidato..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              aria-label="Buscar partidas"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por estado">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="completed">Completadas</SelectItem>
              <SelectItem value="in_progress">En curso</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(sess.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no has jugado ninguna simulación.</p>
        ) : filteredSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay partidas que coincidan con los filtros.</p>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto rounded-2xl border border-border bg-card divide-y divide-border">
            {filteredSessions.map((s: any) => {
              const isCompleted = !!s.completed_at;
              return (
                <div
                  key={s.id}
                  className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                    isCompleted ? "bg-muted/30" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium truncate">{s.simulation?.title ?? "Simulación"}</div>
                      <Badge
                        variant={isCompleted ? "default" : "outline"}
                        className="gap-1 text-xs"
                      >
                        {isCompleted ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" /> Completada
                          </>
                        ) : (
                          <>
                            <Circle className="h-3 w-3" /> En curso
                          </>
                        )}
                      </Badge>
                      {s.admin_feedback && (
                        <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          Feedback del creador
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {s.candidate_name ? `${s.candidate_name} · ` : ""}
                      {s.candidate_email ? `${s.candidate_email} · ` : ""}
                      {formatDistanceToNow(new Date(s.started_at), { addSuffix: true, locale: es })}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1">
                      <Trophy className="h-3.5 w-3.5 text-primary" />
                      {s.score ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-warning" />
                      {s.stars ?? 0}
                    </span>
                    <Link to="/app/sessions/$id" params={{ id: s.id }}>
                      <Button size="sm" variant="ghost" aria-label={isCompleted ? "Ver partida completada" : "Continuar partida en curso"}>
                        <PlayCircle className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon?: any }) {
  return (
    <Card className="shadow-soft">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-3xl font-bold mt-1">{value}</div>
          </div>
          {Icon && (
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground">
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="shadow-soft border-dashed">
      <CardContent className="py-12 text-center space-y-3">
        <div className="text-5xl">🎬</div>
        <h3 className="text-lg font-semibold">Crea tu primera simulación</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Describe el objetivo, aporta tu guion y vídeos, y deja que la IA construya el juego.
        </p>
        <Link to="/app/new" className="inline-block pt-2">
          <Button>
            <Plus className="h-4 w-4 mr-2" /> Crear simulación
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
