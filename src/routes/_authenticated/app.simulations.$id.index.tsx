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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Play, ArrowLeft, GitBranch, HelpCircle, Loader2, Pencil, CheckCircle2, Lock, ClipboardCheck, Users, Share2, Link2, Copy, Trash2, Ban, Video, Plus, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/simulations/$id/")({
  component: SimulationDetail,
});

function SimulationDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const get = useServerFn(getSimulation);
  const start = useServerFn(startSession);
  const sim = useQuery({ queryKey: ["sim", id], queryFn: () => get({ data: { id } }) });
  const [starting, setStarting] = useState(false);

  if (sim.isLoading) return <p className="text-muted-foreground">Cargando...</p>;
  if (!sim.data) return <p>No encontrada.</p>;

  const story = (sim.data.story ?? {}) as { nodes?: Record<string, any>; startNodeId?: string; orderMode?: "title" | "manual" };
  const sceneOrder = computeSceneOrder({ startNodeId: story.startNodeId ?? "", orderMode: story.orderMode, nodes: story.nodes ?? {} });
  const orderedNodes = sortNodesByOrder(Object.values(story.nodes ?? {}), sceneOrder);
  const nodeCount = Object.keys(story.nodes ?? {}).length;
  const questionCount = Object.values(story.nodes ?? {}).filter((n: any) => n.question).length;
  const criteria = (sim.data.evaluation_criteria ?? []) as any[];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
          {sim.data.status === "published" && (
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
          <div className="flex gap-2 flex-wrap">
            <Button asChild size="lg" variant="outline" className="gap-2">
              <Link to="/app/simulations/$id/edit" params={{ id }}>
                <Pencil className="h-4 w-4" /> Editar
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2">
              <Link to="/app/simulations/$id/review" params={{ id }}>
                <ClipboardCheck className="h-4 w-4" /> Revisión
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2">
              <Link to="/app/simulations/$id/sessions" params={{ id }}>
                <Users className="h-4 w-4" /> Candidatos
              </Link>
            </Button>
            {sim.data.is_public && sim.data.status === "published" && (
              <Button asChild size="lg" variant="outline" className="gap-2">
                <Link to="/explore/$id" params={{ id }}>
                  <Share2 className="h-4 w-4" /> Página pública
                </Link>
              </Button>
            )}

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
          </div>
        </CardContent>
      </Card>

      <CapturesCard simulationId={id} simulationTitle={sim.data.title} />

      <InvitationsCard simulationId={id} published={sim.data.status === "published"} />



      <Card>
        <CardHeader>
          <CardTitle>Criterios de evaluación</CardTitle>
          <CardDescription>Competencias que mediremos a lo largo del juego.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {criteria.map((c: any) => (
            <div key={c.key} className="rounded-lg border border-border p-3">
              <div className="font-medium">{c.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.description}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Escenas</CardTitle>
          <CardDescription>Vista del árbol de decisiones generado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
        </CardContent>
      </Card>
    </div>
  );
}

function InvitationsCard({ simulationId, published }: { simulationId: string; published: boolean }) {
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Link2 className="h-4 w-4" /> Invitaciones privadas</CardTitle>
        <CardDescription>
          Comparte enlaces privados con expiración para que candidatos jueguen sin publicar la simulación en la galería pública.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  );
}

function CapturesCard({ simulationId, simulationTitle }: { simulationId: string; simulationTitle: string }) {
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
        data: { title: `Captura · ${simulationTitle}`, simulationId },
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Video className="h-4 w-4" /> Capturas de esta simulación</CardTitle>
        <CardDescription>
          Sesiones de grabación asociadas. Al invitar a un candidato e iniciar la grabación, la simulación se abre automáticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={onCreate} disabled={creating} className="gap-2">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Nueva captura
        </Button>

        <div className="divide-y divide-border rounded-lg border border-border">
          {q.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
          ) : (q.data?.length ?? 0) === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aún no hay capturas para esta simulación.</p>
          ) : (
            q.data!.map((c) => (
              <Link
                key={c.id}
                to="/app/capture/$id"
                params={{ id: c.id }}
                className="flex items-center justify-between gap-3 p-3 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(c.createdAt).toLocaleString()} ·{" "}
                    {c.mode === "group" ? "Grupal" : "Individual"} ·{" "}
                    {c.captureMode === "per_participant" ? "Un dispositivo por participante" : "Un dispositivo"}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary">{c.status}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
