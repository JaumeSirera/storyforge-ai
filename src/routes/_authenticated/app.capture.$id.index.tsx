import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getCaptureSession,
  updateCaptureSession,
  upsertParticipant,
  deleteParticipant,
  deleteRecording,
  getRecordingUrl,
  recordConsent,
  PARTICIPANT_ROLES,
  PARTICIPANT_ROLE_LABELS,
  type ParticipantRole,
  saveCapturePreferences,
} from "@/lib/capture.functions";
import { listPracticeAreas } from "@/lib/areas.functions";
import { CaptureRecorder } from "@/components/CaptureRecorder";
import { MultiCamMosaic } from "@/components/MultiCamMosaic";
import { CaptureInvitationsCard } from "@/components/CaptureInvitationsCard";
import { CaptureConsentAudit } from "@/components/CaptureConsentAudit";
import { CaptureHostControls } from "@/components/CaptureHostControls";
import { MediaDeviceSelector, type MediaDeviceSelection } from "@/components/MediaDeviceSelector";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  ShieldCheck,
  Clock,
  Play,
  Loader2,
  UserPlus,
  BarChart3,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/capture/$id/")({
  head: () => ({
    meta: [
      { title: "Sesión de grabación — Capture | Playnalyze" },
      {
        name: "description",
        content:
          "Participantes, roles, consentimientos y grabación sincronizada de la sesión antes del análisis.",
      },
      { property: "og:title", content: "Sesión de grabación — Capture | Playnalyze" },
      {
        property: "og:description",
        content:
          "Prepara la sesión: participantes, roles y consentimiento, y graba con sincronización.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CaptureSessionPage,
});

const DEFAULT_CONSENT = `Se informa a las personas participantes de que esta sesión será grabada (imagen y voz) con la finalidad de analizar la interacción y elaborar un informe de apoyo al profesional. El análisis se limita a comportamientos observables y no emite diagnósticos ni conclusiones sobre la personalidad. La grabación se conserva 30 días y se elimina automáticamente. Puedes retirar tu consentimiento en cualquier momento.`;

function CaptureSessionPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const get = useServerFn(getCaptureSession);
  const update = useServerFn(updateCaptureSession);
  const upsert = useServerFn(upsertParticipant);
  const delPart = useServerFn(deleteParticipant);
  const delRec = useServerFn(deleteRecording);
  const recUrl = useServerFn(getRecordingUrl);
  const consent = useServerFn(recordConsent);
  const listAreas = useServerFn(listPracticeAreas);
  const savePrefs = useServerFn(saveCapturePreferences);

  const q = useQuery({ queryKey: ["capture-session", id], queryFn: () => get({ data: { id } }) });
  const areasQ = useQuery({ queryKey: ["practice-areas"], queryFn: () => listAreas() });

  const [title, setTitle] = useState<string | null>(null);
  const [pName, setPName] = useState("");
  const [pRole, setPRole] = useState<ParticipantRole>("participante");

  const [pIdent, setPIdent] = useState("");
  const [pPhoto, setPPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [lateMode, setLateMode] = useState(false);
  const [consentText, setConsentText] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const [mediaSelection, setMediaSelection] = useState<MediaDeviceSelection | null>(null);
  const [myName, setMyName] = useState("Yo");

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      const name =
        (u?.user_metadata?.full_name as string | undefined) || u?.email?.split("@")[0] || "Yo";
      setMyName(name);
    });
  }, []);
  const fileRef = useRef<HTMLInputElement>(null);

  const session = q.data?.session;
  const participants = q.data?.participants ?? [];
  const recordings = q.data?.recordings ?? [];
  const text = consentText ?? session?.consentText ?? DEFAULT_CONSENT;

  async function patch(data: Record<string, unknown>) {
    await update({ data: { id, ...data } as any });
    qc.invalidateQueries({ queryKey: ["capture-session", id] });
    // Guarda los ajustes reutilizables como preferencias de la cuenta
    const prefKeys = ["areaKey", "mode", "captureMode", "recordScreen", "retentionDays"] as const;
    const prefs: Record<string, unknown> = {};
    for (const k of prefKeys) if (k in data) prefs[k] = data[k];
    if (Object.keys(prefs).length > 0) {
      try {
        await savePrefs({ data: prefs as any });
        qc.invalidateQueries({ queryKey: ["capture-preferences"] });
      } catch {
        /* preferencias no críticas */
      }
    }
  }

  async function uploadPhoto(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen supera los 5 MB");
      return;
    }
    setUploadingPhoto(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sesión caducada");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${uid}/${id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("participants")
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (error) throw new Error(error.message);
      setPPhoto(path);
      toast.success("Fotografía subida");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo subir la fotografía");
    } finally {
      setUploadingPhoto(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function addParticipant() {
    if (pName.trim().length < 1) {
      toast.error("Indica el nombre");
      return;
    }
    try {
      await upsert({
        data: {
          captureSessionId: id,
          name: pName.trim(),
          identifier: pIdent.trim() || null,
          role: pRole,
          photoPath: pPhoto,
          isLate: lateMode,
          joinedAtSec: lateMode ? 0 : null,
          colorIndex: participants.length,
        },
      });
      setPName("");
      setPIdent("");
      setPPhoto(null);
      qc.invalidateQueries({ queryKey: ["capture-session", id] });
      toast.success(lateMode ? "Participante incorporado" : "Participante añadido");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo añadir");
    }
  }

  if (q.isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (!session) return <p>Sesión no encontrada.</p>;

  const consentsOk = session.consentRecording;

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        to="/app/capture"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver a Capture
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{session.title}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{session.mode === "group" ? "Grupo" : "Individual"}</Badge>
            <Badge variant="outline">
              {session.captureMode === "per_participant" ? "Multi-dispositivo" : "Un dispositivo"}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              Borrado el {new Date(session.deleteAfter).toLocaleDateString("es-ES")}
            </Badge>
          </div>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/app/capture/$id/analyze" params={{ id }}>
            <BarChart3 className="h-4 w-4" /> Analizar
          </Link>
        </Button>
      </div>

      {/* Configuración de la sesión */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" /> Configuración de la sesión
          </CardTitle>
          <CardDescription>
            Ajusta el tipo de sesión y la captura antes de empezar a grabar. Los cambios se guardan
            en tu cuenta y se recuperan al volver a esta sesión.
            {recordings.length > 0
              ? " Ya hay grabaciones: los cambios no afectan a las pistas existentes."
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="s-title">Título</Label>
              <Input
                id="s-title"
                value={title ?? session.title}
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  const v = (title ?? session.title).trim();
                  if (v.length >= 2 && v !== session.title) patch({ title: v });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Área de aplicación</Label>
              <Select
                value={session.areaKey ?? "none"}
                onValueChange={(v) => patch({ areaKey: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin área" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin área</SelectItem>
                  {(areasQ.data ?? []).map((a) => (
                    <SelectItem key={a.key} value={a.key}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de sesión</Label>
              <Select value={session.mode} onValueChange={(v) => patch({ mode: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="group">Grupal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Modo de captura</Label>
              <Select value={session.captureMode} onValueChange={(v) => patch({ captureMode: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_device">Un solo dispositivo</SelectItem>
                  <SelectItem value="per_participant">Un dispositivo por participante</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Con un dispositivo por participante se crea una grabadora por persona.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Retención</Label>
              <Select
                value={String(session.retentionDays)}
                onValueChange={(v) => patch({ retentionDays: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[7, 15, 30, 60, 90, 180, 365].map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} días
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Borrado automático el {new Date(session.deleteAfter).toLocaleDateString("es-ES")}.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={session.status} onValueChange={(v) => patch({ status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="ready">Preparada</SelectItem>
                  <SelectItem value="recording">Grabando</SelectItem>
                  <SelectItem value="recorded">Grabada</SelectItem>
                  <SelectItem value="analyzing">Analizando</SelectItem>
                  <SelectItem value="done">Finalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Grabar también la pantalla</p>
              <p className="text-xs text-muted-foreground">
                Añade una pista de pantalla sincronizada con la cámara.
              </p>
            </div>
            <Switch
              checked={session.recordScreen}
              onCheckedChange={(v) => patch({ recordScreen: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Consentimiento */}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Consentimiento y gobernanza
          </CardTitle>
          <CardDescription>
            Sin consentimiento de grabación no se puede iniciar la sesión. El análisis se limita a
            comportamientos observables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            rows={5}
            value={text}
            onChange={(e) => setConsentText(e.target.value)}
            onBlur={() => patch({ consentText: text })}
          />
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Consentimiento de grabación (imagen y voz)</p>
              <p className="text-xs text-muted-foreground">Obligatorio para grabar.</p>
            </div>
            <Switch
              checked={session.consentRecording}
              onCheckedChange={async (v) => {
                await patch({ consentRecording: v, consentText: text });
                await consent({
                  data: {
                    captureSessionId: id,
                    scope: "recording",
                    granted: v,
                    consentText: text,
                  },
                });
              }}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Consentimiento de análisis facial</p>
              <p className="text-xs text-muted-foreground">
                Dato biométrico: requiere consentimiento explícito e informado de cada participante.
              </p>
            </div>
            <Switch
              checked={session.consentFaceAnalysis}
              onCheckedChange={async (v) => {
                await patch({ consentFaceAnalysis: v });
                await consent({
                  data: {
                    captureSessionId: id,
                    scope: "face_analysis",
                    granted: v,
                    consentText: text,
                  },
                });
              }}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Grabar la pantalla del juego</p>
              <p className="text-xs text-muted-foreground">
                Permite saber qué estaba viendo cada persona al responder.
              </p>
            </div>
            <Switch
              checked={session.recordScreen}
              onCheckedChange={(v) => patch({ recordScreen: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Participantes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Participantes</CardTitle>
          <CardDescription>
            Cada persona tiene fotografía, nombre, identificador y rol. Puedes incorporar a alguien
            que llegue tarde en cualquier momento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {participants.length === 0 && (
            <p className="text-sm text-muted-foreground">Aún no hay participantes.</p>
          )}
          <ul className="space-y-2">
            {participants.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: p.color ?? "#475569" }}
                    aria-hidden="true"
                  >
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {PARTICIPANT_ROLE_LABELS[p.role]}
                      {p.identifier ? ` · ${p.identifier}` : ""}
                      {p.isLate ? " · incorporación tardía" : ""}
                    </p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Quitar ${p.name}`}
                  onClick={async () => {
                    await delPart({ data: { id: p.id } });
                    qc.invalidateQueries({ queryKey: ["capture-session", id] });
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>

          <div className="rounded-lg border border-dashed border-border p-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Nombre</Label>
                <Input
                  id="p-name"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  maxLength={120}
                  placeholder="María"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-ident">Identificador (opcional)</Label>
                <Input
                  id="p-ident"
                  value={pIdent}
                  onChange={(e) => setPIdent(e.target.value)}
                  maxLength={60}
                  placeholder="P-02"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Select value={pRole} onValueChange={(v) => setPRole(v as ParticipantRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTICIPANT_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {PARTICIPANT_ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPhoto(f);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={uploadingPhoto}
                onClick={() => fileRef.current?.click()}
              >
                {uploadingPhoto ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {pPhoto ? "Fotografía lista" : "Subir fotografía"}
              </Button>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={lateMode} onCheckedChange={setLateMode} />
                Se incorpora tarde
              </label>
              <Button size="sm" className="gap-2 ml-auto" onClick={addParticipant}>
                {lateMode ? <UserPlus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {lateMode ? "Nuevo participante" : "Añadir participante"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auditoría de consentimientos */}
      <CaptureConsentAudit captureSessionId={id} />

      {/* Invitaciones para que cada participante entre desde su dispositivo */}
      <CaptureInvitationsCard captureSessionId={id} participants={participants} />

      {/* Control sincronizado de la grabación en todos los dispositivos */}
      {consentsOk && (session.mode === "group" || session.captureMode === "per_participant") && (
        <CaptureHostControls captureSessionId={id} />
      )}

      {/* Mosaico multicámara en directo */}
      {consentsOk && (session.mode === "group" || session.captureMode === "per_participant") && (
        <MultiCamMosaic captureSessionId={id} displayName={myName} />
      )}

      {/* Grabación */}
      {!consentsOk ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Activa el consentimiento de grabación para habilitar la captura.
          </CardContent>
        </Card>
      ) : !mediaSelection ? (
        <MediaDeviceSelector
          storageKey={`pn-devices-host-${id}`}
          onSelected={setMediaSelection}
          title="Dispositivos de captura del anfitrión"
        />
      ) : session.captureMode === "per_participant" && participants.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {participants.map((p) => (
            <CaptureRecorder
              key={p.id}
              captureSessionId={id}
              participantId={p.id}
              participantName={p.name}
              recordScreen={session.recordScreen}
              mediaSelection={mediaSelection}
              onUploaded={() => {
                qc.invalidateQueries({ queryKey: ["capture-session", id] });
                patch({ status: "recorded", endedAt: new Date().toISOString() });
              }}
            />
          ))}
        </div>
      ) : (
        <CaptureRecorder
          captureSessionId={id}
          recordScreen={session.recordScreen}
          mediaSelection={mediaSelection}
          onUploaded={() => {
            qc.invalidateQueries({ queryKey: ["capture-session", id] });
            patch({ status: "recorded", endedAt: new Date().toISOString() });
          }}
        />
      )}

      {/* Grabaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grabaciones de la sesión</CardTitle>
          <CardDescription>
            Cada pista guarda su desplazamiento de sincronización con el vídeo del juego.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recordings.length === 0 && (
            <p className="text-sm text-muted-foreground">Aún no hay grabaciones.</p>
          )}
          {recordings.map((r) => {
            const p = participants.find((x) => x.id === r.participantId);
            return (
              <div key={r.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {r.kind === "screen" ? "Pantalla" : r.kind === "audio" ? "Audio" : "Cámara"}
                      {p ? ` · ${p.name}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.durationSec ? `${Math.round(r.durationSec)} s · ` : ""}
                      sync +{Math.round(r.syncOffsetMs / 100) / 10}s ·{" "}
                      {new Date(r.createdAt).toLocaleString("es-ES")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={async () => {
                        try {
                          const { url } = await recUrl({ data: { id: r.id } });
                          setPlaying({ id: r.id, url });
                        } catch (e: any) {
                          toast.error(e?.message || "No se pudo abrir");
                        }
                      }}
                    >
                      <Play className="h-3.5 w-3.5" /> Ver
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Eliminar grabación"
                      onClick={async () => {
                        if (!confirm("¿Eliminar esta grabación?")) return;
                        await delRec({ data: { id: r.id } });
                        if (playing?.id === r.id) setPlaying(null);
                        qc.invalidateQueries({ queryKey: ["capture-session", id] });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {playing?.id === r.id && (
                  <RecordingPlayer src={playing.url} durationSec={r.durationSec} />
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
