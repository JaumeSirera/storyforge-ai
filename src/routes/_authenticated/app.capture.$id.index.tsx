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
import { RecordingPlayer } from "@/components/RecordingPlayer";
import { ComposedExportButton } from "@/components/ComposedExportButton";


import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Users,
  ClipboardCheck,
  Mail,
  Film,
  ChevronRight,
  Radio,
  Grid2x2,
  Video,
  Search,
  Filter,
  X,
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
  validateSearch: (search: Record<string, unknown>) => ({
    edit: search['edit'] === "config" ? ("config" as const) : undefined,
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
  const [playing, setPlaying] = useState<{
    id: string;
    url: string;
    pipUrl?: string | null;
    pipOffsetMs?: number;
  } | null>(null);
  const [mediaSelection, setMediaSelection] = useState<MediaDeviceSelection | null>(null);
  const [myName, setMyName] = useState("Yo");
  const [pSearch, setPSearch] = useState("");
  const [pRoleFilter, setPRoleFilter] = useState<ParticipantRole | "all">("all");
  const [pStatusFilter, setPStatusFilter] = useState<"all" | "active" | "late">("all");
  const [open, setOpen] = useState<
    | null
    | "config"
    | "consent"
    | "participants"
    | "audit"
    | "invites"
    | "recordings"
    | "host"
    | "mosaic"
    | "record"
  >(null);

  const { edit } = Route.useSearch();
  useEffect(() => {
    if (edit === "config") setOpen("config");
  }, [edit]);



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

  const filteredParticipants = participants.filter((p) => {
    const q = pSearch.trim().toLowerCase();
    const matchesSearch =
      q === "" ||
      p.name.toLowerCase().includes(q) ||
      (p.identifier?.toLowerCase() || "").includes(q);
    const matchesRole = pRoleFilter === "all" || p.role === pRoleFilter;
    const matchesStatus =
      pStatusFilter === "all" ||
      (pStatusFilter === "late" && p.isLate) ||
      (pStatusFilter === "active" && !p.isLate);
    return matchesSearch && matchesRole && matchesStatus;
  });

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

      {/* Hub de secciones */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard
          icon={Settings2}
          title="Configuración de la sesión"
          summary={`${session.mode === "group" ? "Grupal" : "Individual"} · ${
            session.captureMode === "per_participant" ? "Un dispositivo por persona" : "Un dispositivo"
          } · ${session.retentionDays} días`}
          onClick={() => setOpen("config")}
        />
        <SectionCard
          icon={ShieldCheck}
          title="Consentimientos"
          summary={
            consentsOk
              ? `Grabación aceptada${session.consentFaceAnalysis ? " · análisis facial" : ""}`
              : "Pendiente: sin consentimiento no se puede grabar"
          }
          onClick={() => setOpen("consent")}
        />
        <SectionCard
          icon={Users}
          title="Participantes"
          summary={
            participants.length === 0
              ? "Aún no hay participantes"
              : `${participants.length} persona${participants.length === 1 ? "" : "s"}: ${participants
                  .map((p) => p.name)
                  .slice(0, 3)
                  .join(", ")}`
          }
          onClick={() => setOpen("participants")}
        />
        <SectionCard
          icon={ClipboardCheck}
          title="Auditoría de consentimientos"
          summary="Quién aceptó, cuándo y con qué versión del texto"
          onClick={() => setOpen("audit")}
        />
        <SectionCard
          icon={Mail}
          title="Invitaciones"
          summary="Enlaces para que cada persona entre desde su dispositivo"
          onClick={() => setOpen("invites")}
        />
        <SectionCard
          icon={Film}
          title="Grabaciones"
          summary={
            recordings.length === 0
              ? "Aún no hay grabaciones"
              : `${recordings.length} pista${recordings.length === 1 ? "" : "s"} · ver y exportar`
          }
          onClick={() => setOpen("recordings")}
        />
        {(session.mode === "group" || session.captureMode === "per_participant") && (
          <>
            <SectionCard
              icon={Radio}
              title="Control del anfitrión"
              summary="Inicia, pausa o detén la grabación en todos los dispositivos"
              onClick={() => setOpen("host")}
            />
            <SectionCard
              icon={Grid2x2}
              title="Mosaico multicámara"
              summary="Ver todas las cámaras de la sala en directo"
              onClick={() => setOpen("mosaic")}
            />
          </>
        )}
        <SectionCard
          icon={Video}
          title="Grabar"
          summary={
            !consentsOk
              ? "Pendiente: acepta el consentimiento para grabar"
              : session.captureMode === "per_participant" && participants.length > 0
                ? `Grabación por participante (${participants.length})`
                : "Grabación del anfitrión (cámara y pantalla)"
          }
          onClick={() => setOpen("record")}
        />
      </div>


      {/* Configuración de la sesión */}
      <Dialog open={open === "config"} onOpenChange={(v) => setOpen(v ? "config" : null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" /> Configuración de la sesión
            </DialogTitle>
            <DialogDescription>
              Ajusta el tipo de sesión y la captura antes de empezar a grabar. Los cambios se guardan
              en tu cuenta y se recuperan al volver a esta sesión.
              {recordings.length > 0
                ? " Ya hay grabaciones: los cambios no afectan a las pistas existentes."
                : ""}
            </DialogDescription>
          </DialogHeader>
        <div className="space-y-4">
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
        </div>
        </DialogContent>
      </Dialog>

      {/* Consentimiento */}
      <Dialog open={open === "consent"} onOpenChange={(v) => setOpen(v ? "consent" : null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Consentimiento y gobernanza
            </DialogTitle>
            <DialogDescription>
              Sin consentimiento de grabación no se puede iniciar la sesión. El análisis se limita a
              comportamientos observables.
            </DialogDescription>
          </DialogHeader>
        <div className="space-y-4">
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
        </div>
        </DialogContent>
      </Dialog>

      {/* Participantes */}
      <Dialog
        open={open === "participants"}
        onOpenChange={(v) => setOpen(v ? "participants" : null)}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Participantes
            </DialogTitle>
            <DialogDescription>
              Cada persona tiene fotografía, nombre, identificador y rol. Puedes incorporar a alguien
              que llegue tarde en cualquier momento.
            </DialogDescription>
          </DialogHeader>
        <div className="space-y-4">
          {participants.length === 0 && (
            <p className="text-sm text-muted-foreground">Aún no hay participantes.</p>
          )}

          {participants.length > 0 && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="p-search"
                    placeholder="Buscar por nombre o identificador…"
                    value={pSearch}
                    onChange={(e) => setPSearch(e.target.value)}
                    className="pl-9"
                    aria-label="Buscar participantes"
                  />
                  {pSearch && (
                    <button
                      type="button"
                      onClick={() => setPSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
                      aria-label="Limpiar búsqueda"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Select
                  value={pRoleFilter}
                  onValueChange={(v) => setPRoleFilter(v as ParticipantRole | "all")}
                  aria-label="Filtrar por rol"
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <Filter className="h-4 w-4 mr-1 text-muted-foreground" aria-hidden="true" />
                    <SelectValue placeholder="Rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los roles</SelectItem>
                    {PARTICIPANT_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {PARTICIPANT_ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={pStatusFilter}
                  onValueChange={(v) => setPStatusFilter(v as "all" | "active" | "late")}
                  aria-label="Filtrar por estado"
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                    <SelectItem value="late">Incorporación tardía</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Mostrando {filteredParticipants.length} de {participants.length} participantes
              </p>
              <ul className="space-y-2">
                {filteredParticipants.map((p) => (
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
              {filteredParticipants.length === 0 && (
                <p className="text-sm text-muted-foreground">Ningún participante coincide con los filtros.</p>
              )}
            </div>
          )}

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
        </div>
        </DialogContent>
      </Dialog>

      {/* Auditoría de consentimientos */}
      <Dialog open={open === "audit"} onOpenChange={(v) => setOpen(v ? "audit" : null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" /> Auditoría de consentimientos
            </DialogTitle>
            <DialogDescription>Registro de aceptaciones con fecha y versión.</DialogDescription>
          </DialogHeader>
          <CaptureConsentAudit captureSessionId={id} />
        </DialogContent>
      </Dialog>

      {/* Invitaciones para que cada participante entre desde su dispositivo */}
      <Dialog open={open === "invites"} onOpenChange={(v) => setOpen(v ? "invites" : null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Invitaciones
            </DialogTitle>
            <DialogDescription>
              Genera enlaces privados para que cada participante entre desde su dispositivo.
            </DialogDescription>
          </DialogHeader>
          <CaptureInvitationsCard captureSessionId={id} participants={participants} />
        </DialogContent>
      </Dialog>

      {/* Control sincronizado de la grabación en todos los dispositivos */}
      <Dialog open={open === "host"} onOpenChange={(v) => setOpen(v ? "host" : null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="h-4 w-4" /> Control del anfitrión
            </DialogTitle>
            <DialogDescription>
              Inicia, pausa o finaliza la grabación en todos los dispositivos conectados.
            </DialogDescription>
          </DialogHeader>
          {consentsOk ? (
            <CaptureHostControls captureSessionId={id} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Activa el consentimiento de grabación para habilitar el control remoto.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Mosaico multicámara en directo */}
      <Dialog open={open === "mosaic"} onOpenChange={(v) => setOpen(v ? "mosaic" : null)}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Grid2x2 className="h-4 w-4" /> Mosaico multicámara en directo
            </DialogTitle>
            <DialogDescription>
              Todas las cámaras de la sala a la vez, sin pasar por el servidor de grabación.
            </DialogDescription>
          </DialogHeader>
          {consentsOk ? (
            <MultiCamMosaic captureSessionId={id} displayName={myName} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Activa el consentimiento de grabación para entrar en la sala.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Grabación */}
      <Dialog open={open === "record"} onOpenChange={(v) => setOpen(v ? "record" : null)}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-4 w-4" /> Grabación
            </DialogTitle>
            <DialogDescription>
              Puedes cerrar esta ventana: la grabación continúa y se controla desde el indicador
              flotante.
            </DialogDescription>
          </DialogHeader>
          {!consentsOk ? (
            <p className="text-sm text-muted-foreground">
              Activa el consentimiento de grabación para habilitar la captura.
            </p>
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
        </DialogContent>
      </Dialog>


      {/* Grabaciones */}
      <Dialog
        open={open === "recordings"}
        onOpenChange={(v) => {
          setOpen(v ? "recordings" : null);
          if (v) void q.refetch();
        }}
      >
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Film className="h-4 w-4" /> Grabaciones de la sesión
            </DialogTitle>
            <DialogDescription>
              Cada pista guarda su desplazamiento de sincronización con el vídeo del juego. Las
              tomas que suben los participantes desde su propio móvil aparecen aquí al terminar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void q.refetch()}
              disabled={q.isFetching}
              className="gap-2"
            >
              {q.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Actualizar lista
            </Button>
          </div>

        <div className="space-y-3">
          {recordings.length === 0 && (
            <p className="text-sm text-muted-foreground">Aún no hay grabaciones.</p>
          )}
          {recordings.length > 0 &&
            recordings.some((r) => r.kind === "screen") &&
            !recordings.some((r) => r.kind === "camera") && (
              <p
                role="status"
                className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
              >
                Esta sesión solo tiene pista de pantalla: la cámara no llegó a guardarse (se cortó
                el permiso o la ocupó otra app durante la grabación). En la próxima toma verás un
                aviso para reactivarla sin perder lo grabado.
              </p>
            )}

          {buildTakes(recordings).map((take) => {
            const p = participants.find((x) => x.id === take.participantId);
            const screen = take.tracks.find((t) => t.kind === "screen");
            const camera = take.tracks.find((t) => t.kind === "camera");
            const main = screen ?? take.tracks[0]!;
            const openTrack = async (r: (typeof take.tracks)[number]) => {
              try {
                const { url } = await recUrl({ data: { id: r.id } });
                let pipUrl: string | null = null;
                let pipOffsetMs = 0;
                if (r.kind === "screen" && camera) {
                  try {
                    pipUrl = (await recUrl({ data: { id: camera.id } })).url;
                    pipOffsetMs = camera.syncOffsetMs - r.syncOffsetMs;
                  } catch {
                    pipUrl = null;
                  }
                }
                setPlaying({ id: r.id, url, pipUrl, pipOffsetMs });
              } catch (e: any) {
                toast.error(e?.message || "No se pudo abrir");
              }
            };
            const playingTrack = take.tracks.find((t) => t.id === playing?.id);
            return (
              <div key={take.key} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {take.tracks
                        .map((t) =>
                          t.kind === "screen" ? "Pantalla" : t.kind === "audio" ? "Audio" : "Cámara",
                        )
                        .join(" + ")}
                      {p ? ` · ${p.name}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {main.durationSec ? `${Math.round(main.durationSec)} s · ` : ""}
                      sync +{Math.round(main.syncOffsetMs / 100) / 10}s ·{" "}
                      {new Date(main.createdAt).toLocaleString("es-ES")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {take.tracks.map((t) => (
                      <span key={t.id} className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => openTrack(t)}
                        >
                          <Play className="h-3.5 w-3.5" />
                          {take.tracks.length > 1
                            ? t.kind === "screen"
                              ? "Ver pantalla"
                              : t.kind === "audio"
                                ? "Ver audio"
                                : "Ver cámara"
                            : "Ver"}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Eliminar grabación"
                          onClick={async () => {
                            if (!confirm("¿Eliminar esta grabación?")) return;
                            await delRec({ data: { id: t.id } });
                            if (playing?.id === t.id) setPlaying(null);
                            qc.invalidateQueries({ queryKey: ["capture-session", id] });
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </span>
                    ))}
                    {screen && camera && (
                      <ComposedExportButton
                        compact
                        recordings={take.tracks}
                        fileBase={`sesion-${(session.title || id).slice(0, 40)}-${new Date(
                          main.createdAt,
                        )
                          .toISOString()
                          .slice(11, 19)
                          .replace(/:/g, "")}`}
                        getUrl={async (rid) => (await recUrl({ data: { id: rid } })).url}
                        pipPrefsKey={id}
                      />
                    )}
                  </div>
                </div>
                {playingTrack && playing && (
                  <RecordingPlayer
                    src={playing.url}
                    durationSec={playingTrack.durationSec}
                    pipSrc={playing.pipUrl}
                    pipOffsetMs={playing.pipOffsetMs}
                    pipLabel={p ? `Cámara · ${p.name}` : "Cámara"}
                    pipPrefsKey={id}
                  />
                )}
              </div>
            );
          })}

        </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  summary,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  summary: string;
  onClick: () => void;
}) {
  return (
    <Card className="transition-colors hover:border-primary/50">
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <span className="flex-1">{title}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <CardDescription className="line-clamp-2">{summary}</CardDescription>
        </CardContent>
      </button>
    </Card>
  );
}

type RecTrack = {
  id: string;
  kind: string;
  durationSec?: number | null;
  syncOffsetMs: number;
  participantId?: string | null;
  createdAt: string;
};

type Take = {
  key: string;
  participantId?: string | null;
  tracks: RecTrack[];
};

/**
 * Agrupa las pistas de una misma toma (pantalla + cámara del mismo participante
 * grabadas casi a la vez) para mostrarlas en una única línea.
 */
function buildTakes<T extends RecTrack>(recordings: T[]): Take[] {
  const WINDOW_MS = 120_000;
  const takes: Take[] = [];
  for (const r of [...recordings].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )) {
    const t = new Date(r.createdAt).getTime();
    const target = takes.find(
      (g) =>
        g.participantId === (r.participantId ?? null) &&
        !g.tracks.some((x) => x.kind === r.kind) &&
        Math.abs(new Date(g.tracks[0]!.createdAt).getTime() - t) < WINDOW_MS,
    );
    if (target) target.tracks.push(r);
    else takes.push({ key: r.id, participantId: r.participantId ?? null, tracks: [r] });
  }
  // Pantalla primero dentro de cada toma, tomas más recientes arriba.
  const order: Record<string, number> = { screen: 0, camera: 1, audio: 2 };
  for (const g of takes) g.tracks.sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9));
  return takes.reverse();
}
