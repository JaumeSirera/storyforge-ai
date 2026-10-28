import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicSimulation } from "@/lib/public.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Sparkles, LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import { isAuthenticated } from "@/lib/current-user";
import { onSessionChange } from "@/lib/auth-session";

export const Route = createFileRoute("/explore/$id")({
  head: () => ({
    meta: [
      { title: "Simulación profesional interactiva | Xandralyze" },
      { name: "description", content: "Consulta el objetivo y las competencias de una simulación profesional de Xandralyze antes de participar." },
      { property: "og:title", content: "Simulación profesional interactiva | Xandralyze" },
      { property: "og:description", content: "Descubre el escenario, el objetivo y los criterios de evaluación de esta simulación interactiva." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicSimulationDetail,
});

function PublicSimulationDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const get = useServerFn(getPublicSimulation);
  const sim = useQuery({ queryKey: ["public-sim", id], queryFn: () => get({ data: { id } }) });
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    void isAuthenticated().then(setIsAuthed);
    const off = onSessionChange(() => {
      void isAuthenticated().then(setIsAuthed);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void isAuthenticated().then(setIsAuthed);
    });
    return () => {
      off();
      sub.subscription.unsubscribe();
    };
  }, []);

  if (sim.isLoading) return <div className="p-8 text-muted-foreground">Cargando…</div>;
  if (!sim.data) return <div className="p-8">Simulación no disponible.</div>;

  const s = sim.data as any;
  const criteria = (s.evaluation_criteria ?? []) as any[];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <Link to="/explore" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Galería
          </Link>
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-5 w-5 text-primary" /> Xandralyze
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
        {s.cover_image_url && (
          <div className="aspect-video overflow-hidden rounded-xl border border-border">
            <img src={s.cover_image_url} alt={s.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div>
          <h1 className="text-3xl font-bold tracking-tight">{s.title}</h1>
          <p className="text-muted-foreground mt-2">{s.objective}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {s.topic && <Badge variant="secondary">{s.topic}</Badge>}
            <Badge variant="outline">{s.duration_min ?? 15} min</Badge>
          </div>
        </div>

        <Card className="shadow-glow">
          <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">¿Listo para jugar?</h2>
              <p className="text-sm text-muted-foreground">
                {isAuthed
                  ? "Rellena tus datos y comienza. Al terminar, el creador podrá enviarte feedback."
                  : "Necesitas una cuenta gratuita para jugar y guardar tu resultado."}
              </p>
            </div>
            {isAuthed ? (
              <Button size="lg" className="gap-2" onClick={() => navigate({ to: "/app/play/$id", params: { id } })}>
                <Play className="h-4 w-4" /> Empezar
              </Button>
            ) : (
              <Button asChild size="lg" className="gap-2">
                <Link to="/auth" search={{ redirect: `/app/play/${id}` } as any}>
                  <LogIn className="h-4 w-4" /> Iniciar sesión para jugar
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {criteria.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>¿Qué competencias evalúa?</CardTitle>
              <CardDescription>Aspectos que la IA analizará en tus decisiones.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {criteria.map((c: any) => (
                <div key={c.key} className="rounded-lg border border-border p-3">
                  <div className="font-medium">{c.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{c.description}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
