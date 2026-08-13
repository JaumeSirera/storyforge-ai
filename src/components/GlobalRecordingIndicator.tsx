import { AlertTriangle, Circle, Download, Loader2, Pause, Play, RotateCcw, Square } from "lucide-react";
import {
  downloadRecovery,
  getElapsedSec,
  pauseRecording,
  resumeRecording,
  retryPendingUpload,
  stopRecording,
  useActiveRecordings,
} from "@/lib/capture-engine";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { abortSession } from "@/lib/sessions.functions";
import { clearActiveGameSession, getActiveGameSession } from "@/lib/active-game-session";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Indicador global: recuerda que la grabación sigue activa aunque el usuario
 * navegue a la simulación u otra página de la app, y permite pausar, reanudar
 * o detener y guardar sin volver al módulo de captura.
 */
export function GlobalRecordingIndicator() {
  const active = useActiveRecordings();
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  /** Grabaciones detenidas cuya subida falló: se conserva la copia local. */
  const [failed, setFailed] = useState<{ key: string; message: string }[]>([]);
  const abort = useServerFn(abortSession);
  const qc = useQueryClient();

  useEffect(() => {
    if (active.length === 0) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [active.length]);

  /** Al guardar la grabación se aborta también la simulación en curso. */
  async function abortRunningSimulation() {
    const sessionId = getActiveGameSession();
    if (!sessionId) return;
    clearActiveGameSession(sessionId);
    try {
      const r = await abort({ data: { sessionId } });
      await qc.invalidateQueries({ queryKey: ["session", sessionId] });
      if (!r.alreadyCompleted) toast.info("Simulación finalizada al detener la grabación");
    } catch {
      /* la simulación puede haber terminado ya */
    }
  }

  async function onStop(key: string) {
    setBusy(key);
    let savedSuccessfully = false;
    try {
      const saved = await stopRecording(key);
      if (saved) {
        savedSuccessfully = true;
        setFailed((f) => f.filter((x) => x.key !== key));
        toast.success("Grabación guardada");
      } else {
        toast.error("No se pudo guardar la grabación");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la grabación";
      setFailed((f) => [...f.filter((x) => x.key !== key), { key, message }]);
      toast.error(message);
    } finally {
      if (savedSuccessfully) await abortRunningSimulation();
      setBusy(null);
    }
  }


  async function onRetry(key: string) {
    setBusy(key);
    try {
      const ok = await retryPendingUpload(key);
      if (ok) {
        setFailed((f) => f.filter((x) => x.key !== key));
        toast.success("Grabación guardada");
      } else {
        toast.info("No hay copia local utilizable para esta grabación.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la grabación");
    } finally {
      setBusy(null);
    }
  }

  async function onDownload(key: string) {
    const ok = await downloadRecovery(key);
    if (!ok) toast.info("No hay copia local disponible.");
  }

  if (active.length === 0 && failed.length === 0) return null;

  return (
    <div
      className="fixed bottom-20 right-3 z-50 sm:bottom-4"
      role="status"
      aria-live="polite"
      data-tick={tick}
    >
      <div className="flex w-64 flex-col gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
        {failed.map((f) => (
          <div key={`failed-${f.key}`} className="flex flex-col gap-2 rounded-md border border-destructive/40 p-2">
            <div className="flex items-start gap-2 text-xs font-medium text-destructive">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{f.message}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="secondary"
                className="h-7 flex-1 gap-1 px-2 text-xs"
                onClick={() => onRetry(f.key)}
                disabled={busy === f.key}
              >
                {busy === f.key ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="h-3 w-3" />
                )}
                Reintentar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 flex-1 gap-1 px-2 text-xs"
                onClick={() => onDownload(f.key)}
              >
                <Download className="h-3 w-3" /> Descargar
              </Button>
            </div>
          </div>
        ))}
        {active.map((r) => (

          <div key={r.key} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              {r.phase === "uploading" ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : r.phase === "paused" ? (
                <Pause className="h-3 w-3 text-muted-foreground" />
              ) : (
                <Circle className="h-3 w-3 animate-pulse fill-destructive text-destructive" />
              )}
              <span>
                {r.phase === "uploading"
                  ? "Guardando grabación…"
                  : r.phase === "paused"
                    ? `Grabación en pausa · ${fmt(getElapsedSec(r.key))}`
                    : `Grabando · ${fmt(getElapsedSec(r.key))}`}
              </span>
            </div>
            {r.phase !== "uploading" && (
              <div className="flex items-center gap-1">
                {r.phase === "paused" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 flex-1 gap-1 px-2 text-xs"
                    onClick={() => resumeRecording(r.key)}
                    disabled={busy === r.key}
                  >
                    <Play className="h-3 w-3" /> Reanudar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 flex-1 gap-1 px-2 text-xs"
                    onClick={() => pauseRecording(r.key)}
                    disabled={busy === r.key}
                  >
                    <Pause className="h-3 w-3" /> Pausar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 flex-1 gap-1 px-2 text-xs"
                  onClick={() => onStop(r.key)}
                  disabled={busy === r.key}
                >
                  {busy === r.key ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Square className="h-3 w-3" />
                  )}
                  Detener y guardar
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
