import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSimulation } from "@/lib/simulations.functions";
import { startSession } from "@/lib/sessions.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, ArrowLeft, GitBranch, HelpCircle, Loader2, Pencil } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/app/simulations/$id")({
  component: SimulationDetail,
});

function SimulationDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const get = useServerFn(getSimulation);
  const start = useServerFn(startSession);
  const sim = useQuery({ queryKey: ["sim", id], queryFn: () => get({ data: { id } }) });
  const [starting, setStarting] = useState(false);

  if (sim.isLoading) return <p className="text-muted-foreground">Cargando...</p>;
  if (!sim.data) return <p>No encontrada.</p>;

  const story = (sim.data.story ?? {}) as { nodes?: Record<string, any>; startNodeId?: string };
  const nodeCount = Object.keys(story.nodes ?? {}).length;
  const questionCount = Object.values(story.nodes ?? {}).filter((n: any) => n.question).length;
  const criteria = (sim.data.evaluation_criteria ?? []) as any[];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to="/app/simulations" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{sim.data.title}</h1>
        <p className="text-muted-foreground mt-1">{sim.data.objective}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {sim.data.topic && <Badge variant="secondary">{sim.data.topic}</Badge>}
          <Badge variant="outline">{sim.data.duration_min} min</Badge>
          <Badge variant="outline" className="gap-1"><GitBranch className="h-3 w-3" /> {nodeCount} escenas</Badge>
          <Badge variant="outline" className="gap-1"><HelpCircle className="h-3 w-3" /> {questionCount} preguntas</Badge>
        </div>
      </div>

      <Card className="shadow-glow">
        <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">¿Listo para jugar?</h2>
            <p className="text-sm text-muted-foreground">Tomarás decisiones y al final recibirás tu informe.</p>
          </div>
          <Button
            size="lg"
            disabled={starting}
            onClick={async () => {
              setStarting(true);
              try {
                const r = await start({ data: { simulationId: id } });
                navigate({ to: "/app/sessions/$id", params: { id: r.id } });
              } finally { setStarting(false); }
            }}
            className="gap-2"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Empezar simulación
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Criterios de evaluación</CardTitle>
          <CardDescription>Competencias que mediremos a lo largo del juego.</CardDescription>
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

      <Card>
        <CardHeader>
          <CardTitle>Escenas</CardTitle>
          <CardDescription>Vista del árbol de decisiones generado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.values(story.nodes ?? {}).map((n: any) => (
            <div key={n.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{n.title}</div>
                {n.isEnding && (
                  <Badge variant={n.endingType === "success" ? "default" : "secondary"}>
                    Final {n.endingType ?? ""}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.narrative}</p>
              {n.question && (
                <div className="mt-2 text-xs">
                  <span className="font-medium">P:</span> {n.question.text}
                  <ul className="mt-1 ml-4 list-disc text-muted-foreground">
                    {n.question.choices.map((c: any) => (
                      <li key={c.id}>
                        {c.label} <span className="opacity-70">({c.points >= 0 ? "+" : ""}{c.points} pts → {c.next ?? "FIN"})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
