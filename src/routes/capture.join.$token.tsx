import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  validateCaptureInvitation,
  joinCaptureInvitation,
  getCaptureJoinState,
} from "@/lib/capture-invitations.functions";
import { CaptureRecorder } from "@/components/CaptureRecorder";
import { MultiCamMosaic } from "@/components/MultiCamMosaic";
import { CaptureConsentGate, type ConsentScopes } from "@/components/CaptureConsentGate";
import { MediaDeviceSelector, type MediaDeviceSelection } from "@/components/MediaDeviceSelector";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogIn, ShieldCheck, Gamepad2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/capture/join/$token")({
  head: () => ({
    meta: [
      { title: "Unirse a la grabación · Playnalyze" },
      {
        name: "description",
        content: "Accede por invitación a una sesión de grabación y análisis de Playnalyze.",
      },
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "Unirse a la grabación · Playnalyze" },
      { property: "og:description", content: "Sesión de grabación por invitación privada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinCapturePage,
});

function JoinCapturePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const validate = useServerFn(validateCaptureInvitation);
  const join = useServerFn(joinCaptureInvitation);
  const state = useServerFn(getCaptureJoinState);

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [faceConsent, setFaceConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [mediaScopes, setMediaScopes] = useState<ConsentScopes | null>(null);

  const inv = useQuery({
    queryKey: ["capture-invite", token],
    queryFn: () => validate({ data: { token } }),
    retry: false,
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      setAuthed(!!u);
      if (u) setName((p) => p || (u.user_metadata?.full_name as string | undefined) || u.email || "");
    })();
  }, []);

  const joinState = useQuery({
    queryKey: ["capture-join-state", token],
    queryFn: () => state({ data: { token } }),
    enabled: authed === true && !!inv.data,
    retry: false,
  });

  useEffect(() => {
    const p = joinState.data?.participant;
    if (p) {
      setParticipantId(p.id);
      setName((prev) => prev || p.name);
    }
  }, [joinState.data]);

  function goToLogin() {
    try {
      sessionStorage.setItem("postAuthRedirect", window.location.pathname);
    } catch {
      /* sin sessionStorage volveremos manualmente */
    }
    navigate({ to: "/auth" });
  }

  if (inv.isLoading || authed === null) {
    return <div className="mx-auto max-w-lg p-8 text-muted-foreground">Cargando invitación…</div>;
  }

  if (inv.error) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <Card>
          <CardHeader>
            <CardTitle>Enlace no válido</CardTitle>
            <CardDescription>{(inv.error as Error).message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/">Volver al inicio</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const session = inv.data!.session;

  async function onJoin() {
    if (!name.trim()) return toast.error("Escribe tu nombre");
    if (!consent) return toast.error("Debes aceptar el consentimiento de grabación");
    setBusy(true);
    try {
      const r = await join({
        data: {
          token,
          name: name.trim(),
          consentRecording: true,
          consentFaceAnalysis: faceConsent,
        },
      });
      setParticipantId(r.participantId);
      toast.success("Ya estás dentro de la sesión");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo unir a la sesión");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <header className="space-y-1">
        <Link to="/" className="inline-flex items-center gap-2 font-bold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          Playnalyze
        </Link>
        <h1 className="text-2xl font-bold">{session.title}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">
            {session.mode === "group" ? "Sesión grupal" : "Sesión individual"}
          </Badge>
          <Badge variant="secondary">
            {session.captureMode === "per_participant"
              ? "Un dispositivo por participante"
              : "Un solo dispositivo"}
          </Badge>
          <span>Conservación: {session.retentionDays} días</span>
        </p>
      </header>

      {authed === false ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inicia sesión para continuar</CardTitle>
            <CardDescription>
              Esta sesión de grabación requiere una cuenta para identificar tu vídeo y tu progreso en
              la simulación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={goToLogin} className="gap-2">
              <LogIn className="h-4 w-4" /> Entrar o crear cuenta
            </Button>
          </CardContent>
        </Card>
      ) : !participantId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Consentimiento y datos
            </CardTitle>
            <CardDescription>
              {session.consentText ||
                "Se grabará tu cámara y tu micrófono para analizar la interacción (lenguaje verbal y no verbal). Podrás solicitar la eliminación en cualquier momento."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5 max-w-sm">
              <Label htmlFor="pname">Tu nombre</Label>
              <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
              <span>Acepto que se grabe mi cámara, voz y (si procede) mi pantalla.</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={faceConsent} onCheckedChange={(v) => setFaceConsent(v === true)} />
              <span>
                Acepto además el análisis de expresiones faciales y emociones (opcional).
              </span>
            </label>
            <Button onClick={onJoin} disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Unirme a la sesión
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {session.simulationId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4" /> Tu simulación
                </CardTitle>
                <CardDescription>
                  Inicia la grabación y después abre la simulación: la juegas a tu propio ritmo, con
                  todos los controles de vídeo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="secondary" className="gap-2">
                  <a
                    href={`/app/play/${session.simulationId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Gamepad2 className="h-4 w-4" /> Abrir simulación en otra pestaña
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}

          {!mediaScopes ? (
            <CaptureConsentGate
              token={token}
              sessionTitle={session.title}
              consentText={session.consentText}
              retentionDays={session.retentionDays}
              recordScreen={session.recordScreen}
              initial={{ recording: consent, faceAnalysis: faceConsent }}
              storageKey={`pn-consent-${session.id}`}
              onGranted={setMediaScopes}
            />
          ) : (
            <>
              <CaptureRecorder
                captureSessionId={session.id}
                participantId={participantId}
                participantName={name}
                recordScreen={session.recordScreen && mediaScopes.screen}
                inviteToken={token}
              />

              {(session.mode === "group" || session.captureMode === "per_participant") && (
                <MultiCamMosaic captureSessionId={session.id} displayName={name} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
