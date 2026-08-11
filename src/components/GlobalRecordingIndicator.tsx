import { Circle, Loader2, Pause } from "lucide-react";
import { getElapsedSec, useActiveRecordings } from "@/lib/capture-engine";
import { useEffect, useState } from "react";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Indicador global: recuerda que la grabación sigue activa aunque el usuario
 * navegue a la simulación u otra página de la app.
 */
export function GlobalRecordingIndicator() {
  const active = useActiveRecordings();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (active.length === 0) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [active.length]);

  if (active.length === 0) return null;

  return (
    <div
      className="fixed bottom-20 right-3 z-50 sm:bottom-4"
      role="status"
      aria-live="polite"
      data-tick={tick}
    >
      <div className="flex flex-col gap-1 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur">
        {active.map((r) => (
          <div key={r.key} className="flex items-center gap-2 text-xs font-medium">
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
        ))}
      </div>
    </div>
  );
}
