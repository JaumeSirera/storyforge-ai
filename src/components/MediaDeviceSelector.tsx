import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Mic, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export interface MediaDeviceSelection {
  videoDeviceId: string | null;
  audioDeviceId: string | null;
}

interface Props {
  /** Se invoca cuando el usuario confirma la selección; también se llama si ya había una guardada. */
  onSelected: (selection: MediaDeviceSelection) => void;
  /** Clave única para recordar la selección en sessionStorage. */
  storageKey: string;
  /** Si true, solo se muestra selector de cámara (no micrófono). */
  videoOnly?: boolean;
  /** Título opcional. */
  title?: string;
}

/**
 * Selector de dispositivos de cámara y micrófono. Solicita permisos de
 * forma proactiva para poder mostrar nombres legibles de los dispositivos.
 */
export function MediaDeviceSelector({
  onSelected,
  storageKey,
  videoOnly = false,
  title = "Elige dispositivos de captura",
}: Props) {
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [audioId, setAudioId] = useState<string | null>(null);

  async function loadDevices() {
    setLoading(true);
    setPermissionDenied(false);
    try {
      // Pedimos permisos de forma proactiva para que las etiquetas sean legibles.
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: !videoOnly });
      const devices = await navigator.mediaDevices.enumerateDevices();
      stream.getTracks().forEach((t) => t.stop());

      const cams = devices.filter((d) => d.kind === "videoinput");
      const mics = devices.filter((d) => d.kind === "audioinput");
      setVideoDevices(cams);
      setAudioDevices(mics);

      const saved = getSaved(storageKey);
      const defaultVideo =
        cams.find((d) => d.deviceId === saved.videoDeviceId)?.deviceId ??
        cams.find((d) => d.label.toLowerCase().includes("front"))?.deviceId ??
        cams[0]?.deviceId ??
        null;
      const defaultAudio =
        mics.find((d) => d.deviceId === saved.audioDeviceId)?.deviceId ??
        mics[0]?.deviceId ??
        null;

      setVideoId(defaultVideo);
      setAudioId(defaultAudio);

      if (defaultVideo) {
        onSelected({ videoDeviceId: defaultVideo, audioDeviceId: defaultAudio });
      }
    } catch (err: any) {
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setPermissionDenied(true);
      } else {
        toast.error(err?.message || "No se pudieron listar los dispositivos");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function confirm() {
    const selection: MediaDeviceSelection = {
      videoDeviceId: videoId,
      audioDeviceId: videoOnly ? null : audioId,
    };
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(selection));
    } catch {
      /* opcional */
    }
    onSelected(selection);
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Detectando cámara y micrófono…
        </CardContent>
      </Card>
    );
  }

  if (permissionDenied) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Permisos bloqueados
          </CardTitle>
          <CardDescription>
            Necesitamos acceso a la cámara{!videoOnly && " y al micrófono"} para mostrar los
            dispositivos disponibles. Permíteles en el icono de la barra de direcciones y vuelve a
            intentarlo.

          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={loadDevices} variant="secondary" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (videoDevices.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-muted-foreground">
          No se detectó ninguna cámara. Conecta una webcam y vuelve a intentarlo.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Camera className="h-4 w-4" /> {title}
        </CardTitle>
        <CardDescription>
          Selecciona la cámara{!videoOnly && " y el micrófono"} que quieres usar en esta sesión.
        </CardDescription>

      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-2">
              <Camera className="h-4 w-4 text-muted-foreground" /> Cámara
            </label>
            <Select
              value={videoId ?? "default"}
              onValueChange={(v) => setVideoId(v === "default" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona cámara" />
              </SelectTrigger>
              <SelectContent>
                {videoDevices.map((d) => (
                  <SelectItem key={d.deviceId} value={d.deviceId}>
                    {d.label || `Cámara ${videoDevices.indexOf(d) + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!videoOnly && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-2">
                <Mic className="h-4 w-4 text-muted-foreground" /> Micrófono
              </label>
              <Select
                value={audioId ?? "default"}
                onValueChange={(v) => setAudioId(v === "default" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona micrófono" />
                </SelectTrigger>
                <SelectContent>
                  {audioDevices.length === 0 && (
                    <SelectItem value="default" disabled>
                      Sin micrófonos detectados
                    </SelectItem>
                  )}
                  {audioDevices.map((d) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>
                      {d.label || `Micrófono ${audioDevices.indexOf(d) + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={confirm} disabled={!videoId} className="gap-2">
            <Camera className="h-4 w-4" /> Confirmar y continuar
          </Button>
          <Button onClick={loadDevices} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refrescar lista
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function getSaved(storageKey: string): MediaDeviceSelection {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw) as MediaDeviceSelection;
  } catch {
    /* ignorar */
  }
  return { videoDeviceId: null, audioDeviceId: null };
}
