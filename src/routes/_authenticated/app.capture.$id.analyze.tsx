import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  getSessionAnalysis,
  transcribeRecording,
  assignSpeaker,
  recomputeSessionMetrics,
  deleteSessionAnalysis,
} from "@/lib/analyze.functions";
import { getCaptureSession, PARTICIPANT_ROLE_LABELS } from "@/lib/capture.functions";
import { listSceneAnnotations } from "@/lib/scene-annotations.functions";
import { formatSec, type SpeakerMetrics } from "@/lib/analyze-metrics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  AudioLines,
  Loader2,
  RefreshCw,
  Trash2,
  Users,
  MessageSquare,
  Info,
  Sparkles,
  Film,
  NotebookPen,

} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/capture/$id/analyze")({
  head: () => ({
    meta: [
      { title: "Analyze — métricas de interacción | Playnalyze" },
      {
        name: "description",
        content:
          "Transcripción por hablante y métricas objetivas: turnos de palabra, tiempo hablando, interrupciones, silencios y red de interacción.",
      },
      { property: "og:title", content: "Analyze — métricas de interacción | Playnalyze" },
      {
        property: "og:description",
        content: "Evidencias observables de la sesión, trazables al minuto exacto de la grabación.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnalyzePage,
});

function AnalyzePage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getSession = useServerFn(getCaptureSession);
  const getAnalysis = useServerFn(getSessionAnalysis);
  const transcribe = useServerFn(transcribeRecording);
  const assign = useServerFn(assignSpeaker);
  const recompute = useServerFn(recomputeSessionMetrics);
  const wipe = useServerFn(deleteSessionAnalysis);
  const listAnnotations = useServerFn(listSceneAnnotations);

  const sessionQ = useQuery({
    queryKey: ["capture-session", id],
    queryFn: () => getSession({ data: { id } }),
  });
  const analysisQ = useQuery({
    queryKey: ["capture-analysis", id],
    queryFn: () => getAnalysis({ data: { captureSessionId: id } }),
  });
  const annotationsQ = useQuery({
    queryKey: ["scene-annotations", id],
    queryFn: () => listAnnotations({ data: { captureSessionId: id } }),
  });
  const annotations = annotationsQ.data?.annotations ?? [];



  const [busy, setBusy] = useState<string | null>(null);

  const participants = sessionQ.data?.participants ?? [];
  const recordings = (sessionQ.data?.recordings ?? []).filter((r) => r.kind !== "screen");
  const segments = analysisQ.data?.segments ?? [];
  const analysis = analysisQ.data?.analysis ?? null;
  const metrics = analysis?.metrics ?? null;
  const edges = analysis?.interactions?.edges ?? [];

  const nameOf = (key: string) => {
    const p = participants.find((x) => x.id === key);
    if (p) return p.name;
    return key.startsWith("speaker") ? `Hablante ${key.replace(/\D+/g, "") || "?"}` : key;
  };
  const colorOf = (key: string) =>
    participants.find((x) => x.id === key)?.color ?? "#64748b";

  const unassignedLabels = useMemo(() => {
    const set = new Set<string>();
    for (const s of segments) if (!s.participantId && s.speakerLabel) set.add(s.speakerLabel);
    return [...set].sort();
  }, [segments]);

  async function run(key: string, fn: () => Promise<unknown>, okMsg: string) {
    setBusy(key);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["capture-analysis", id] });
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
    <div className="space-y-6 max-w-5xl">
      <Link
        to="/app/capture/$id"
        params={{ id }}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver a la sesión
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analizar · {session.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Métricas objetivas de la interacción. Cada dato es trazable al minuto exacto de la
            grabación.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="gap-2">
            <Link to="/app/capture/$id/scenes" params={{ id }}>
              <Film className="h-4 w-4" /> Escenas
            </Link>
          </Button>
          <Button asChild size="sm" className="gap-2">
            <Link to="/app/capture/$id/insights" params={{ id }}>
              <Sparkles className="h-4 w-4" /> Conclusiones
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={busy !== null || segments.length === 0}
            onClick={() =>
              run("recompute", () => recompute({ data: { captureSessionId: id } }), "Métricas recalculadas")
            }
          >
            <RefreshCw className="h-4 w-4" /> Recalcular
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-destructive"
            disabled={busy !== null || segments.length === 0}
            onClick={() => {
              if (!confirm("¿Borrar la transcripción y el análisis de esta sesión?")) return;
              run("wipe", () => wipe({ data: { captureSessionId: id } }), "Análisis eliminado");
            }}
          >
            <Trash2 className="h-4 w-4" /> Borrar análisis
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Este módulo describe <strong>comportamientos observables</strong> (turnos, tiempos,
          interrupciones, silencios). No emite diagnósticos clínicos ni conclusiones sobre la
          personalidad: la interpretación corresponde al profesional.
        </p>
      </div>

      {/* Transcripción */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AudioLines className="h-4 w-4" /> Transcripción por hablante
          </CardTitle>
          <CardDescription>
            Cada pista se transcribe con separación automática de hablantes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recordings.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Esta sesión aún no tiene grabaciones de audio o cámara.
            </p>
          )}
          {recordings.map((r) => {
            const p = participants.find((x) => x.id === r.participantId);
            const done = segments.filter((s) => s.recordingId === r.id).length;
            return (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {r.kind === "audio" ? "Audio" : "Cámara"}
                    {p ? ` · ${p.name}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.durationSec ? `${Math.round(r.durationSec)} s · ` : ""}
                    {done > 0 ? `${done} turnos transcritos` : "sin transcribir"}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={busy !== null}
                  onClick={() =>
                    run(
                      r.id,
                      () => transcribe({ data: { captureSessionId: id, recordingId: r.id } }),
                      "Transcripción completada",
                    )
                  }
                >
                  {busy === r.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <AudioLines className="h-4 w-4" />
                  )}
                  {done > 0 ? "Rehacer" : "Transcribir"}
                </Button>
              </div>
            );
          })}
          {analysis?.status === "failed" && analysis.errorMessage && (
            <p className="text-sm text-destructive">{analysis.errorMessage}</p>
          )}
        </CardContent>
      </Card>

      {/* Identidades */}
      {unassignedLabels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Identificación de hablantes
            </CardTitle>
            <CardDescription>
              Asigna cada voz detectada a un participante para mantener su identidad durante toda la
              sesión.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {unassignedLabels.map((label) => (
              <div
                key={label}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{nameOf(label)}</p>
                  <p className="text-xs text-muted-foreground">
                    {segments.filter((s) => s.speakerLabel === label).length} turnos
                  </p>
                </div>
                <Select
                  onValueChange={(v) =>
                    run(
                      label,
                      () =>
                        assign({
                          data: { captureSessionId: id, speakerLabel: label, participantId: v },
                        }),
                      "Hablante identificado",
                    )
                  }
                >
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Asignar a participante…" />
                  </SelectTrigger>
                  <SelectContent>
                    {participants.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {PARTICIPANT_ROLE_LABELS[p.role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Métricas */}
      {metrics && metrics.speakers.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Turnos de palabra" value={String(metrics.totalTurns)} />
            <Stat label="Tiempo hablando" value={formatSec(metrics.totalSpeechSec)} />
            <Stat label="Interrupciones" value={String(metrics.totalInterruptions)} />
            <Stat
              label="Equilibrio de participación"
              value={`${Math.round(metrics.participationBalance * 100)}%`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribución de la participación</CardTitle>
              <CardDescription>
                Reparto observado del tiempo de palabra y de las interrupciones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {metrics.speakers.map((s: SpeakerMetrics) => (
                <div key={s.key} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: colorOf(s.key) }}
                        aria-hidden="true"
                      />
                      {nameOf(s.key)}
                    </span>
                    <span className="text-muted-foreground">
                      {s.talkSharePct}% · {formatSec(s.talkTimeSec)} · {s.turns} turnos
                    </span>
                  </div>
                  <Progress value={s.talkSharePct} aria-label={`Participación de ${nameOf(s.key)}`} />
                  <p className="text-xs text-muted-foreground">
                    Turno medio {formatSec(s.avgTurnSec)} · turno más largo{" "}
                    {formatSec(s.longestTurnSec)} · interrumpe {s.interruptionsMade} · es
                    interrumpido {s.interruptionsReceived} · inicia tema {s.topicStarts} veces
                    {s.firstSpokeAtSec !== null
                      ? ` · primera intervención ${formatSec(s.firstSpokeAtSec)}`
                      : ""}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {edges.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Red de interacción</CardTitle>
                <CardDescription>Quién responde a quién y con qué frecuencia.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {edges.slice(0, 20).map((e) => (
                  <div
                    key={`${e.from}-${e.to}`}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate">
                      {nameOf(e.from)} <span className="text-muted-foreground">responde a</span>{" "}
                      {nameOf(e.to)}
                    </span>
                    <Badge variant="secondary">
                      {e.count} veces · {formatSec(e.secondsSec)}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {metrics.silences.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Silencios del grupo</CardTitle>
                <CardDescription>
                  Pausas de más de 2 segundos ({formatSec(metrics.silenceSec)} en total).
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {metrics.silences.slice(0, 40).map((s, i) => (
                  <Badge key={i} variant="outline">
                    {formatSec(s.startSec)} → {formatSec(s.endSec)} ({Math.round(s.durationSec)}s)
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Cronología */}
      {segments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Cronología de intervenciones
            </CardTitle>
            <CardDescription>
              Transcripción ordenada por tiempo, con el minuto exacto de cada intervención y tus
              notas de escena asociadas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {annotations.length > 0 && (
              <div className="mb-3 rounded-lg border border-border bg-muted/30 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <NotebookPen className="h-3.5 w-3.5" /> Anotaciones de escenas (
                  {annotations.length})
                </p>
                <ul className="mt-2 space-y-2">
                  {annotations.map((a) => (
                    <li key={a.id} className="text-sm">
                      <span className="font-medium">
                        {formatSec(a.startSec)} – {formatSec(a.endSec)}
                      </span>{" "}
                      {a.sceneTitle && <span className="text-muted-foreground">· {a.sceneTitle}</span>}
                      {a.tags.length > 0 && (
                        <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                          {a.tags.map((t) => (
                            <Badge key={t} variant="secondary">
                              {t}
                            </Badge>
                          ))}
                        </span>
                      )}
                      {a.note && <p className="whitespace-pre-wrap">{a.note}</p>}
                    </li>
                  ))}
                </ul>
                <Button asChild variant="ghost" size="sm" className="mt-2 gap-2">
                  <Link to="/app/capture/$id/scenes" params={{ id }}>
                    <Film className="h-4 w-4" /> Editar en Escenas
                  </Link>
                </Button>
              </div>
            )}
            <ol className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {segments.map((s) => {
                const key = s.participantId ?? s.speakerLabel ?? "desconocido";
                const notes = annotations.filter(
                  (a) => a.endSec >= s.startSec && a.startSec <= s.endSec,
                );
                return (
                  <li key={s.id} className="rounded-lg border border-border p-2.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: colorOf(key) }}
                        aria-hidden="true"
                      />
                      <span className="font-medium text-foreground">{nameOf(key)}</span>
                      <span>
                        {formatSec(s.startSec)} – {formatSec(s.endSec)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm">{s.text}</p>
                    {notes.map((a) => (
                      <div
                        key={a.id}
                        className="mt-2 rounded-md border-l-2 border-primary bg-primary/5 p-2"
                      >
                        <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <NotebookPen className="h-3 w-3" aria-hidden="true" /> Nota de escena
                          {a.tags.map((t) => (
                            <Badge key={t} variant="secondary">
                              {t}
                            </Badge>
                          ))}
                        </p>
                        {a.note && <p className="mt-1 whitespace-pre-wrap text-sm">{a.note}</p>}
                      </div>
                    ))}
                  </li>
                );
              })}
            </ol>

          </CardContent>
        </Card>
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
