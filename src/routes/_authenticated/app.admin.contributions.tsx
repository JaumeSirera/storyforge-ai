import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminDecideContrib, adminListContrib } from "@/lib/contrib.functions";
import { PROPOSAL_KIND_LABELS, STATUS_LABELS, type ContribProposal, type ContribRequest } from "@/lib/contrib-shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/admin/contributions")({
  component: AdminContributionsPage,
});

type Decision = "approved" | "rejected" | "revoked" | "changes";

function AdminContributionsPage() {
  const list = useServerFn(adminListContrib);
  const q = useQuery({ queryKey: ["admin-contrib"], queryFn: () => list() });

  if (q.isLoading) return <div className="text-muted-foreground">Cargando…</div>;
  if (q.error) return <div className="text-destructive text-sm">{(q.error as Error).message}</div>;
  const requests = q.data?.requests ?? [];
  const proposals = q.data?.proposals ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Solicitudes de colaborador ({requests.filter((r) => r.status === "pending").length} pendientes)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.length === 0 && <p className="text-sm text-muted-foreground">Sin solicitudes todavía.</p>}
          {requests.map((r) => <RequestItem key={r.id} r={r} />)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Propuestas ({proposals.filter((p) => p.status === "pending").length} pendientes)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {proposals.length === 0 && <p className="text-sm text-muted-foreground">Sin propuestas todavía.</p>}
          {proposals.map((p) => <ProposalItem key={p.id} p={p} />)}
        </CardContent>
      </Card>
    </div>
  );
}

function useDecide(type: "request" | "proposal", id: string) {
  const qc = useQueryClient();
  const decide = useServerFn(adminDecideContrib);
  return useMutation({
    mutationFn: (v: { decision: Decision; note: string }) => decide({ data: { type, id, ...v } }),
    onSuccess: (data) => {
      qc.setQueryData(["admin-contrib"], data);
      toast.success("Decisión guardada y notificada por correo");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function Actions({ type, id, options }: { type: "request" | "proposal"; id: string; options: Array<[Decision, string]> }) {
  const [note, setNote] = useState("");
  const m = useDecide(type, id);
  return (
    <div className="space-y-2">
      <Textarea rows={2} placeholder="Comentario para la persona (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {options.map(([d, label]) => (
          <Button key={d} size="sm" variant={d === "approved" ? "default" : "outline"} disabled={m.isPending} onClick={() => m.mutate({ decision: d, note })}>
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Head({ title, status, sub }: { title: string; status: string; sub: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <Badge variant={status === "pending" ? "secondary" : status === "approved" ? "default" : "outline"}>
        {STATUS_LABELS[status] ?? status}
      </Badge>
    </div>
  );
}

function RequestItem({ r }: { r: ContribRequest }) {
  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <Head
        title={`${r.full_name || r.email} · ${r.email}`}
        status={r.status}
        sub={`GitHub: ${r.github_user || "—"} · ${new Date(r.created_at).toLocaleDateString("es-ES")}`}
      />
      <p className="text-sm whitespace-pre-wrap">{r.motivation}</p>
      {r.skills && <p className="text-sm text-muted-foreground">Habilidades: {r.skills}</p>}
      {r.admin_note && <p className="text-xs text-muted-foreground">Nota: {r.admin_note}</p>}
      <Actions
        type="request"
        id={r.id}
        options={r.status === "approved" ? [["revoked", "Retirar el rol"]] : [["approved", "Aprobar"], ["rejected", "Rechazar"]]}
      />
    </div>
  );
}

function ProposalItem({ p }: { p: ContribProposal }) {
  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <Head title={p.title} status={p.status} sub={`${PROPOSAL_KIND_LABELS[p.kind] ?? p.kind} · ${p.email} · ${new Date(p.created_at).toLocaleDateString("es-ES")}`} />
      <p className="text-sm whitespace-pre-wrap">{p.description}</p>
      {p.link && (
        <a href={p.link} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline break-all">{p.link}</a>
      )}
      {p.admin_note && <p className="text-xs text-muted-foreground">Nota: {p.admin_note}</p>}
      <Actions type="proposal" id={p.id} options={[["approved", "Ratificar"], ["changes", "Pedir cambios"], ["rejected", "Rechazar"]]} />
    </div>
  );
}
