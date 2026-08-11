import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getIntegratedReport } from "@/lib/integrated-report.functions";
import { downloadIntegratedPdf } from "@/lib/integrated-pdf";
import { loadLogoDataUrl } from "@/lib/email-report";
import { formatSec } from "@/lib/analyze-metrics";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, Eye, FileText, Loader2, Star } from "lucide-react";
import { toast } from "sonner";

interface Props {
  sessionId?: string;
  captureSessionId?: string;
  logoUrl?: string | null;
  variant?: "default" | "outline" | "secondary";
  className?: string;
  /** Muestra un aviso cuando no hay datos suficientes en lugar de ocultar el botón. */
  showWhenUnavailable?: boolean;
}

const OUTCOME_LABEL: Record<string, string> = {
  apto: "Apto",
  apto_con_reservas: "Apto con reservas",
  no_apto: "No apto",
};

function dateStr(v?: string | null) {
  return v ? new Date(v).toLocaleString("es-ES") : "—";
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold tracking-tight text-foreground">{children}</h3>
  );
}

/**
 * Abre una vista previa web del informe integrado (decisiones de la simulación
 * + análisis de la grabación) y permite descargarlo en PDF.
 */
export function IntegratedReportButton({
  sessionId,
  captureSessionId,
  logoUrl,
  variant = "secondary",
  className,
  showWhenUnavailable = false,
}: Props) {
  const fetchReport = useServerFn(getIntegratedReport);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["integrated-report", sessionId ?? null, captureSessionId ?? null],
    queryFn: () =>
      fetchReport({
        data: {
          ...(sessionId ? { sessionId } : {}),
          ...(captureSessionId ? { captureSessionId } : {}),
        },
      }),
    enabled: Boolean(sessionId || captureSessionId),
    staleTime: 60_000,
  });

  const r = q.data;

  if (!r) {
    if (!showWhenUnavailable || q.isLoading) return null;
    return (
      <p className="text-xs text-muted-foreground">
        El informe integrado estará disponible cuando la grabación y la simulación de este candidato
        estén vinculadas.
      </p>
    );
  }

  async function onDownload() {
    if (!r) return;
    setBusy(true);
    try {
      const logo = await loadLogoDataUrl(logoUrl || null);
      downloadIntegratedPdf({ report: r, branding: { logoDataUrl: logo } });
    } catch (e: any) {
      toast.error(e.message || "No se pudo generar el informe integrado");
    } finally {
      setBusy(false);
    }
  }

  const rep = (r.gameSession.report ?? {}) as any;
  const stars = Math.max(0, Math.min(5, r.gameSession.stars ?? 0));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className={`gap-2 ${className ?? ""}`}>
          <FileText className="h-4 w-4" /> Informe integrado
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4" /> Vista previa del informe integrado
          </DialogTitle>
          <DialogDescription>
            Revisa el contenido antes de descargar el PDF: decisiones de la simulación y
            comportamiento observable de la grabación, alineados por marca de tiempo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          {/* Cabecera */}
          <div className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold">{r.simulation.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {r.candidate.name || "(sin nombre)"} · {r.candidate.email || "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Simulación: {dateStr(r.gameSession.startedAt)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Grabación: {r.capture ? r.capture.title : "no disponible"}
                  {r.capture && (
                    <>
                      {" · "}
                      {r.capture.linkedExplicitly ? "vínculo confirmado" : "vínculo inferido por horario"}
                    </>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold leading-none">{r.gameSession.score ?? 0}</p>
                <p className="text-[11px] text-muted-foreground">PUNTOS</p>
                <div className="mt-1 flex justify-end gap-0.5" aria-label={`${stars} de 5 estrellas`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3.5 w-3.5 ${i < stars ? "fill-primary text-primary" : "text-muted-foreground"}`}
                    />
                  ))}
                </div>
                {rep.outcome && (
                  <Badge variant="secondary" className="mt-2">
                    {OUTCOME_LABEL[rep.outcome] ?? String(rep.outcome)}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* 1. Resumen ejecutivo */}
          <section className="space-y-2">
            <SectionTitle>1. Resumen ejecutivo</SectionTitle>
            <p className="text-muted-foreground">{rep.summary || "Sin resumen de la simulación."}</p>
            {r.insights?.headline && (
              <p className="text-muted-foreground">
                <span className="text-foreground font-medium">Dinámica observada: </span>
                {r.insights.headline}
              </p>
            )}
            {r.insights?.summary && <p className="text-muted-foreground">{r.insights.summary}</p>}
            {r.metrics && (
              <p className="text-xs text-muted-foreground">
                {formatSec(r.metrics.totalSpeechSec)} de habla sobre {formatSec(r.metrics.spanSec)} ·{" "}
                {r.metrics.totalTurns} turnos · {r.metrics.totalInterruptions} interrupciones · reparto{" "}
                {Math.round((r.metrics.participationBalance ?? 0) * 100)}%
              </p>
            )}
            {!!r.insights?.observations?.length && (
              <ul className="space-y-2 pt-1">
                {r.insights.observations.slice(0, 3).map((o, i) => (
                  <li key={i} className="rounded-md border border-border p-2.5">
                    <p>{o.fact}</p>
                    <p className="text-xs text-muted-foreground mt-1">Evidencia: {o.evidence}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Separator />

          {/* 2. Perfil competencial */}
          <section className="space-y-3">
            <SectionTitle>2. Perfil competencial combinado</SectionTitle>
            {!r.competencies.length ? (
              <p className="text-muted-foreground">
                La simulación no registró puntuaciones por competencia.
              </p>
            ) : (
              r.competencies.map((c) => {
                const pct = Math.max(0, Math.min(100, 50 + Number(c.decisionScore ?? 0)));
                return (
                  <div key={c.key} className="space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate">{c.label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {c.decisionScore >= 0 ? "+" : ""}
                        {c.decisionScore}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                    {c.evidence && (
                      <p className="text-xs text-muted-foreground">Evidencia observable: {c.evidence}</p>
                    )}
                  </div>
                );
              })
            )}
          </section>

          <Separator />

          {/* 3. Línea temporal cruzada */}
          <section className="space-y-3">
            <SectionTitle>3. Línea temporal cruzada (decisión ↔ grabación)</SectionTitle>
            {!r.timeline.length ? (
              <p className="text-muted-foreground">No se registraron decisiones en esta sesión.</p>
            ) : (
              <ol className="space-y-3">
                {r.timeline.map((t) => (
                  <li key={t.index} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {t.index}. {t.nodeTitle}
                      </span>
                      {t.offsetSec != null && (
                        <Badge variant="outline" className="tabular-nums">
                          {formatSec(t.offsetSec)}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 font-medium">{t.question || "—"}</p>
                    <p className="mt-1">
                      → {t.choiceLabel || "—"}{" "}
                      <span className="text-muted-foreground">
                        ({t.points >= 0 ? "+" : ""}
                        {t.points} pts)
                      </span>
                    </p>
                    {t.feedback && (
                      <p className="mt-1 text-xs italic text-muted-foreground">{t.feedback}</p>
                    )}
                    {!!t.quotes.length && (
                      <div className="mt-2 space-y-1 border-l-2 border-border pl-3">
                        <p className="text-xs text-muted-foreground">Qué ocurría en la grabación:</p>
                        {t.quotes.map((qt, i) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            <span className="tabular-nums">[{formatSec(qt.startSec)}]</span>{" "}
                            <span className="text-foreground">{qt.speaker}:</span> {qt.text}
                          </p>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <Separator />

          {/* 4. Conclusiones */}
          <section className="space-y-3">
            <SectionTitle>4. Conclusiones y recomendaciones</SectionTitle>
            {!!rep.strengths?.length && (
              <div>
                <p className="font-medium">Fortalezas</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {(rep.strengths as string[]).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {!!rep.improvements?.length && (
              <div>
                <p className="font-medium">Áreas de mejora</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {(rep.improvements as string[]).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {!!r.insights?.hypotheses?.length && (
              <div>
                <p className="font-medium">Hipótesis de trabajo (no diagnósticas)</p>
                <ul className="space-y-1 pl-0">
                  {r.insights.hypotheses.map((h, i) => (
                    <li key={i} className="text-muted-foreground">
                      • {h.hypothesis}{" "}
                      <Badge variant="outline" className="ml-1 align-middle">
                        {h.confidence}
                      </Badge>
                      <span className="block pl-3 text-xs">Base: {h.basis}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!!r.insights?.recommendations?.length && (
              <div>
                <p className="font-medium">Plan de desarrollo sugerido</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {r.insights.recommendations.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {r.gameSession.adminFeedback && (
              <div>
                <p className="font-medium">Feedback del evaluador</p>
                <p className="text-muted-foreground">{r.gameSession.adminFeedback}</p>
              </div>
            )}
          </section>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
            <Button className="gap-2" onClick={onDownload} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Descargar PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
