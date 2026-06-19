import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getSimulation,
  listPreviewDrafts,
  publishSimulation,
  revertToDraft,
} from "@/lib/simulations.functions";
import { startSession } from "@/lib/sessions.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
  Play,
  RotateCcw,
  Rocket,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/simulations/$id/review")({
  component: ReviewSimulation,
});

function ReviewSimulation() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const get = useServerFn(getSimulation);
  const listDrafts = useServerFn(listPreviewDrafts);
  const publish = useServerFn(publishSimulation);
  const revert = useServerFn(revertToDraft);
  const start = useServerFn(startSession);

  const sim = useQuery({ queryKey: ["sim", id], queryFn: () => get({ data: { id } }) });
  const drafts = useQuery({
    queryKey: ["preview-drafts", id],
    queryFn: () => listDrafts({ data: { simulationId: id } }),
  });

  const [publishing, setPublishing] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [starting, setStarting] = useState(false);

  if (sim.isLoading) return <p className="text-muted-foreground">Cargando...</p>;
  if (!sim.data) return <p>No encontrada.</p>;

  const status = sim.data.status as string;
  const isInReview = status === "in_review";
  const isPublished = status === "published";
  const editable = status === "draft" || status === "ready";

  const handlePublish = async () => {
    if (!confirm("Esto publicará la simulación y la hará accesible a otros usuarios. ¿Continuar?")) return;
    setPublishing(true);
    try {
      await publish({ data: { id } });
      toast.success("Simulación publicada");
      qc.invalidateQueries({ queryKey: ["sim", id] });
      qc.invalidateQueries({ queryKey: ["my-simulations"] });
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo publicar");
    } finally {
      setPublishing(false);
    }
  };

  const handleRevert = async () => {
    if (!confirm("Volver a borrador desbloqueará la edición y la simulación dejará de estar publicada. ¿Continuar?")) return;
    setReverting(true);
    try {
      await revert({ data: { id } });
      toast.success("Vuelta a borrador");
      qc.invalidateQueries({ queryKey: ["sim", id] });
      qc.invalidateQueries({ queryKey: ["my-simulations"] });
      navigate({ to: "/app/simulations/$id/edit", params: { id } });
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo revertir");
    } finally {
      setReverting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <Link
          to="/app/simulations/$id"
          params={{ id }}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver
        </Link>
        <Badge
          variant={isPublished ? "default" : isInReview ? "secondary" : "outline"}
          className="gap-1"
        >
          {isPublished ? <CheckCircle2 className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {isPublished ? "Publicada" : isInReview ? "En revisión" : "Borrador"}
        </Badge>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Revisión y publicación</h1>
        <p className="text-muted-foreground mt-1">{sim.data.title}</p>
      </div>

      {editable && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-sm text-muted-foreground">
            La simulación está en borrador. Envíala a revisión desde el editor para poder publicarla.
            <div className="mt-3">
              <Button asChild size="sm" variant="outline">
                <Link to="/app/simulations/$id/edit" params={{ id }}>Ir al editor</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(isInReview || isPublished) && (
        <Card className="shadow-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isPublished ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Lock className="h-5 w-5" />}
              {isPublished ? "Simulación publicada" : "Pendiente de aprobación"}
            </CardTitle>
            <CardDescription>
              {isPublished
                ? "La simulación está publicada y disponible. Para hacer cambios, vuelve a borrador."
                : "Mientras está en revisión, la edición está bloqueada. Prueba los borradores jugables, decide si publicar, o vuelve a borrador para seguir editando."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {!isPublished && (
              <Button onClick={handlePublish} disabled={publishing} className="gap-2">
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                Publicar simulación
              </Button>
            )}
            <Button onClick={handleRevert} disabled={reverting} variant="outline" className="gap-2">
              {reverting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Volver a borrador
            </Button>
            <Button
              variant="ghost"
              disabled={starting}
              onClick={async () => {
                setStarting(true);
                try {
                  const r = await start({ data: { simulationId: id } });
                  navigate({ to: "/app/sessions/$id", params: { id: r.id } });
                } finally {
                  setStarting(false);
                }
              }}
              className="gap-2"
            >
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Jugar partida completa
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Borradores jugables</CardTitle>
          <CardDescription>
            Sesiones guardadas desde la vista previa. Úsalas para revisar el recorrido antes de publicar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {drafts.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando borradores...</p>
          ) : (drafts.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay borradores jugables. Crea uno desde la vista previa del editor.
            </p>
          ) : (
            <div className="space-y-2">
              {drafts.data!.map((d: any) => {
                const answers = Array.isArray(d.answers) ? d.answers : [];
                return (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div className="text-sm">
                      <div className="font-medium">
                        Borrador del {new Date(d.updated_at ?? d.started_at).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {answers.length} decisiones · {d.score ?? 0} pts · escena actual:{" "}
                        <span className="font-mono">{d.current_node_id ?? "FIN"}</span>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline" className="gap-1">
                      <Link to="/app/sessions/$id" params={{ id: d.id }}>
                        <Play className="h-3 w-3" /> Reanudar
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
