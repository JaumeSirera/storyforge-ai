import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  generateSessionScenes,
  getSessionScenes,
  deleteSessionScenes,
  type SessionScene,
} from "@/lib/scenes.functions";
import { getSessionAnalysis } from "@/lib/analyze.functions";
import { listSceneAnnotations } from "@/lib/scene-annotations.functions";
import { SceneAnnotationEditor } from "@/components/SceneAnnotationEditor";
import { getCaptureSession, getRecordingUrl } from "@/lib/capture.functions";
import { formatSec } from "@/lib/analyze-metrics";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Film,
  Info,
  Loader2,
  Play,
  Sparkles,
  Trash2,
  MessageSquare,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/capture/$id/scenes")({
  head: () => ({
    meta: [
      { title: "Escenas inteligentes — película resumen | Playnalyze" },
      {
        name: "description",
        content:
          "La IA detecta los momentos más significativos de la sesión y crea una película resumen: reproduce cada fragmento con su transcripción y observaciones objetivas.",
      },
      { property: "og:title", content: "Escenas inteligentes — película resumen | Playnalyze" },
      {
        property: "og:description",
        content:
          "Revisa en minutos los momentos clave de una sesión grabada, siempre sobre comportamientos observables.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScenesPage,
});

const KIND_LABELS: Record<SessionScene["kind"], string> = {
  decision: "Decisión",
  desacuerdo: "Desacuerdo",
  colaboracion: "Colaboración",
  liderazgo: "Conducción del grupo",
  interrupciones: "Solapamientos",
  silencio: "Silencio",
  cambio_de_tema: "Cambio de tema",
  aportacion_clave: "Aportación clave",
};

function ScenesPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getSession = useServerFn(getCaptureSession);
  const getAnalysis = useServerFn(getSessionAnalysis);
  const getScenes = useServerFn(getSessionScenes);
  const generate = useServerFn(generateSessionScenes);
  const wipe = useServerFn(deleteSessionScenes);
  const recUrl = useServerFn(getRecordingUrl);
  const listAnnotations = useServerFn(listSceneAnnotations);


  const sessionQ = useQuery({
    queryKey: ["capture-session", id],
    queryFn: () => getSession({ data: { id } }),
  });
  const analysisQ = useQuery({
    queryKey: ["capture-analysis", id],
    queryFn: () => getAnalysis({ data: { captureSessionId: id } }),
  });
  const scenesQ = useQuery({
    queryKey: ["capture-scenes", id],
    queryFn: () => getScenes({ data: { captureSessionId: id } }),
  });
  const annotationsQ = useQuery({
    queryKey: ["scene-annotations", id],
    queryFn: () => listAnnotations({ data: { captureSessionId: id } }),
  });



  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [trackUrl, setTrackUrl] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopAtRef = useRef<number | null>(null);

  const participants = sessionQ.data?.participants ?? [];
  const recordings = useMemo(
    () => (sessionQ.data?.recordings ?? []).filter((r) => r.status !== "failed"),
    [sessionQ.data],
  );
  const segments = analysisQ.data?.segments ?? [];
  const scenes = scenesQ.data?.scenes ?? [];
  const generatedAt = scenesQ.data?.generatedAt ?? null;
  const annotationByIndex = useMemo(() => {
    const map = new Map<number, SceneAnnotation>();
    for (const a of annotationsQ.data?.annotations ?? []) map.set(a.sceneIndex, a);
    return map;
  }, [annotationsQ.data]);



  const nameOf = (key: string | null) => {
    if (!key) return "Hablante sin identificar";
    const p = participants.find((x) => x.id === key);
    if (p) return p.name;
    return key.startsWith("speaker") ? `Hablante ${key.replace(/\D+/g, "") || "?"}` : key;
  };
  const colorOf = (key: string | null) =>
    (key ? participants.find((x) => x.id === key)?.color : null) ?? "#64748b";

  // Selecciona la primera pista disponible y firma su URL.
  useEffect(() => {
    if (!trackId && recordings.length > 0) setTrackId(recordings[0].id);
  }, [recordings, trackId]);

  useEffect(() => {
    if (!trackId) return;
    let cancelled = false;
    setTrackUrl(null);
    recUrl({ data: { id: trackId } })
      .then(({ url }) => {
        if (!cancelled) setTrackUrl(url);
      })
      .catch((e: any) => toast.error(e?.message || "No se pudo abrir la grabación"));
    return () => {
      cancelled = true;
    };
  }, [trackId, recUrl]);

  const track = recordings.find((r) => r.id === trackId) ?? null;
  const offsetSec = track ? (track.syncOffsetMs ?? 0) / 1000 : 0;

  function playScene(index: number) {
    const scene = scenes[index];
    if (!scene) return;
    setActiveIndex(index);
    const v = videoRef.current;
    if (!v || !trackUrl) {
      toast.error("Selecciona una pista de grabación para reproducir el fragmento");
      return;
    }
    stopAtRef.current = scene.endSec + offsetSec;
    v.currentTime = Math.max(0, scene.startSec + offsetSec);
    void v.play().catch(() => undefined);
    v.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function onTimeUpdate() {
    const v = videoRef.current;
    const stopAt = stopAtRef.current;
    if (v && stopAt !== null && v.currentTime >= stopAt) {
      v.pause();
      stopAtRef.current = null;
    }
  }

  async function runGenerate() {
    setBusy(true);
    try {
      await generate({ data: { captureSessionId: id, focus: focus.trim() || undefined } });
      await qc.invalidateQueries({ queryKey: ["capture-scenes", id] });
      toast.success("Película resumen generada");
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron detectar las escenas");
    } finally {
      setBusy(false);
    }
  }

  if (sessionQ.isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (!sessionQ.data?.session) return <p>Sesión no encontrada.</p>;
  const session = sessionQ.data.session;

  const activeScene = activeIndex !== null ? scenes[activeIndex] : null;
  const sceneSegments = activeScene
    ? segments.filter((s) => s.endSec >= activeScene.startSec && s.startSec <= activeScene.endSec)
    : [];

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        to="/app/capture/$id/analyze"
        params={{ id }}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver a Analyze
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Escenas inteligentes · {session.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            La IA detecta los momentos más significativos y construye una película resumen. Pulsa una
            escena para reproducir su fragmento con las intervenciones y observaciones asociadas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/app/capture/$id/insights" params={{ id }}>
              <Sparkles className="h-4 w-4" /> Insights
            </Link>
          </Button>
          {scenes.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-destructive"
              disabled={busy}
              onClick={async () => {
                if (!confirm("¿Borrar las escenas detectadas?")) return;
                await wipe({ data: { captureSessionId: id } });
                setActiveIndex(null);
                qc.invalidateQueries({ queryKey: ["capture-scenes", id] });
              }}
            >
              <Trash2 className="h-4 w-4" /> Borrar escenas
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Las escenas describen <strong>comportamientos observables</strong> con su minuto exacto. No
          se emiten diagnósticos ni conclusiones sobre el estado psicológico o la personalidad: la
          interpretación corresponde siempre al profesional.
        </p>
      </div>

      {/* Requisitos previos */}
      {segments.length === 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base">Aún no se puede generar la película resumen</CardTitle>
            <CardDescription>
              La IA necesita una grabación transcrita. Completa estos pasos:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ol className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="font-semibold">1.</span>
                <span>
                  {recordings.length === 0 ? (
                    <>
                      <strong>Graba la sesión</strong> — todavía no hay ninguna grabación subida.
                    </>
                  ) : (
                    <>
                      Grabación lista ({recordings.length}
                      {recordings.length === 1 ? " pista" : " pistas"}).
                    </>
                  )}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold">2.</span>
                <span>
                  <strong>Transcribe</strong> la grabación en Analyze (aún no hay intervenciones).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold">3.</span>
                <span>Vuelve aquí y pulsa «Detectar escenas».</span>
              </li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline" className="gap-2">
                <Link to="/app/capture/$id" params={{ id }}>
                  Ir a grabar
                </Link>
              </Button>
              <Button asChild size="sm" className="gap-2" disabled={recordings.length === 0}>
                <Link to="/app/capture/$id/analyze" params={{ id }}>
                  Ir a Analyze
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Generador */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Film className="h-4 w-4" /> Motor de escenas
          </CardTitle>
          <CardDescription>
            {segments.length === 0
              ? "Primero transcribe la sesión en Analyze."
              : `${segments.length} intervenciones disponibles para detectar momentos clave.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="scene-focus">Foco de la película resumen (opcional)</Label>
            <Input
              id="scene-focus"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              maxLength={500}
              placeholder="Ej.: toma de decisiones bajo presión, gestión del desacuerdo…"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button className="gap-2" disabled={busy || segments.length === 0} onClick={runGenerate}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {scenes.length > 0 ? "Regenerar escenas" : "Detectar escenas"}
            </Button>
            {generatedAt && (
              <span className="text-xs text-muted-foreground">
                Generadas el {new Date(generatedAt).toLocaleString("es-ES")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reproductor */}
      {recordings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reproductor de fragmentos</CardTitle>
            <CardDescription>
              Elige la pista de grabación sobre la que quieres revisar las escenas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={trackId ?? undefined} onValueChange={setTrackId}>
              <SelectTrigger className="max-w-sm">
                <SelectValue placeholder="Selecciona una pista…" />
              </SelectTrigger>
              <SelectContent>
                {recordings.map((r) => {
                  const p = participants.find((x) => x.id === r.participantId);
                  return (
                    <SelectItem key={r.id} value={r.id}>
                      {r.kind === "screen" ? "Pantalla" : r.kind === "audio" ? "Audio" : "Cámara"}
                      {p ? ` · ${p.name}` : ""}
                      {r.durationSec ? ` · ${Math.round(r.durationSec)} s` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {trackUrl ? (
              <video
                ref={videoRef}
                src={trackUrl}
                controls
                onTimeUpdate={onTimeUpdate}
                className="w-full rounded-md bg-black"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Preparando la grabación…</p>
            )}
            {activeScene && (
              <p className="text-xs text-muted-foreground">
                Reproduciendo <strong>{activeScene.title}</strong> ·{" "}
                {formatSec(activeScene.startSec)} → {formatSec(activeScene.endSec)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Escenas */}
      {scenes.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Aún no hay escenas detectadas para esta sesión.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {scenes.map((s, i) => (
            <Card
              key={`${s.startSec}-${i}`}
              className={activeIndex === i ? "border-primary shadow-sm" : undefined}
            >
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base">
                      {i + 1}. {s.title}
                    </CardTitle>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{KIND_LABELS[s.kind] ?? s.kind}</Badge>
                      <Badge variant="outline">
                        {formatSec(s.startSec)} → {formatSec(s.endSec)}
                      </Badge>
                      <Badge variant="outline">Relevancia {s.relevance}/5</Badge>
                      {s.speakers.slice(0, 4).map((n) => (
                        <Badge key={n} variant="outline">
                          {n}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" className="gap-2" onClick={() => playScene(i)}>
                    <Play className="h-4 w-4" /> Reproducir
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{s.why}</p>
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" /> Observaciones objetivas
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {s.observations.map((o, k) => (
                      <li key={k}>{o}</li>
                    ))}
                  </ul>
                </div>
                {activeIndex === i && sceneSegments.length > 0 && (
                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" /> Intervenciones del fragmento
                    </p>
                    <ol className="max-h-72 space-y-2 overflow-y-auto pr-1">
                      {sceneSegments.map((seg) => {
                        const key = seg.participantId ?? seg.speakerLabel;
                        return (
                          <li key={seg.id} className="rounded-lg border border-border p-2.5">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: colorOf(key) }}
                                aria-hidden="true"
                              />
                              <span className="font-medium text-foreground">{nameOf(key)}</span>
                              <span>
                                {formatSec(seg.startSec)} – {formatSec(seg.endSec)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm">{seg.text}</p>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
