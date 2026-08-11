import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { registerRecording } from "@/lib/capture.functions";
import {
  createParticipantUploadTicket,
  registerParticipantRecording,
} from "@/lib/capture-invitations.functions";
import { joinCaptureControlChannel } from "@/lib/capture-control";
import {
  attachVideoElement,
  attachScreenElement,
  startScreenCapture,
  canCaptureScreen,
  captureKey,
  discardRecovery,
  ensurePreview,
  pauseRecording,
  pendingRecovery,
  recoverRecording,
  resumeRecording,
  startRecording,
  stopRecording,
  useCaptureState,
  type CaptureUploadPayload,
} from "@/lib/capture-engine";
import type { RecoveryMeta } from "@/lib/capture-recovery";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Circle,
  Square,
  Loader2,
  Video,
  MonitorUp,
  Mic,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { toast } from "sonner";
import { MediaDeviceSelector, type MediaDeviceSelection } from "./MediaDeviceSelector";
import { PreviewViewControls, usePreviewView } from "./PreviewViewControls";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface Props {
  captureSessionId: string;
  /** Participante asociado a esta pista (modo "cada participante en su dispositivo"). */
  participantId?: string | null;
  participantName?: string | null;
  recordScreen: boolean;
  /** Token de invitación: activa el modo participante invitado (sube al espacio del anfitrión). */
  inviteToken?: string | null;
  /** Milisegundos transcurridos del juego al iniciar (sincronización con el vídeo). */
  getGameOffsetMs?: () => number;
  /** Obedecer las órdenes de inicio/pausa/parada del anfitrión (por defecto sí). */
  followHost?: boolean;
  onUploaded?: () => void;
  /** Dispositivos preseleccionados. Si no se pasan, el selector se muestra internamente. */
  mediaSelection?: MediaDeviceSelection | null;
  /** Clave para recordar la selección de dispositivos en sessionStorage. */
  deviceStorageKey?: string;
}

