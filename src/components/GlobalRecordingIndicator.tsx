import { Circle, Loader2, Pause, Play, Square } from "lucide-react";
import {
  getElapsedSec,
  pauseRecording,
  resumeRecording,
  stopRecording,
  useActiveRecordings,
} from "@/lib/capture-engine";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (active.length === 0) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [active.length]);

  if (active.length === 0) return null;

  async function onStop(key: string) {
    setBusy(key);
    try {
      const saved = await stopRecording(key);
      if (saved) toast.success("Grabación guardada");
      else toast.error("No se pudo guardar la grabación");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la grabación");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed bottom-20 right-3 z-50 sm:bottom-4"
      role="status"
      aria-live="polite"
      data-tick={tick}
    >
      <div className="flex w-64 flex-col gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
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
