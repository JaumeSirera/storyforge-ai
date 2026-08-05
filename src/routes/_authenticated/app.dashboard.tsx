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
  const listSims = useServerFn(listMySimulations);
  const listSess = useServerFn(listMySessions);
  const sims = useQuery({ queryKey: ["my-simulations"], queryFn: () => listSims() });
  const sess = useQuery({ queryKey: ["my-sessions"], queryFn: () => listSess() });

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
            {sess.data?.length ?? 0} partida(s)
          </span>
        </div>
        {(sess.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no has jugado ninguna simulación.</p>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto rounded-2xl border border-border bg-card divide-y divide-border">

            {sess.data!.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="font-medium">{s.simulation?.title ?? "Simulación"}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.completed_at ? "Terminada" : "En curso"} ·{" "}
                    {formatDistanceToNow(new Date(s.started_at), { addSuffix: true, locale: es })}
                  </div>
                  {s.admin_feedback && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      Feedback del creador disponible
                    </div>
                  )}
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
                    <Button size="sm" variant="ghost">
                      <PlayCircle className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
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
