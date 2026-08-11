import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSimulation } from "@/lib/simulations.functions";
import { startSession } from "@/lib/sessions.functions";
import {
  listInvitations,
  createInvitation,
  revokeInvitation,
  deleteInvitation,
} from "@/lib/invitations.functions";
import { listCaptureSessionsBySimulation, createCaptureSession } from "@/lib/capture.functions";
import { computeSceneOrder, sortNodesByOrder } from "@/lib/scene-order";
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
import {
  Play,
  ArrowLeft,
  GitBranch,
  HelpCircle,
  Loader2,
  Pencil,
  CheckCircle2,
  Lock,
  ClipboardCheck,
  Users,
  Share2,
  Link2,
  Copy,
  Trash2,
  Ban,
  Video,
  Plus,
  ChevronRight,
  ListChecks,
  Eye,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/simulations/$id/")({
  component: SimulationDetail,
});

type SectionKey = "criteria" | "scenes" | "captures" | "invites";

function SimulationDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const get = useServerFn(getSimulation);
  const start = useServerFn(startSession);
  const sim = useQuery({ queryKey: ["sim", id], queryFn: () => get({ data: { id } }) });
  const [starting, setStarting] = useState(false);
  const [open, setOpen] = useState<SectionKey | null>(null);

  if (sim.isLoading) return <p className="text-muted-foreground">Cargando...</p>;
  if (!sim.data) return <p>No encontrada.</p>;

  const story = (sim.data.story ?? {}) as { nodes?: Record<string, any>; startNodeId?: string; orderMode?: "title" | "manual" };
  const sceneOrder = computeSceneOrder({ startNodeId: story.startNodeId ?? "", orderMode: story.orderMode, nodes: story.nodes ?? {} });
  const orderedNodes = sortNodesByOrder(Object.values(story.nodes ?? {}), sceneOrder);
  const nodeCount = Object.keys(story.nodes ?? {}).length;
  const questionCount = Object.values(story.nodes ?? {}).filter((n: any) => n.question).length;
  const criteria = (sim.data.evaluation_criteria ?? []) as any[];
  const published = sim.data.status === "published";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link to="/app/simulations" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{sim.data.title}</h1>
        <p className="text-muted-foreground mt-1">{sim.data.objective}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {sim.data.topic && <Badge variant="secondary">{sim.data.topic}</Badge>}
          <Badge variant="outline">{sim.data.duration_min} min</Badge>
          <Badge variant="outline" className="gap-1"><GitBranch className="h-3 w-3" /> {nodeCount} escenas</Badge>
          <Badge variant="outline" className="gap-1"><HelpCircle className="h-3 w-3" /> {questionCount} preguntas</Badge>
          {published && (
            <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Publicada</Badge>
          )}
          {sim.data.status === "in_review" && (
            <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> En revisión</Badge>
          )}
        </div>
      </div>

      <Card className="shadow-glow">
        <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">¿Listo para jugar?</h2>
            <p className="text-sm text-muted-foreground">Tomarás decisiones y al final recibirás tu informe.</p>
          </div>
          <Button
            size="lg"
            disabled={starting}
            onClick={async () => {
              setStarting(true);
              try {
                const r = await start({ data: { simulationId: id } });
                navigate({ to: "/app/sessions/$id", params: { id: r.id } });
              } finally { setStarting(false); }
            }}
            className="gap-2"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Empezar simulación
          </Button>
        </CardContent>
      </Card>

      {/* Hub de secciones */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SectionCard
          icon={Pencil}
          title="Editar simulación"
          summary="Historia, escenas, preguntas y vídeos"
          to="/app/simulations/$id/edit"
          params={{ id }}
        />
        <SectionCard
          icon={ClipboardCheck}
          title="Revisión"
          summary="Revisa y publica la simulación"
          to="/app/simulations/$id/review"
          params={{ id }}
        />
        <SectionCard
          icon={Users}
          title="Candidatos"
          summary="Sesiones jugadas, resultados e informes"
          to="/app/simulations/$id/sessions"
          params={{ id }}
        />
        {sim.data.is_public && published && (
          <SectionCard
            icon={Share2}
            title="Página pública"
            summary="Ficha visible en la galería pública"
            to="/explore/$id"
            params={{ id }}
          />
        )}
        <SectionCard
          icon={Video}
          title="Grabaciones de esta simulación"
          summary="Sesiones de grabación asociadas: ver o editar"
          onClick={() => setOpen("captures")}
        />
        <SectionCard
          icon={Link2}
          title="Invitaciones privadas"
          summary="Enlaces con caducidad para candidatos"
          onClick={() => setOpen("invites")}
        />
        <SectionCard
          icon={ListChecks}
          title="Criterios de evaluación"
          summary={
            criteria.length === 0
              ? "Sin criterios definidos"
              : `${criteria.length} competencias: ${criteria.map((c: any) => c.label).slice(0, 3).join(", ")}`
          }
          onClick={() => setOpen("criteria")}
        />
        <SectionCard
          icon={GitBranch}
          title="Escenas"
          summary={`${nodeCount} escenas · ${questionCount} preguntas · árbol de decisiones`}
          onClick={() => setOpen("scenes")}
        />
      </div>

      <Dialog open={open === "captures"} onOpenChange={(v) => setOpen(v ? "captures" : null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Video className="h-4 w-4" /> Grabaciones de esta simulación</DialogTitle>
            <DialogDescription>
              Sesiones de grabación asociadas. Al invitar a un candidato e iniciar la grabación, la simulación se abre automáticamente.
            </DialogDescription>
          </DialogHeader>
          <CapturesSection simulationId={id} simulationTitle={sim.data.title} />
        </DialogContent>
      </Dialog>

      <Dialog open={open === "invites"} onOpenChange={(v) => setOpen(v ? "invites" : null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link2 className="h-4 w-4" /> Invitaciones privadas</DialogTitle>
            <DialogDescription>
              Comparte enlaces privados con expiración para que candidatos jueguen sin publicar la simulación en la galería pública.
            </DialogDescription>
          </DialogHeader>
          <InvitationsSection simulationId={id} published={published} />
        </DialogContent>
      </Dialog>

      <Dialog open={open === "criteria"} onOpenChange={(v) => setOpen(v ? "criteria" : null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criterios de evaluación</DialogTitle>
            <DialogDescription>Competencias que mediremos a lo largo del juego.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {criteria.map((c: any) => (
              <div key={c.key} className="rounded-lg border border-border p-3">
                <div className="font-medium">{c.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.description}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "scenes"} onOpenChange={(v) => setOpen(v ? "scenes" : null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Escenas</DialogTitle>
            <DialogDescription>Vista del árbol de decisiones generado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {orderedNodes.map((n: any) => (
              <div key={n.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{n.title}</div>
                  {n.isEnding && (
                    <Badge variant={n.endingType === "success" ? "default" : "secondary"}>
                      Final {n.endingType ?? ""}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.narrative}</p>
                {[
                  ...(n.question ? [n.question] : []),
                  ...(Array.isArray(n.questions) ? n.questions : []),
                ].map((q: any, qi: number) => (
                  <div key={q.id ?? qi} className="mt-2 text-xs">
                    <span className="font-medium">P{qi + 1}:</span> {q.text}
                    <ul className="mt-1 ml-4 list-disc text-muted-foreground">
                      {q.choices.map((c: any) => (
                        <li key={c.id}>
                          {c.label} <span className="opacity-70">({c.points >= 0 ? "+" : ""}{c.points} pts → {c.next ?? "FIN"})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
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
  to,
  params,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  summary: string;
  onClick?: () => void;
  to?: string;
  params?: Record<string, string>;
}) {
  const inner = (
    <>
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
    </>
  );

  return (
    <Card className="transition-colors hover:border-primary/50">
      {to ? (
        <Link
          to={to as any}
          params={params as any}
          className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
        >
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
        >
          {inner}
        </button>
      )}
    </Card>
  );
}

function InvitationsSection({ simulationId, published }: { simulationId: string; published: boolean }) {
  const qc = useQueryClient();
  const list = useServerFn(listInvitations);
  const create = useServerFn(createInvitation);
  const revoke = useServerFn(revokeInvitation);
  const remove = useServerFn(deleteInvitation);

  const q = useQuery({
    queryKey: ["invitations", simulationId],
    queryFn: () => list({ data: { simulationId } }),
  });

  const [note, setNote] = useState("");
  const [days, setDays] = useState<string>("14");
  const [maxUses, setMaxUses] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function onCreate() {
    setBusy(true);
    try {
      await create({
        data: {
          simulationId,
          note: note.trim() || undefined,
          expiresInDays: days ? Number(days) : undefined,
          maxUses: maxUses ? Number(maxUses) : undefined,
        },
      });
      setNote("");
      qc.invalidateQueries({ queryKey: ["invitations", simulationId] });
      toast.success("Invitación creada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {!published && (
        <p className="text-sm text-muted-foreground">
          Debes publicar la simulación para poder generar invitaciones válidas.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Label>Nota (opcional)</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Candidatos ronda 1" />
        </div>
        <div>
          <Label>Caduca en (días)</Label>
          <Input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />
        </div>
        <div>
          <Label>Máx. usos</Label>
          <Input type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="ilimitado" />
        </div>
      </div>
      <Button onClick={onCreate} disabled={busy || !published} className="gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
        Generar enlace
      </Button>

      <div className="divide-y divide-border rounded-lg border border-border">
        {q.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
        ) : (q.data?.length ?? 0) === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Aún no hay invitaciones.</p>
        ) : (
          q.data!.map((inv: any) => {
            const url = `${origin}/invite/${inv.token}`;
            const expired = inv.expires_at && new Date(inv.expires_at).getTime() < Date.now();
            const exhausted = inv.max_uses != null && inv.uses_count >= inv.max_uses;
            const active = !inv.revoked_at && !expired && !exhausted;
            return (
              <div key={inv.id} className="p-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[420px]">{url}</code>
                    {active ? (
                      <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Activo</Badge>
                    ) : (
                      <Badge variant="secondary">
                        {inv.revoked_at ? "Revocado" : expired ? "Caducado" : "Agotado"}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {inv.note ? <>· {inv.note} </> : null}
                    · Usos: {inv.uses_count}{inv.max_uses ? ` / ${inv.max_uses}` : ""}
                    {inv.expires_at ? <> · Caduca {new Date(inv.expires_at).toLocaleDateString()}</> : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={async () => {
                      await navigator.clipboard.writeText(url);
                      toast.success("Enlace copiado");
                    }}
                  >
                    <Copy className="h-3 w-3" /> Copiar
                  </Button>
                  {active && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={async () => {
                        await revoke({ data: { id: inv.id } });
                        qc.invalidateQueries({ queryKey: ["invitations", simulationId] });
                      }}
                    >
                      <Ban className="h-3 w-3" /> Revocar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-destructive"
                    onClick={async () => {
                      await remove({ data: { id: inv.id } });
                      qc.invalidateQueries({ queryKey: ["invitations", simulationId] });
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function CapturesSection({ simulationId, simulationTitle }: { simulationId: string; simulationTitle: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useServerFn(listCaptureSessionsBySimulation);
  const create = useServerFn(createCaptureSession);
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["sim-captures", simulationId],
    queryFn: () => list({ data: { simulationId } }),
  });

  async function onCreate() {
    setCreating(true);
    try {
      const r = await create({
        data: { title: `Grabación · ${simulationTitle}`, simulationId },
      });
      qc.invalidateQueries({ queryKey: ["sim-captures", simulationId] });
      navigate({ to: "/app/capture/$id", params: { id: r.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button onClick={onCreate} disabled={creating} className="gap-2">
        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Nueva grabación
      </Button>

      <div className="divide-y divide-border rounded-lg border border-border">
        {q.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
        ) : (q.data?.length ?? 0) === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Aún no hay grabaciones para esta simulación.</p>
        ) : (
          q.data!.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{c.title}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(c.createdAt).toLocaleString()} ·{" "}
                  {c.mode === "group" ? "Grupal" : "Individual"} ·{" "}
                  {c.captureMode === "per_participant" ? "Un dispositivo por participante" : "Un dispositivo"}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button asChild size="sm" variant="outline" className="gap-1">
                  <Link to="/app/capture/$id" params={{ id: c.id }}>
                    <Eye className="h-3 w-3" /> Ver
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="gap-1">
                  <Link to="/app/capture/$id" params={{ id: c.id }} search={{ edit: "config" }}>
                    <Pencil className="h-3 w-3" /> Editar
                  </Link>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
