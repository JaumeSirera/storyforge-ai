import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { composeCameraAndScreen } from "@/lib/compose-recordings";

interface Track {
  id: string;
  kind: string;
  durationSec?: number | null;
  syncOffsetMs: number;
  participantId?: string | null;
}

interface Props {
  recordings: Track[];
  /** Nombre del archivo descargado (sin extensión). */
  fileBase: string;
  /** Resuelve la URL firmada de una grabación. */
  getUrl: (id: string) => Promise<string>;
}

/**
 * Exporta la cámara y la pantalla de la sesión como un único vídeo sincronizado
 * (pantalla completa + cámara en recuadro) listo para compartir.
 */
export function ComposedExportButton({ recordings, fileBase, getUrl }: Props) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const screen = recordings.find((r) => r.kind === "screen");
  const camera = recordings.find((r) => r.kind === "camera");
  if (!screen || !camera) return null;

  async function run() {
    setBusy(true);
    setProgress(0);
    try {
      const [screenUrl, cameraUrl] = await Promise.all([getUrl(screen!.id), getUrl(camera!.id)]);
      const blob = await composeCameraAndScreen({
        screenUrl,
        cameraUrl,
        screenOffsetMs: screen!.syncOffsetMs,
        cameraOffsetMs: camera!.syncOffsetMs,
        durationSec: Math.max(screen!.durationSec ?? 0, camera!.durationSec ?? 0) || null,
        onProgress: setProgress,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileBase}-camara-pantalla.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success("Vídeo combinado descargado");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo combinar el vídeo");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">Exportar cámara + pantalla en un solo vídeo</p>
          <p className="text-xs text-muted-foreground">
            Se combinan sincronizadas (pantalla completa y cámara en recuadro). El proceso ocurre en
            tu navegador y dura aproximadamente lo que la grabación.
          </p>
        </div>
        <Button size="sm" className="gap-1" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {busy ? `Combinando… ${Math.round(progress * 100)}%` : "Exportar vídeo combinado"}
        </Button>
      </div>
      {busy && (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-border"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${Math.max(2, progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
