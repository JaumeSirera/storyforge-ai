import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getSessionInsights,
  generateSessionInsights,
  deleteSessionInsights,
} from "@/lib/insights.functions";
import { getSessionAnalysis } from "@/lib/analyze.functions";
import { getCaptureSession } from "@/lib/capture.functions";
import { downloadInsightsPdf } from "@/lib/insights-pdf";
import { formatSec } from "@/lib/analyze-metrics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Download,
  Info,
  Lightbulb,
  Loader2,
  Sparkles,
  Trash2,
  ListChecks,
  HelpCircle,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { IntegratedReportButton } from "@/components/IntegratedReportButton";

export const Route = createFileRoute("/_authenticated/app/capture/$id/insights")({
  head: () => ({
    meta: [
      { title: "Conclusiones — informe de interacción | Playnalyze" },
      {
        name: "description",
        content:
          "Informe profesional con hechos observables, hipótesis trazables y recomendaciones a partir de las métricas de la sesión.",
      },
      { property: "og:title", content: "Conclusiones — informe de interacción | Playnalyze" },
      {
        property: "og:description",
        content:
          "Convierte las métricas de la sesión en un informe accionable con evidencia temporal y descarga en PDF.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InsightsPage,
});

const CONFIDENCE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  alta: "default",
  media: "secondary",
  baja: "outline",
};

function InsightsPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getSession = useServerFn(getCaptureSession);
  const getAnalysis = useServerFn(getSessionAnalysis);
  const getInsights = useServerFn(getSessionInsights);
  const generate = useServerFn(generateSessionInsights);
  const wipe = useServerFn(deleteSessionInsights);

  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const sessionQ = useQuery({
    queryKey: ["capture-session", id],
    queryFn: () => getSession({ data: { id } }),
  });
  const analysisQ = useQuery({
    queryKey: ["capture-analysis", id],
    queryFn: () => getAnalysis({ data: { captureSessionId: id } }),
  });
  const insightsQ = useQuery({
    queryKey: ["capture-insights", id],
    queryFn: () => getInsights({ data: { captureSessionId: id } }),
  });

  const participants = sessionQ.data?.participants ?? [];
  const metrics = analysisQ.data?.analysis?.metrics ?? null;
  const hasTranscript = (analysisQ.data?.segments ?? []).length > 0;
  const insights = insightsQ.data?.insights ?? null;

  const nameOf = (key: string) => {
    const p = participants.find((x) => x.id === key);
    if (p) return p.name;
    return key.startsWith("speaker") ? `Hablante ${key.replace(/\D+/g, "") || "?"}` : key;
  };

  async function run(key: string, fn: () => Promise<unknown>, okMsg: string) {
    setBusy(key);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["capture-insights", id] });
      toast.success(okMsg);
    } catch (e: any) {
      toast.error(e?.message || "La operación falló");
    } finally {
      setBusy(null);
    }
  }

  if (sessionQ.isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (!sessionQ.data?.session) return <p>Sesión no encontrada.</p>;
  const session = sessionQ.data.session;

  return (
    <div className="max-w-5xl space-y-6">
      <Link
        to="/app/capture/$id/analyze"
        params={{ id }}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Volver a Analizar
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conclusiones · {session.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe profesional a partir de las métricas y la transcripción de la sesión.
            {insights?.generatedAt
              ? ` Generado el ${new Date(insights.generatedAt).toLocaleString("es-ES")}.`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="gap-2"
            disabled={busy !== null || !hasTranscript}
            onClick={() =>
              run(
                "generate",
                () => generate({ data: { captureSessionId: id, focus: focus.trim() || undefined } }),
                "Informe generado",
              )
            }
          >
            {busy === "generate" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {insights ? "Regenerar informe" : "Generar informe"}
          </Button>
          {insights && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() =>
                  downloadInsightsPdf({
                    sessionTitle: session.title,
                    areaLabel: session.areaKey ?? null,
                    generatedAt: insights.generatedAt,
                    insights,
                    metrics,
                    speakerName: nameOf,
                  })
                }
              >
                <Download className="h-4 w-4" /> Descargar PDF
              </Button>
              <IntegratedReportButton captureSessionId={id} variant="outline" />

              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-destructive"
                disabled={busy !== null}
                onClick={() => {
                  if (!confirm("¿Borrar el informe de conclusiones de esta sesión?")) return;
                  run("wipe", () => wipe({ data: { captureSessionId: id } }), "Informe eliminado");
                }}
              >
                <Trash2 className="h-4 w-4" /> Borrar
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Las <strong>hipótesis</strong> son interpretaciones no concluyentes apoyadas en evidencia
          observable. No son diagnósticos clínicos ni juicios de personalidad: la decisión final es
          siempre del profesional.
        </p>
      </div>

      {!hasTranscript && (
        <Card>
          <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
            <p>
              Todavía no hay transcripción para esta sesión. Transcribe las grabaciones en Analizar y
              vuelve aquí para generar el informe.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/capture/$id/analyze" params={{ id }}>
                Ir a Analizar
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {hasTranscript && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Foco del informe (opcional)</CardTitle>
            <CardDescription>
              Indica qué te interesa observar: liderazgo del grupo, gestión del conflicto, escucha
              activa, claridad al explicar…
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="focus" className="sr-only">
              Foco del informe
            </Label>
            <Textarea
              id="focus"
              rows={2}
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="Ej.: cómo se reparte la iniciativa y cómo se gestionan los desacuerdos"
            />
          </CardContent>
        </Card>
      )}

      {metrics && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Duración analizada" value={formatSec(metrics.spanSec)} />
          <Stat label="Turnos de palabra" value={String(metrics.totalTurns)} />
          <Stat label="Interrupciones" value={String(metrics.totalInterruptions)} />
          <Stat
            label="Equilibrio de participación"
            value={`${Math.round(metrics.participationBalance * 100)}%`}
          />
        </div>
      )}

      {insights && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="h-4 w-4" /> {insights.headline}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{insights.summary}</p>
            </CardContent>
          </Card>

          {insights.observations?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="h-4 w-4" /> Hechos observables
                </CardTitle>
                <CardDescription>Cada hecho va acompañado de su evidencia.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {insights.observations.map((o, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium">{o.fact}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Evidencia: {o.evidence}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {insights.hypotheses?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hipótesis de trabajo</CardTitle>
                <CardDescription>
                  Interpretaciones trazables, con su base observable y nivel de confianza.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {insights.hypotheses.map((h, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{h.hypothesis}</p>
                      <Badge variant={CONFIDENCE_VARIANT[h.confidence] ?? "outline"}>
                        confianza {h.confidence}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Base: {h.basis}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {insights.participants?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" /> Comportamientos por participante
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {insights.participants.map((p, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.role}</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {p.behaviours.map((b, j) => (
                        <li key={j} className="text-muted-foreground">
                          · {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {insights.recommendations?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recomendaciones</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {insights.recommendations.map((r, i) => (
                      <li key={i}>· {r}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {insights.followUpQuestions?.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <HelpCircle className="h-4 w-4" /> Preguntas de seguimiento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {insights.followUpQuestions.map((q, i) => (
                      <li key={i}>· {q}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
