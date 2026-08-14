import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { recordInvitedConsent } from "@/lib/capture-invitations.functions";
import { screenCaptureMode } from "@/lib/capture-engine";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck, Video, Mic, MonitorUp, Loader2, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export interface ConsentScopes {
  recording: boolean;
  faceAnalysis: boolean;
  voiceAnalysis: boolean;
  screen: boolean;
}

interface Props {
  token: string;
  sessionTitle: string;
  consentText?: string | null;
  retentionDays: number;
  recordScreen: boolean;
  /** Consentimientos ya aceptados al unirse (prellenan las casillas). */
  initial?: Partial<ConsentScopes>;
  storageKey: string;
  onGranted: (scopes: ConsentScopes) => void;
}

/**
 * Puerta de consentimiento: hasta que el participante invitado no acepta de
 * forma explícita, no se solicita ningún permiso de cámara ni micrófono.
 */
export function CaptureConsentGate({
  token,
  sessionTitle,
  consentText,
  retentionDays,
  recordScreen,
  initial,
  storageKey,
  onGranted,
}: Props) {
  const record = useServerFn(recordInvitedConsent);
  const [recording, setRecording] = useState(initial?.recording ?? false);
  const [faceAnalysis, setFaceAnalysis] = useState(initial?.faceAnalysis ?? false);
  const [voiceAnalysis, setVoiceAnalysis] = useState(initial?.voiceAnalysis ?? false);
  const [screen, setScreen] = useState(recordScreen ? (initial?.screen ?? false) : false);
  // En navegadores móviles no existe getDisplayMedia: la pantalla no puede grabarse.
  const [screenCaptureAvailable, setScreenCaptureAvailable] = useState(true);
  useEffect(() => {
    const ok = screenCaptureMode() !== "none";
    setScreenCaptureAvailable(ok);
    if (!ok) setScreen(false);
  }, []);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);

  // Si ya dio el consentimiento en esta sesión del navegador, no lo repetimos.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) onGranted(JSON.parse(raw) as ConsentScopes);
    } catch {
      /* sin sessionStorage pedimos el consentimiento otra vez */
    }
  }, [storageKey, onGranted]);

  async function accept() {
    if (!recording) {
      toast.error("Debes aceptar la grabación para poder participar");
      return;
    }
    setBusy(true);
    setDenied(false);
    const scopes: ConsentScopes = { recording, faceAnalysis, voiceAnalysis, screen };
    try {
      await record({ data: { token, ...scopes } });
      // Solicitamos los permisos del navegador solo después del consentimiento.
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((t) => t.stop());
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(scopes));
      } catch {
        /* opcional */
      }
      toast.success("Consentimiento registrado. Cámara y micrófono listos.");
      onGranted(scopes);
    } catch (e: any) {
      if (e?.name === "NotAllowedError" || e?.name === "NotFoundError") {
        setDenied(true);
        toast.error("El navegador ha bloqueado la cámara o el micrófono.");
      } else {
        toast.error(e?.message || "No se pudo registrar el consentimiento");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4" /> Antes de activar cámara y micrófono
        </CardTitle>
        <CardDescription>
          {consentText ||
            `En «${sessionTitle}» se grabará tu cámara, tu voz${
              recordScreen ? " y tu pantalla" : ""
            } para analizar la interacción. Nada se activa hasta que lo autorices.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li className="flex items-center gap-2 rounded-md border p-2">
            <Video className="h-4 w-4 text-muted-foreground" /> Vídeo de tu cámara
          </li>
          <li className="flex items-center gap-2 rounded-md border p-2">
            <Mic className="h-4 w-4 text-muted-foreground" /> Audio de tu micrófono
          </li>
          {recordScreen && screenCaptureAvailable && (
            <li className="flex items-center gap-2 rounded-md border p-2">
              <MonitorUp className="h-4 w-4 text-muted-foreground" /> Tu pantalla compartida
            </li>
          )}
          <li className="flex items-center gap-2 rounded-md border p-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Conservación: {retentionDays} días
          </li>
        </ul>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Tus autorizaciones</legend>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={recording}
              onCheckedChange={(v) => setRecording(v === true)}
              aria-label="Autorizo la grabación de cámara y micrófono"
            />
            <span>
              Autorizo la grabación de mi cámara y mi voz durante la sesión.{" "}
              <Badge variant="secondary">Obligatorio</Badge>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={faceAnalysis}
              onCheckedChange={(v) => setFaceAnalysis(v === true)}
              aria-label="Autorizo el análisis de expresiones faciales"
            />
            <span>Autorizo el análisis de expresiones faciales y emociones (opcional).</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={voiceAnalysis}
              onCheckedChange={(v) => setVoiceAnalysis(v === true)}
              aria-label="Autorizo el análisis de voz"
            />
            <span>Autorizo el análisis de voz: tono, ritmo y transcripción (opcional).</span>
          </label>
          {recordScreen && !screenCaptureAvailable && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
              Tu navegador no permite grabar la pantalla: se grabará solo tu cámara y tu voz.
            </p>
          )}
          {recordScreen && screenCaptureAvailable && (
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={screen}
                onCheckedChange={(v) => setScreen(v === true)}
                aria-label="Autorizo la grabación de mi pantalla"
              />
              <span>Autorizo la grabación de mi pantalla mientras juego (opcional).</span>
            </label>
          )}
        </fieldset>

        {denied && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Permisos bloqueados</AlertTitle>
            <AlertDescription>
              Tu navegador ha denegado el acceso. Permite cámara y micrófono en el icono de la barra
              de direcciones y vuelve a intentarlo.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={accept} disabled={busy || !recording} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Acepto y activar cámara y micrófono
          </Button>
          <p className="text-xs text-muted-foreground">
            Puedes retirar tu consentimiento cerrando la sesión: no se grabará nada.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}