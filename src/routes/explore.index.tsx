import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPublicSimulations } from "@/lib/public.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Sparkles, Home, Gamepad2 } from "lucide-react";

export const Route = createFileRoute("/explore/")({
  head: () => ({
    meta: [
      { title: "Galería de juegos gamificados — Xandralyze" },
      {
        name: "description",
        content:
          "Descubre vídeos convertidos en juegos interactivos: preguntas, decisiones, puntuación y informe de competencias. Creados con IA en minutos.",
      },
      { property: "og:title", content: "Galería de juegos gamificados — Xandralyze" },
      {
        property: "og:description",
        content: "Juega vídeos interactivos profesionales generados con IA.",
      },
    ],
  }),
  component: ExploreIndex,
});

function ExploreIndex() {
  const list = useServerFn(listPublicSimulations);
  const q = useQuery({ queryKey: ["public-sims"], queryFn: () => list() });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold" aria-label="Xandralyze — inicio">
            <img
              src={logoAsset.url}
              alt="Logotipo de Xandralyze"
              className="h-6 w-auto"
              width={24}
              height={24}
            />
            Xandralyze
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><Home className="h-4 w-4 mr-1" /> Inicio</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth">Iniciar sesión</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 space-y-8">
        <div className="text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Gamepad2 className="h-3.5 w-3.5" />
            Vídeos convertidos en juegos
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight">
            Galería de juegos gamificados
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl">
            Explora simulaciones interactivas creadas por profesionales. Responde, decide y recibe un informe de competencias al finalizar.
          </p>
        </div>

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (q.data?.length ?? 0) === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-14 text-center space-y-4">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10">
                <Gamepad2 className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold">Todavía no hay juegos en la galería</p>
                <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                  La galería solo muestra simulaciones marcadas como públicas y publicadas. Si eres
                  propietario, abre tu simulación, envíala a revisión y pulsa «Publicar» para que
                  aparezca aquí.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild size="sm">
                  <Link to="/app/simulations">Ir a mis simulaciones</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/">Volver al inicio</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {q.data!.map((s: any) => (
              <Card key={s.id} className="overflow-hidden shadow-soft hover:shadow-glow transition">
                {s.cover_image_url ? (
                  <div className="aspect-video bg-muted overflow-hidden">
                    <img src={s.cover_image_url} alt={s.title} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 grid place-items-center">
                    <Sparkles className="h-8 w-8 text-primary/60" />
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-base line-clamp-2">{s.title}</CardTitle>
                  <CardDescription className="line-clamp-3">{s.objective}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-2">
                  <div className="flex gap-1 flex-wrap">
                    {s.topic && <Badge variant="secondary">{s.topic}</Badge>}
                    <Badge variant="outline">{s.duration_min ?? 15} min</Badge>
                  </div>
                  <Button asChild size="sm" className="gap-1">
                    <Link to="/explore/$id" params={{ id: s.id }}>
                      <Play className="h-3.5 w-3.5" /> Jugar
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
