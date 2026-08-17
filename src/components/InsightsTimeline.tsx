import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Film, ListChecks, Play, Quote, Volume2 } from "lucide-react";
import { getRecordingUrl, type CaptureRecording } from "@/lib/capture.functions";
import { formatSec, type SessionMetrics, type TranscriptSegment } from "@/lib/analyze-metrics";
import type { SessionScene } from "@/lib/scenes.helpers";
import type { SceneAnnotation } from "@/lib/scene-annotations.functions";
import type { SessionInsights } from "@/lib/insights-shared";

interface Props {
  segments: TranscriptSegment[];
  metrics: SessionMetrics | null;
  scenes: SessionScene[];
  annotations: SceneAnnotation[];
  insights: SessionInsights | null;
  recordings: CaptureRecording[];
  speakerName: (key: string) => string;
}

interface Claim {
  id: string;
  kind: "observation" | "hypothesis";
  text: string;
  detail: string;
  badge?: string;
  startSec: number | null;
  endSec: number | null;
}

/** Convierte "12:05" o "1:03–1:20" en segundos. */
function parseTimes(text: string): { startSec: number | null; endSec: number | null } {
  const matches = [...text.matchAll(/(\d{1,3}):([0-5]\d)/g)].map(
    (m) => Number(m[1]) * 60 + Number(m[2]),
  );
  if (matches.length === 0) return { startSec: null, endSec: null };
  return { startSec: matches[0]!, endSec: matches.length > 1 ? matches[1]! : null };
}

