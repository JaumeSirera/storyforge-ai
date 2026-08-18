import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { reocrSubmission } from "@/lib/assessments.functions";
import {
  CONFIDENCE_LABELS,
  CONFIDENCE_THRESHOLD_LOW,
  confidenceLevel,
  type SubmissionRecord,
} from "@/lib/assessments-shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Loader2, ScanLine, ScanSearch } from "lucide-react";
import { toast } from "sonner";

const LEVEL_CLASS: Record<"high" | "medium" | "low", string> = {
  high: "border-primary/40 bg-primary/10 text-primary",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "border-destructive/40 bg-destructive/10 text-destructive",
};

const BAR_CLASS: Record<"high" | "medium" | "low", string> = {
  high: "bg-primary",
  medium: "bg-amber-500",
  low: "bg-destructive",
};

interface Props {
  submission: SubmissionRecord;
  hasPages: boolean;
  canReocr: boolean;
}

/**
 * Muestra la transcripción segmentada con el nivel de confianza de lectura de cada
 * segmento y permite pedir una relectura (re-OCR) cuando el escaneo es de baja calidad.
 */
export function TranscriptionConfidenceCard({ submission, hasPages, canReocr }: Props) {
  const qc = useQueryClient();
  const runReocr = useServerFn(reocrSubmission);
  const [onlyLow, setOnlyLow] = useState(false);
  const [replaceText, setReplaceText] = useState(true);
  const [hint, setHint] = useState("");

  const segments = submission.transcriptionSegments ?? [];
  const quality = submission.scanQuality;

  const stats = useMemo(() => {
    if (segments.length === 0) return { avg: 0, low: 0 };
    const avg = Math.round(segments.reduce((a, s) => a + s.confidence, 0) / segments.length);
    return { avg, low: segments.filter((s) => s.confidence < CONFIDENCE_THRESHOLD_LOW).length };
  }, [segments]);

  const qualityScore = quality?.score ?? stats.avg;
  const lowQuality = segments.length > 0 && (qualityScore < 70 || stats.low > 0);
  const visible = onlyLow
    ? segments.filter((s) => s.confidence < CONFIDENCE_THRESHOLD_LOW)
    : segments;

  const reocr = useMutation({
    mutationFn: () =>
      runReocr({
        data: { id: submission.id, replaceText, hint: hint.trim() || undefined },
      }),
    onSuccess: () => {
      toast.success("Relectura completada");
      void qc.invalidateQueries({ queryKey: ["assessment-submission", submission.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo releer el escaneo"),
  });

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScanLine className="size-4" aria-hidden="true" />
              Transcripción y confianza de lectura
            </CardTitle>
            <CardDescription>
              {segments.length > 0
                ? `${segments.length} segmento(s) · confianza media ${stats.avg}% · ${stats.low} con confianza baja`
                : "Todavía no hay transcripción segmentada. Pide una relectura para obtener la confianza por segmento."}
              {submission.ocrUpdatedAt
                ? ` · última relectura ${new Date(submission.ocrUpdatedAt).toLocaleString("es-ES")}`
                : ""}
            </CardDescription>
          </div>
          {segments.length > 0 && (
            <Badge variant="outline" className={LEVEL_CLASS[confidenceLevel(qualityScore)]}>
              Calidad del escaneo {qualityScore}%
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {lowQuality && (
          <div
            className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
            role="status"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
            <p className="text-muted-foreground">
              La calidad del escaneo es baja
              {stats.low > 0 ? ` en ${stats.low} segmento(s)` : ""}.
              {quality?.notes ? ` ${quality.notes}` : ""} Puedes solicitar una relectura (re-OCR)
              con indicaciones para mejorar la transcripción.
            </p>
          </div>
        )}

        {segments.length > 0 && (
          <div className="flex items-center gap-2">
            <Switch
              id={`only-low-${submission.id}`}
              checked={onlyLow}
              onCheckedChange={setOnlyLow}
              aria-label="Mostrar solo segmentos con confianza baja"
            />
            <Label htmlFor={`only-low-${submission.id}`} className="text-xs text-muted-foreground">
              Ver solo segmentos con confianza baja
            </Label>
          </div>
        )}

        {visible.length > 0 ? (
          <ul className="space-y-2">
            {visible.map((s) => {
              const level = confidenceLevel(s.confidence);
              return (
                <li key={`${s.index}-${s.pageIndex}`} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Página {s.pageIndex + 1} · segmento {s.index}
                    </span>
                    <Badge variant="outline" className={LEVEL_CLASS[level]}>
                      {CONFIDENCE_LABELS[level]} · {s.confidence}%
                    </Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">{s.text}</p>
                  <div
                    className="mt-2 h-1.5 rounded-full bg-muted"
                    role="meter"
                    aria-valuenow={s.confidence}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Confianza del segmento ${s.index}`}
                  >
                    <div
                      className={`h-1.5 rounded-full ${BAR_CLASS[level]}`}
                      style={{ width: `${Math.max(2, Math.min(100, s.confidence))}%` }}
                    />
                  </div>
                  {s.issues.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Dudas: {s.issues.join(" · ")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : segments.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay segmentos con confianza baja en esta entrega.
          </p>
        ) : submission.extractedText ? (
          <pre className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {submission.extractedText}
          </pre>
        ) : null}

        {hasPages && canReocr && (
          <div className="space-y-3 rounded-lg border border-dashed p-3">
            <div className="space-y-1">
              <Label htmlFor={`hint-${submission.id}`} className="text-xs">
                Indicaciones para la relectura (opcional)
              </Label>
              <Input
                id={`hint-${submission.id}`}
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                maxLength={500}
                placeholder="Ej.: la página 2 está girada; el candidato escribe en cursiva"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id={`replace-${submission.id}`}
                checked={replaceText}
                onCheckedChange={setReplaceText}
              />
              <Label
                htmlFor={`replace-${submission.id}`}
                className="text-xs text-muted-foreground"
              >
                Sustituir la transcripción guardada por la nueva lectura
              </Label>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => reocr.mutate()}
              disabled={reocr.isPending}
            >
              {reocr.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ScanSearch className="size-4" aria-hidden="true" />
              )}
              Solicitar re-OCR
            </Button>
            <p className="text-xs text-muted-foreground">
              Tras la relectura, vuelve a corregir la entrega para actualizar la nota con el texto
              revisado.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