export function CaptureRecorder({
  captureSessionId,
  participantId = null,
  participantName,
  recordScreen,
  inviteToken = null,
  getGameOffsetMs,
  followHost = true,
  onUploaded,
  mediaSelection: externalMediaSelection,
  deviceStorageKey,
}: Props) {
  const register = useServerFn(registerRecording);
  const createTicket = useServerFn(createParticipantUploadTicket);
  const registerInvited = useServerFn(registerParticipantRecording);
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);

  const key = captureKey(captureSessionId, participantId);
  const { phase, previewOn, elapsed, screenSharing } = useCaptureState(key);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [hostSynced, setHostSynced] = useState(false);
  const [mediaSelection, setMediaSelection] = useState<MediaDeviceSelection | null>(
    externalMediaSelection ?? null,
  );

  const effectiveStorageKey =
    deviceStorageKey ?? `pn-devices-${captureSessionId}-${participantId ?? "host"}`;
  const preview = usePreviewView(`pn-preview-view-${participantId ?? "host"}`);

  // Vincula el <video> visible; la grabación vive en el motor y sigue activa al navegar.
  useEffect(() => {
    attachVideoElement(key, videoRef.current);
    return () => attachVideoElement(key, null);
  }, [key, mediaSelection]);

  // Vincula el <video> que muestra lo que se está capturando de la pantalla.
  useEffect(() => {
    attachScreenElement(key, screenRef.current);
    return () => attachScreenElement(key, null);
  }, [key, screenSharing, phase]);

  // Reanudación: si la página se recargó o se cerró con una grabación en marcha,
  // los fragmentos siguen guardados en local y se pueden recuperar.
  const [recovery, setRecovery] = useState<RecoveryMeta | null>(null);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let alive = true;
    if (phase !== "idle") {
      setRecovery(null);
      return;
    }
    void pendingRecovery(key).then((meta) => {
      if (alive) setRecovery(meta);
    });
    return () => {
      alive = false;
    };
  }, [key, phase]);


  async function upload({ blob, kind, durationSec, syncOffsetMs }: CaptureUploadPayload) {
    const ext0 = blob.type.includes("mp4") ? "mp4" : "webm";

    // Modo invitado: subida con URL firmada al espacio del anfitrión.
    if (inviteToken) {
      const ticket = await createTicket({ data: { token: inviteToken, kind, ext: ext0 } });
      const { error } = await supabase.storage
        .from("recordings")
        .uploadToSignedUrl(ticket.path, ticket.uploadToken, blob, {
          contentType: blob.type || "video/webm",
        });
      if (error) throw new Error(error.message);
      await registerInvited({
        data: {
          token: inviteToken,
          kind,
          storagePath: ticket.path,
          mimeType: blob.type || "video/webm",
          sizeBytes: blob.size,
          durationSec,
          syncOffsetMs,
        },
      });
      return;
    }

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error("Sesión caducada");
    const path = `${uid}/${captureSessionId}/${kind}-${participantId ?? "session"}-${Date.now()}.${ext0}`;
    const { error } = await supabase.storage.from("recordings").upload(path, blob, {
      contentType: blob.type || "video/webm",
      upsert: false,
    });
    if (error) throw new Error(error.message);
    await register({
      data: {
        captureSessionId,
        participantId,
        kind,
        storagePath: path,
        mimeType: blob.type || "video/webm",
        sizeBytes: blob.size,
        durationSec,
        syncOffsetMs,
      },
    });
  }

  async function startPreview() {
    setPreviewLoading(true);
    try {
      await ensurePreview(key, mediaSelection, participantName ?? "Sesión");
    } catch (err: any) {
      toast.error(
        err?.name === "NotAllowedError"
          ? "Necesitamos permiso de cámara y micrófono para ver la vista previa."
          : err?.message || "No se pudo activar la cámara",
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  async function start() {
    try {
      await startRecording(
        key,
        {
          recordScreen,
          uploader: upload,
          getGameOffsetMs,
          selection: mediaSelection,
        },
        participantName ?? "Sesión",
      );
    } catch (err: any) {
      if (err?.message === "__screen_cancelled__") {
        toast.info("Grabación de pantalla cancelada; se graba solo la cámara.");
        try {
          await startRecording(
            key,
            { recordScreen: false, uploader: upload, getGameOffsetMs, selection: mediaSelection },
            participantName ?? "Sesión",
          );
        } catch (e: any) {
          toast.error(e?.message || "No se pudo iniciar la grabación");
        }
        return;
      }
      toast.error(
        err?.name === "NotAllowedError"
          ? "Necesitamos permiso de cámara y micrófono para grabar."
          : err?.message || "No se pudo iniciar la grabación",
      );
    }
  }

  async function stop() {
    try {
      const saved = await stopRecording(key);
      if (saved) {
        toast.success("Grabación guardada");
        onUploaded?.();
      }
    } catch (err: any) {
      toast.error(err?.message || "No se pudo guardar la grabación");
    }
  }

  async function recoverAndSave() {
    setRecovering(true);
    try {
      const ok = await recoverRecording(key, upload);
      if (ok) {
        toast.success("Grabación recuperada y guardada");
        onUploaded?.();
      } else {
        toast.info("La grabación interrumpida no tenía contenido utilizable.");
      }
      setRecovery(null);
    } catch (err: any) {
      toast.error(err?.message || "No se pudo recuperar la grabación");
    } finally {
      setRecovering(false);
    }
  }

  async function discard() {
    await discardRecovery(key);
    setRecovery(null);
    toast.success("Grabación interrumpida descartada");
  }


  // Órdenes del anfitrión: inicio, pausa, reanudación y parada sincronizadas.
  const actions = useRef({ start, pause: () => pauseRecording(key), resume: () => resumeRecording(key), stop });
  actions.current = { start, pause: () => pauseRecording(key), resume: () => resumeRecording(key), stop };

  useEffect(() => {
    if (!followHost) return;
    const channel = joinCaptureControlChannel(captureSessionId, (msg) => {
      const a = actions.current;
      if (msg.action === "start") {
        toast.info("El anfitrión ha iniciado la grabación");
        void a.start();
      } else if (msg.action === "pause") {
        a.pause();
      } else if (msg.action === "resume") {
        a.resume();
      } else if (msg.action === "stop") {
        void a.stop();
      }
    });
    setHostSynced(true);
    return () => {
      setHostSynced(false);
      void channel.unsubscribe();
    };
  }, [captureSessionId, followHost]);

  if (!mediaSelection) {
    return (
      <MediaDeviceSelector
        storageKey={effectiveStorageKey}
        onSelected={setMediaSelection}
        title={
          participantName ? `Dispositivos de ${participantName}` : "Elige dispositivos de captura"
        }
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="h-4 w-4" />
              {participantName ? `Grabación de ${participantName}` : "Grabación de la sesión"}
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1">
                <Mic className="h-3 w-3" /> Cámara + micrófono
              </span>
              {recordScreen && (
                <span className="inline-flex items-center gap-1">
                  <MonitorUp className="h-3 w-3" /> Pantalla
                </span>
              )}
              {followHost && hostSynced && (
                <span className="inline-flex items-center gap-1">
                  <Radio className="h-3 w-3" /> Sincronizado con el anfitrión
                </span>
              )}
            </CardDescription>
          </div>
          {(phase === "recording" || phase === "paused") && (
            <Badge variant={phase === "paused" ? "secondary" : "destructive"} className="gap-1">
              <Circle
                className={`h-2.5 w-2.5 fill-current ${phase === "recording" ? "animate-pulse" : ""}`}
              />
              {phase === "paused" ? `En pausa · ${fmt(elapsed)}` : fmt(elapsed)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {recovery && (
          <div
            role="status"
            className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
          >
            <p className="font-medium">Grabación interrumpida detectada</p>
            <p className="mt-1 text-xs">
              Se recuperaron {fmt(recovery.durationSec)} de grabación de{" "}
              {new Date(recovery.startedAt).toLocaleString("es-ES")}. Puedes guardarla o descartarla
              antes de empezar una nueva toma.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={recoverAndSave} disabled={recovering} className="gap-2">
                {recovering ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Recuperar y guardar
              </Button>
              <Button size="sm" variant="ghost" onClick={discard} disabled={recovering} className="gap-2">
                <Trash2 className="h-4 w-4" /> Descartar
              </Button>
            </div>
          </div>
        )}

        <PreviewViewControls view={preview.view} onChange={preview.update} />
        <div className={`relative overflow-hidden rounded-lg bg-muted ${preview.frameClass}`}>
          <video ref={videoRef} playsInline autoPlay muted className={preview.videoClass} />
          {previewOn && (
            <span className="absolute left-2 top-2 rounded bg-background/80 px-2 py-0.5 text-[11px] font-medium">
              Cámara
            </span>
          )}
          {!previewOn && (
            <div className="absolute inset-0 grid place-items-center gap-2 text-sm text-muted-foreground">
              <div className="flex flex-col items-center gap-2 text-center px-4">
                <Video className="h-6 w-6" />
                <span>Vista previa de la cámara desactivada</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={startPreview}
                  disabled={previewLoading}
                >
                  {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activar cámara"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {recordScreen && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MonitorUp className="h-3 w-3" /> Captura de pantalla
              </span>
              <span>
                {screenSharing
                  ? "Compartiendo: esto es lo que se está grabando"
                  : "Se activará al iniciar la grabación"}
              </span>
            </div>
            {!screenSharing && (phase === "recording" || phase === "paused") && (
              <Button
                size="sm"
                variant="secondary"
                className="gap-2"
                onClick={async () => {
                  if (!canCaptureScreen()) {
                    toast.error(
                      "Este navegador o vista no permite compartir pantalla. Abre la app en una pestaña propia.",
                    );
                    return;
                  }
                  const ok = await startScreenCapture(key);
                  toast[ok ? "success" : "error"](
                    ok
                      ? "Pantalla añadida a la grabación en curso."
                      : "No se pudo compartir la pantalla (cancelada o bloqueada por el navegador).",
                  );
                }}
              >
                <MonitorUp className="h-4 w-4" /> Compartir pantalla ahora
              </Button>
            )}
            <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted">
              <video
                ref={screenRef}
                playsInline
                autoPlay
                muted
                aria-label="Vista previa de la pantalla compartida"
                className="h-full w-full object-contain"
              />
              {!screenSharing && (
                <div className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-muted-foreground">
                  Sin pantalla compartida todavía. Sí se pueden grabar cámara y pantalla a la vez:
                  el navegador pide permiso aparte y, si se cancela o la vista previa lo bloquea,
                  puedes añadirla con el botón de arriba (o abre la app en su propia pestaña).
                </div>
              )}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {phase === "idle" || phase === "uploading" ? (
            <Button onClick={start} disabled={phase === "uploading"} className="gap-2">
              {phase === "uploading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Circle className="h-4 w-4 fill-current" />
              )}
              {phase === "uploading" ? "Guardando…" : "Iniciar grabación"}
            </Button>
          ) : (
            <>
              {phase === "recording" ? (
                <Button onClick={() => pauseRecording(key)} variant="secondary" className="gap-2">
                  <Pause className="h-4 w-4" /> Pausar
                </Button>
              ) : (
                <Button onClick={() => resumeRecording(key)} variant="secondary" className="gap-2">
                  <Play className="h-4 w-4" /> Reanudar
                </Button>
              )}
              <Button onClick={stop} variant="destructive" className="gap-2">
                <Square className="h-4 w-4" /> Detener y guardar
              </Button>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          La grabación continúa aunque navegues a la simulación u otra página: solo se detiene
          cuando pulsas «Detener y guardar». Se guarda en tu almacenamiento privado y se elimina al
          cumplirse el plazo de conservación de la sesión.
        </p>
      </CardContent>
    </Card>
  );
}
