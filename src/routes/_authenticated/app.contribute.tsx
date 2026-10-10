import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getMyContrib, requestCollaborator, submitProposal } from "@/lib/contrib.functions";
import { PROPOSAL_KINDS, PROPOSAL_KIND_LABELS, STATUS_LABELS, type ProposalKind } from "@/lib/contrib-shared";
import { OPEN_SOURCE } from "@/lib/features";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { GitBranch, HandHeart, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/contribute")({
  head: () => ({
    meta: [
      { title: "Colaborar — Xandralyze" },
      { name: "description", content: "Únete como colaborador al proyecto de código abierto Xandralyze y envía propuestas." },
      { property: "og:title", content: "Colaborar — Xandralyze" },
      { property: "og:description", content: "Participa en Xandralyze: propuestas revisadas y ratificadas por administración." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContributePage,
});

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "approved") return "default";
  if (s === "rejected" || s === "revoked") return "destructive";
  if (s === "changes") return "outline";
  return "secondary";
}

function ContributePage() {
  const fetchMe = useServerFn(getMyContrib);
  const q = useQuery({ queryKey: ["contrib-me"], queryFn: () => fetchMe() });
  const me = q.data;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <HandHeart className="h-6 w-6" /> Colaborar
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Xandralyze es gratuito y de código abierto ({OPEN_SOURCE.license}). Puedes proponer mejoras,
          funciones nuevas o correcciones. Toda propuesta la revisa y ratifica administración antes de
          incorporarse.
        </p>
        <a
          href={OPEN_SOURCE.repoUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <GitBranch className="h-4 w-4" /> Ver el código en GitHub
        </a>
      </div>

      {q.isLoading ? (
        <p className="text-muted-foreground text-sm">Cargando…</p>
      ) : q.error ? (
        <p className="text-destructive text-sm">{(q.error as Error).message}</p>
      ) : me?.is_collaborator ? (
        <ProposalSection />
      ) : me?.request?.status === "pending" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Solicitud en revisión</CardTitle>
            <CardDescription>
              Administración revisará tu solicitud y te avisaremos por correo.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <RequestForm previous={me?.request ?? null} />
      )}

      {me && me.proposals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mis propuestas</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {me.proposals.map((p) => (
                <li key={p.id} className="py-3 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{p.title}</span>
                    <Badge variant={statusVariant(p.status)}>{STATUS_LABELS[p.status] ?? p.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {PROPOSAL_KIND_LABELS[p.kind] ?? p.kind} · {new Date(p.created_at).toLocaleDateString("es-ES")}
                  </p>
                  {p.admin_note && (
                    <p className="text-sm rounded-md bg-muted p-2">Administración: {p.admin_note}</p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RequestForm({ previous }: { previous: { status: string; admin_note: string | null } | null }) {
  const qc = useQueryClient();
  const send = useServerFn(requestCollaborator);
  const [motivation, setMotivation] = useState("");
  const [skills, setSkills] = useState("");
  const [githubUser, setGithubUser] = useState("");
  const [consent, setConsent] = useState(false);

  const m = useMutation({
    mutationFn: () => send({ data: { motivation, skills, githubUser, consent: true } }),
    onSuccess: (data) => {
      qc.setQueryData(["contrib-me"], data);
      toast.success("Solicitud enviada. Te avisaremos por correo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Solicitar ser colaborador</CardTitle>
        <CardDescription>
          {previous && previous.status !== "pending"
            ? `Tu solicitud anterior fue ${(STATUS_LABELS[previous.status] ?? previous.status).toLowerCase()}${previous.admin_note ? `: ${previous.admin_note}` : "."} Puedes volver a solicitarlo.`
            : "Cuéntanos quién eres y cómo te gustaría ayudar."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (motivation.trim().length < 20) return toast.error("Escribe al menos 20 caracteres en el motivo.");
            if (!consent) return toast.error("Debes aceptar las condiciones.");
            m.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="motivation">¿Por qué quieres colaborar?</Label>
            <Textarea id="motivation" rows={4} value={motivation} onChange={(e) => setMotivation(e.target.value)} maxLength={2000} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="skills">¿En qué puedes ayudar? (programación, diseño, contenidos, pruebas…)</Label>
            <Input id="skills" value={skills} onChange={(e) => setSkills(e.target.value)} maxLength={500} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="github">Usuario de GitHub (opcional, para proponer cambios en el código)</Label>
            <Input id="github" value={githubUser} onChange={(e) => setGithubUser(e.target.value)} maxLength={39} />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
            <span>
              Acepto que mis aportaciones se publiquen bajo la licencia {OPEN_SOURCE.license}, que
              administración revise y decida si se incorporan, y que mi nombre y correo se usen para
              gestionar la colaboración.
            </span>
          </label>
          <Button type="submit" disabled={m.isPending}>
            {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Enviar solicitud
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProposalSection() {
  const qc = useQueryClient();
  const send = useServerFn(submitProposal);
  const [kind, setKind] = useState<ProposalKind>("mejora");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");

  const m = useMutation({
    mutationFn: () => send({ data: { kind, title, description, link } }),
    onSuccess: (data) => {
      qc.setQueryData(["contrib-me"], data);
      setTitle("");
      setDescription("");
      setLink("");
      toast.success("Propuesta enviada para su revisión.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nueva propuesta</CardTitle>
        <CardDescription>
          Eres colaborador. Describe tu idea; si es un cambio en el código, abre una solicitud de cambio
          (pull request) en GitHub y pega aquí su enlace. Nada se aplica sin la aprobación de administración.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="kind">Tipo</Label>
            <select
              id="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as ProposalKind)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {PROPOSAL_KINDS.map((k) => (
                <option key={k} value={k}>{PROPOSAL_KIND_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="title">Título</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required minLength={5} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="desc">Descripción</Label>
            <Textarea id="desc" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={8000} required minLength={20} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="link">Enlace (opcional, p. ej. la solicitud de cambio en GitHub)</Label>
            <Input id="link" type="url" placeholder="https://github.com/…" value={link} onChange={(e) => setLink(e.target.value)} maxLength={500} />
          </div>
          <Button type="submit" disabled={m.isPending}>
            {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Enviar propuesta
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
