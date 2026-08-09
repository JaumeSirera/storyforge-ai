import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listCaptureSessions,
  createCaptureSession,
  deleteCaptureSession,
} from "@/lib/capture.functions";
import { listPracticeAreas } from "@/lib/areas.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, Video, Users, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/capture/")({
  head: () => ({
    meta: [
      { title: "Capture — Grabación de sesiones | Playnalyze" },
      {
        name: "description",
        content:
          "Crea sesiones de grabación individuales o de grupo, define participantes y roles, y registra consentimientos antes de grabar.",
      },
      { property: "og:title", content: "Capture — Grabación de sesiones | Playnalyze" },
      {
        property: "og:description",
        content: "Sesiones de grabación con participantes, roles y consentimientos verificables.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CaptureIndex,
});

function CaptureIndex() {
  const qc = useQueryClient();
  const list = useServerFn(listCaptureSessions);
  const create = useServerFn(createCaptureSession);
  const del = useServerFn(deleteCaptureSession);
  const areasFn = useServerFn(listPracticeAreas);

  const sessions = useQuery({ queryKey: ["capture-sessions"], queryFn: () => list() });
  const areas = useQuery({ queryKey: ["practice-areas"], queryFn: () => areasFn() });

  const [title, setTitle] = useState("");
  const [areaKey, setAreaKey] = useState<string>("");
  const [mode, setMode] = useState<"individual" | "group">("individual");
  const [captureMode, setCaptureMode] = useState<"single_device" | "per_participant">(
    "single_device",
  );
  const [recordScreen, setRecordScreen] = useState(false);

  const createMut = useMutation({
    mutationFn: async () => {
      if (title.trim().length < 2) throw new Error("Pon un título a la sesión");
      return create({
        data: {
          title: title.trim(),
          areaKey: areaKey || undefined,
          mode,
          captureMode,
          recordScreen,
          retentionDays: 30,
        },
      });
    },
    onSuccess: () => {
      setTitle("");
      toast.success("Sesión creada");
      qc.invalidateQueries({ queryKey: ["capture-sessions"] });
    },
    onError: (e: any) => toast.error(e?.message || "No se pudo crear la sesión"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Capture</h1>
        <p className="text-muted-foreground mt-1">
          Graba retos y dinámicas, individuales o de grupo, con participantes identificados y
          consentimiento registrado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nueva sesión de grabación</CardTitle>
          <CardDescription>
            Define el tipo de sesión y cómo se graba. Podrás añadir participantes después.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cs-title">Título</Label>
              <Input
                id="cs-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Entrevista grupal — Comercial senior"
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Área</Label>
              <Select value={areaKey} onValueChange={setAreaKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un área" />
                </SelectTrigger>
                <SelectContent>
                  {(areas.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.key}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de sesión</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual (entrevista o terapia)</SelectItem>
                  <SelectItem value="group">Grupo (dinámica o sesión grupal)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Forma de grabación</Label>
              <Select value={captureMode} onValueChange={(v) => setCaptureMode(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_device">Un dispositivo para todos</SelectItem>
                  <SelectItem value="per_participant">Cada participante en su dispositivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Grabar también la pantalla</p>
              <p className="text-xs text-muted-foreground">
                Permite saber qué estaba viendo la persona en cada momento.
              </p>
            </div>
            <Switch checked={recordScreen} onCheckedChange={setRecordScreen} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Conservación: 30 días, después se elimina
              automáticamente.
            </p>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="gap-2">
              {createMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Crear sesión
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Sesiones</h2>
        {sessions.isLoading && <p className="text-muted-foreground text-sm">Cargando…</p>}
        {sessions.data?.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Todavía no has creado ninguna sesión de grabación.
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {(sessions.data ?? []).map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to="/app/capture/$id"
                    params={{ id: s.id }}
                    className="font-medium hover:underline break-words"
                  >
                    {s.title}
                  </Link>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="gap-1">
                      <Users className="h-3 w-3" />
                      {s.mode === "group" ? "Grupo" : "Individual"}
                    </Badge>
                    <Badge variant="outline">
                      {s.captureMode === "per_participant" ? "Multi-dispositivo" : "Un dispositivo"}
                    </Badge>
                    {s.recordScreen && (
                      <Badge variant="outline" className="gap-1">
                        <Video className="h-3 w-3" /> Pantalla
                      </Badge>
                    )}
                    <Badge variant="outline">{s.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Se elimina el {new Date(s.deleteAfter).toLocaleDateString("es-ES")}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Eliminar ${s.title}`}
                  onClick={async () => {
                    if (!confirm("¿Eliminar la sesión y sus grabaciones?")) return;
                    try {
                      await del({ data: { id: s.id } });
                      qc.invalidateQueries({ queryKey: ["capture-sessions"] });
                      toast.success("Sesión eliminada");
                    } catch (e: any) {
                      toast.error(e?.message || "No se pudo eliminar");
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
