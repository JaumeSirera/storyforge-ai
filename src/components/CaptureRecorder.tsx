import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { registerRecording } from "@/lib/capture.functions";
import {
  createParticipantUploadTicket,
  registerParticipantRecording,
} from "@/lib/capture-invitations.functions";
import { joinCaptureControlChannel } from "@/lib/capture-control";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Circle, Square, Loader2, Video, MonitorUp, Mic, Pause, Play, Radio } from "lucide-react";
import { toast } from "sonner";

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function pickMime() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
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
}: Props) {
  const register = useServerFn(registerRecording);
  const createTicket = useServerFn(createParticipantUploadTicket);
  const registerInvited = useServerFn(registerParticipantRecording);
  const videoRef = useRef<HTMLVideoElement>(null);
  const camRecorder = useRef<MediaRecorder | null>(null);
  const screenRecorder = useRef<MediaRecorder | null>(null);
  const camChunks = useRef<Blob[]>([]);
  const screenChunks = useRef<Blob[]>([]);
  const streams = useRef<MediaStream[]>([]);
  const startedAt = useRef<number>(0);
  const pausedMs = useRef<number>(0);
  const pausedAt = useRef<number>(0);
  const offsetMs = useRef<number>(0);

  const [state, setState] = useState<"idle" | "recording" | "paused" | "uploading">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [previewOn, setPreviewOn] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [hostSynced, setHostSynced] = useState(false);


  async function attachStream(stream: MediaStream) {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    el.muted = true;
    el.playsInline = true;
    try {
      await el.play();
    } catch {
      /* autoplay puede requerir gesto del usuario */
    }
  }

  async function ensurePreview(): Promise<MediaStream> {
    const existing = streams.current.find((s) => s.getVideoTracks().some((t) => t.readyState === "live"));
    if (existing) {
      await attachStream(existing);
      setPreviewOn(true);
      return existing;
    }
    const cam = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    streams.current.push(cam);
    await attachStream(cam);
    setPreviewOn(true);
    return cam;
  }

  async function startPreview() {
    setPreviewLoading(true);
    try {
      await ensurePreview();
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


  useEffect(() => {
    if (state !== "recording") return;
    const t = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 500);
    return () => clearInterval(t);
  }, [state]);

  useEffect(() => {
    return () => {
      streams.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    };
  }, []);

  async function upload(blob: Blob, kind: "camera" | "screen", durationSec: number) {
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
          syncOffsetMs: Math.round(offsetMs.current),
        },
      });
      return;
    }

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error("Sesión caducada");
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const path = `${uid}/${captureSessionId}/${kind}-${participantId ?? "session"}-${Date.now()}.${ext}`;
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
        syncOffsetMs: Math.round(offsetMs.current),
      },
    });
  }

  async function start() {
    try {
      const cam = await ensurePreview();


      const mime = pickMime();
      camChunks.current = [];
      const rec = new MediaRecorder(cam, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) camChunks.current.push(e.data);
      };
      camRecorder.current = rec;

      if (recordScreen) {
        try {
          const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
          streams.current.push(screen);
          screenChunks.current = [];
          const srec = new MediaRecorder(screen, mime ? { mimeType: mime } : undefined);
          srec.ondataavailable = (e) => {
            if (e.data.size > 0) screenChunks.current.push(e.data);
          };
          screenRecorder.current = srec;
          srec.start(2000);
        } catch {
          toast.info("Grabación de pantalla cancelada; se graba solo la cámara.");
        }
      }

      offsetMs.current = getGameOffsetMs?.() ?? 0;
      startedAt.current = Date.now();
      pausedMs.current = 0;
      pausedAt.current = 0;
      setElapsed(0);
      rec.start(2000);
      setState("recording");
    } catch (err: any) {
      toast.error(
        err?.name === "NotAllowedError"
          ? "Necesitamos permiso de cámara y micrófono para grabar."
          : err?.message || "No se pudo iniciar la grabación",
      );
    }
  }

  function pause() {
    if (state !== "recording") return;
    [camRecorder.current, screenRecorder.current].forEach((r) => {
      if (r && r.state === "recording") r.pause();
    });
    pausedAt.current = Date.now();
    setState("paused");
  }

  function resume() {
    if (state !== "paused") return;
    if (pausedAt.current) pausedMs.current += Date.now() - pausedAt.current;
    pausedAt.current = 0;
    [camRecorder.current, screenRecorder.current].forEach((r) => {
      if (r && r.state === "paused") r.resume();
    });
    setState("recording");
  }

  async function stop() {
    if (state === "paused" && pausedAt.current) {
      pausedMs.current += Date.now() - pausedAt.current;
      pausedAt.current = 0;
    }
    const duration = (Date.now() - startedAt.current - pausedMs.current) / 1000;
    setState("uploading");
    try {
      const waitFor = (rec: MediaRecorder | null) =>
        new Promise<void>((resolve) => {
          if (!rec || rec.state === "inactive") return resolve();
          rec.onstop = () => resolve();
          rec.stop();
        });

      await Promise.all([waitFor(camRecorder.current), waitFor(screenRecorder.current)]);
      streams.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      streams.current = [];
      if (videoRef.current) videoRef.current.srcObject = null;
      setPreviewOn(false);


      const camBlob = new Blob(camChunks.current, { type: camChunks.current[0]?.type || "video/webm" });
      if (camBlob.size < 2048) throw new Error("La grabación quedó vacía; inténtalo de nuevo.");
      await upload(camBlob, "camera", duration);

      if (screenChunks.current.length > 0) {
        const sBlob = new Blob(screenChunks.current, {
          type: screenChunks.current[0]?.type || "video/webm",
        });
        if (sBlob.size > 2048) await upload(sBlob, "screen", duration);
      }

      camChunks.current = [];
      screenChunks.current = [];
      camRecorder.current = null;
      screenRecorder.current = null;
      toast.success("Grabación guardada");
      onUploaded?.();
    } catch (err: any) {
      toast.error(err?.message || "No se pudo guardar la grabación");
    } finally {
      setState("idle");
    }
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
            </CardDescription>
          </div>
          {state === "recording" && (
            <Badge variant="destructive" className="gap-1">
              <Circle className="h-2.5 w-2.5 fill-current animate-pulse" /> {fmt(elapsed)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative overflow-hidden rounded-lg bg-muted aspect-video">
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className="h-full w-full object-cover"
          />
          {!previewOn && (
            <div className="absolute inset-0 grid place-items-center gap-2 text-sm text-muted-foreground">
              <div className="flex flex-col items-center gap-2 text-center px-4">
                <Video className="h-6 w-6" />
                <span>Vista previa de la cámara desactivada</span>
                <Button size="sm" variant="secondary" onClick={startPreview} disabled={previewLoading}>
                  {previewLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Activar cámara"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {state !== "recording" ? (
            <Button onClick={start} disabled={state === "uploading"} className="gap-2">
              {state === "uploading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Circle className="h-4 w-4 fill-current" />
              )}
              {state === "uploading" ? "Guardando…" : "Iniciar grabación"}
            </Button>
          ) : (
            <Button onClick={stop} variant="destructive" className="gap-2">
              <Square className="h-4 w-4" /> Detener y guardar
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          La grabación se guarda cifrada en tu almacenamiento privado y se elimina automáticamente al
          cumplirse el plazo de conservación de la sesión.
        </p>
      </CardContent>
    </Card>
  );
}