/** Línea de tiempo sincronizada: transcripción, clips y métricas por cada afirmación del informe. */
export function InsightsTimeline({
  segments,
  metrics,
  scenes,
  annotations,
  insights,
  recordings,
  speakerName,
}: Props) {
  const getUrl = useServerFn(getRecordingUrl);
  const playable = useMemo(() => recordings.filter((r) => r.status !== "failed"), [recordings]);
  const [recordingId, setRecordingId] = useState<string | null>(playable[0]?.id ?? null);
  const [cursor, setCursor] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!recordingId && playable[0]) setRecordingId(playable[0].id);
  }, [playable, recordingId]);

  const urlQ = useQuery({
    queryKey: ["recording-url", recordingId],
    queryFn: () => getUrl({ data: { id: recordingId! } }),
    enabled: !!recordingId,
    staleTime: 30 * 60 * 1000,
  });

  const duration = useMemo(() => {
    const fromSegments = segments.reduce((a, s) => Math.max(a, s.endSec), 0);
    const fromRecordings = playable.reduce((a, r) => Math.max(a, r.durationSec ?? 0), 0);
    return Math.max(1, fromSegments, fromRecordings, metrics?.spanSec ?? 0);
  }, [segments, playable, metrics]);

  const claims = useMemo<Claim[]>(() => {
    if (!insights) return [];
    const obs = (insights.observations ?? []).map((o, i) => ({
      id: `o${i}`,
      kind: "observation" as const,
      text: o.fact,
      detail: o.evidence,
      ...parseTimes(o.evidence + " " + o.fact),
    }));
    const hyp = (insights.hypotheses ?? []).map((h, i) => ({
      id: `h${i}`,
      kind: "hypothesis" as const,
      text: h.hypothesis,
      detail: h.basis,
      badge: `confianza ${h.confidence}`,
      ...parseTimes(h.basis + " " + h.hypothesis),
    }));
    return [...obs, ...hyp];
  }, [insights]);

  const [activeClaim, setActiveClaim] = useState<string | null>(null);

  function seek(sec: number, claimId?: string) {
    setCursor(sec);
    if (claimId) setActiveClaim(claimId);
    const v = videoRef.current;
    if (v && Number.isFinite(v.duration)) {
      try {
        v.currentTime = Math.max(0, Math.min(sec, v.duration - 0.2));
      } catch {
        /* seek no disponible todavía */
      }
    }
    const el = listRef.current?.querySelector<HTMLElement>(`[data-seg-start]:not([hidden])`);
    if (el) {
      const target = listRef.current?.querySelector<HTMLElement>(
        `[data-seg-start="${nearestSegmentStart(segments, sec)}"]`,
      );
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  const activeSegment = useMemo(
    () => segments.find((s) => cursor >= s.startSec && cursor <= s.endSec) ?? null,
    [segments, cursor],
  );
  const activeScene = useMemo(
    () => scenes.find((s) => cursor >= s.startSec && cursor <= s.endSec) ?? null,
    [scenes, cursor],
  );
  const activeSilence = useMemo(
    () => (metrics?.silences ?? []).find((s) => cursor >= s.startSec && cursor <= s.endSec) ?? null,
    [metrics, cursor],
  );
  const noteFor = (sceneIndex: number) => annotations.find((a) => a.sceneIndex === sceneIndex) ?? null;

  if (segments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Línea de tiempo sincronizada
          </CardTitle>
          <CardDescription>
            Transcribe la sesión en Analizar para navegar la transcripción, los clips y las métricas
            desde cada afirmación del informe.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" /> Línea de tiempo sincronizada
        </CardTitle>
        <CardDescription>
          Pulsa una afirmación, escena o turno para situar la grabación, la transcripción y las
          métricas en ese instante.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Rail temporal */}
        <div className="space-y-2">
          <div
            className="relative h-14 w-full cursor-pointer rounded-lg border border-border bg-muted/40"
            role="slider"
            tabIndex={0}
            aria-label="Línea de tiempo de la sesión"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(cursor)}
            aria-valuetext={formatSec(cursor)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") seek(Math.min(duration, cursor + 5));
              if (e.key === "ArrowLeft") seek(Math.max(0, cursor - 5));
            }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              seek(((e.clientX - rect.left) / rect.width) * duration);
            }}
          >
            {(metrics?.silences ?? []).map((s, i) => (
              <div
                key={`sil${i}`}
                className="absolute top-1 h-3 rounded bg-muted-foreground/30"
                style={{
                  left: `${(s.startSec / duration) * 100}%`,
                  width: `${Math.max(0.4, (s.durationSec / duration) * 100)}%`,
                }}
                title={`Silencio ${formatSec(s.durationSec)}`}
              />
            ))}
            {segments.map((s) => (
              <div
                key={s.id}
                className="absolute top-5 h-4 rounded-sm bg-primary/45"
                style={{
                  left: `${(s.startSec / duration) * 100}%`,
                  width: `${Math.max(0.25, ((s.endSec - s.startSec) / duration) * 100)}%`,
                }}
                title={`${speakerName(s.participantId ?? s.speakerLabel ?? "")} · ${formatSec(s.startSec)}`}
              />
            ))}
            {scenes.map((s, i) => (
              <button
                key={`sc${i}`}
                type="button"
                className="absolute bottom-1 h-3 rounded bg-accent-foreground/60 hover:bg-accent-foreground"
                style={{
                  left: `${(s.startSec / duration) * 100}%`,
                  width: `${Math.max(0.5, ((s.endSec - s.startSec) / duration) * 100)}%`,
                }}
                title={`${s.title} · ${formatSec(s.startSec)}`}
                aria-label={`Escena ${s.title} en ${formatSec(s.startSec)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  seek(s.startSec);
                }}
              />
            ))}
            <div
              className="pointer-events-none absolute inset-y-0 w-0.5 bg-destructive"
              style={{ left: `${(Math.min(cursor, duration) / duration) * 100}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="tabular-nums">
              Posición: <strong>{formatSec(cursor)}</strong> / {formatSec(duration)}
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block h-2 w-4 rounded bg-primary/45" /> turnos
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block h-2 w-4 rounded bg-accent-foreground/60" /> escenas
            </span>
            <span className="flex items-center gap-1">
              <i className="inline-block h-2 w-4 rounded bg-muted-foreground/30" /> silencios
            </span>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Clip */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Film className="h-4 w-4" /> Clip sincronizado
              </p>
              {playable.length > 1 && (
                <Select value={recordingId ?? undefined} onValueChange={setRecordingId}>
                  <SelectTrigger className="h-8 w-[190px] text-xs">
                    <SelectValue placeholder="Elegir pista" />
                  </SelectTrigger>
                  <SelectContent>
                    {playable.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.kind === "camera" ? "Cámara" : r.kind === "screen" ? "Pantalla" : "Audio"}
                        {r.participantId ? ` · ${speakerName(r.participantId)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {playable.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No hay grabaciones disponibles para esta sesión.
              </p>
            ) : (
              <video
                ref={videoRef}
                key={urlQ.data?.url ?? "none"}
                src={urlQ.data?.url}
                controls
                playsInline
                className="w-full rounded-lg border border-border bg-black"
                onTimeUpdate={(e) => setCursor(e.currentTarget.currentTime)}
              />
            )}
            <div className="rounded-lg border border-border p-3 text-xs">
              <p className="font-medium">Contexto en {formatSec(cursor)}</p>
              <ul className="mt-1 space-y-1 text-muted-foreground">
                <li>
                  Turno:{" "}
                  {activeSegment
                    ? `${speakerName(activeSegment.participantId ?? activeSegment.speakerLabel ?? "")} — “${activeSegment.text.slice(0, 90)}”`
                    : "sin habla registrada"}
                </li>
                <li>Escena: {activeScene ? activeScene.title : "fuera de escena destacada"}</li>
                <li>
                  Silencio:{" "}
                  {activeSilence ? `sí (${formatSec(activeSilence.durationSec)})` : "no"}
                </li>
                {activeScene && noteFor(scenes.indexOf(activeScene)) && (
                  <li>Nota: {noteFor(scenes.indexOf(activeScene))!.note}</li>
                )}
              </ul>
            </div>
          </div>

          {/* Transcripción */}
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Volume2 className="h-4 w-4" /> Transcripción
            </p>
            <div
              ref={listRef}
              className="max-h-[340px] space-y-1 overflow-y-auto rounded-lg border border-border p-2"
            >
              {segments.map((s) => {
                const active = activeSegment?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    data-seg-start={s.startSec}
                    onClick={() => seek(s.startSec)}
                    className={`w-full rounded-md p-2 text-left text-xs transition ${
                      active ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted"
                    }`}
                  >
                    <span className="mr-2 font-mono text-[11px] text-muted-foreground">
                      {formatSec(s.startSec)}
                    </span>
                    <strong>{speakerName(s.participantId ?? s.speakerLabel ?? "")}:</strong> {s.text}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Afirmaciones del informe */}
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-medium">
            <ListChecks className="h-4 w-4" /> Afirmaciones del informe
          </p>
          {claims.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Genera el informe para vincular cada hecho e hipótesis con su momento en la grabación.
            </p>
          ) : (
            <ul className="space-y-2">
              {claims.map((c) => (
                <li
                  key={c.id}
                  className={`rounded-lg border p-3 text-sm ${
                    activeClaim === c.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium">
                      <Quote className="mr-1 inline h-3 w-3 text-muted-foreground" />
                      {c.text}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.kind === "observation" ? "secondary" : "outline"}>
                        {c.kind === "observation" ? "hecho" : "hipótesis"}
                      </Badge>
                      {c.badge && <Badge variant="outline">{c.badge}</Badge>}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {c.startSec !== null ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        onClick={() => seek(c.startSec!, c.id)}
                      >
                        <Play className="h-3 w-3" /> Ir a {formatSec(c.startSec)}
                        {c.endSec !== null ? `–${formatSec(c.endSec)}` : ""}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Sin marca temporal en la evidencia
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function nearestSegmentStart(segments: TranscriptSegment[], sec: number): number {
  let best = segments[0]?.startSec ?? 0;
  let diff = Infinity;
  for (const s of segments) {
    const d = Math.abs(s.startSec - sec);
    if (d < diff) {
      diff = d;
      best = s.startSec;
    }
  }
  return best;
}
