import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  addAssessmentCandidates,
  deleteAssessmentCandidate,
  listAssessmentCandidates,
  updateAssessmentCandidate,
} from "@/lib/assessment-candidates.functions";
import {
  CANDIDATE_STATUS_LABELS,
  examUrl,
  type AssessmentCandidate,
} from "@/lib/assessment-candidates-shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCopy,
  ExternalLink,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

interface CandidateSubmissionInfo {
  id: string;
  status?: string | null;
  score?: number | null;
  maxScore?: number | null;
}

interface Props {
  assessmentId: string;
  /** Solo el propietario puede inscribir o dar de baja aspirantes. */
  canManage: boolean;
  /** Entregas de la evaluación, para mostrar la nota de cada aspirante. */
  submissions?: CandidateSubmissionInfo[];
}

/** Convierte texto pegado (una línea por aspirante) en candidatos. */
function parseBulk(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[;,\t]/).map((p) => p.trim());
      const name = parts[0] ?? "";
      const email = parts.find((p) => p.includes("@")) ?? null;
      const identifier = parts.slice(1).find((p) => p && !p.includes("@")) ?? null;
      return { name, email, identifier };
    })
    .filter((c) => c.name);
}

export function AssessmentCandidatesCard({ assessmentId, canManage }: Props) {
  const qc = useQueryClient();
  const list = useServerFn(listAssessmentCandidates);
  const add = useServerFn(addAssessmentCandidates);
  const update = useServerFn(updateAssessmentCandidate);
  const remove = useServerFn(deleteAssessmentCandidate);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [bulk, setBulk] = useState("");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["assessment-candidates", assessmentId],
    queryFn: () => list({ data: { assessmentId } }),
  });
  const candidates: AssessmentCandidate[] = q.data?.candidates ?? [];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return candidates;
    return candidates.filter((c) =>
      [c.name, c.email ?? "", c.identifier ?? ""].join(" ").toLowerCase().includes(term),
    );
  }, [candidates, search]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["assessment-candidates", assessmentId] });

  const addMut = useMutation({
    mutationFn: (payload: { name: string; email: string | null; identifier: string | null }[]) =>
      add({ data: { assessmentId, candidates: payload } }),
    onSuccess: (res) => {
      toast.success(`${res.candidates.length} aspirante(s) inscrito(s)`);
      setName("");
      setEmail("");
      setIdentifier("");
      setBulk("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (payload: { id: string; regenerateToken?: boolean; reset?: boolean }) =>
      update({ data: payload }),
    onSuccess: () => {
      toast.success("Aspirante actualizado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Aspirante dado de baja");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyLink = async (c: AssessmentCandidate) => {
    const url = examUrl(c.token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace del examen copiado");
    } catch {
      toast.error(url);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" aria-hidden="true" />
          Aspirantes inscritos
        </CardTitle>
        <CardDescription>
          Da de alta a los candidatos que deben realizar la prueba. Cada uno recibe un enlace privado
          para hacer el examen en pantalla, sin necesidad de crear cuenta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {canManage && (
          <div className="space-y-4 rounded-lg border border-border/60 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="cand-name">Nombre y apellidos</Label>
                <Input
                  id="cand-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ana García"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cand-email">Email (opcional)</Label>
                <Input
                  id="cand-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ana@empresa.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cand-id">DNI / referencia (opcional)</Label>
                <Input
                  id="cand-id"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="12345678A"
                />
              </div>
            </div>
            <Button
              onClick={() =>
                addMut.mutate([
                  { name, email: email.trim() || null, identifier: identifier.trim() || null },
                ])
              }
              disabled={!name.trim() || addMut.isPending}
            >
              {addMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Inscribir aspirante
            </Button>

            <div className="space-y-1.5 border-t border-border/60 pt-4">
              <Label htmlFor="cand-bulk">Alta masiva (una línea por aspirante)</Label>
              <Textarea
                id="cand-bulk"
                rows={4}
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                placeholder={"Ana García; ana@empresa.com; 12345678A\nLuis Pérez; luis@empresa.com"}
              />
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  const parsed = parseBulk(bulk);
                  if (parsed.length === 0) {
                    toast.error("No se ha reconocido ningún aspirante.");
                    return;
                  }
                  addMut.mutate(parsed);
                }}
                disabled={!bulk.trim() || addMut.isPending}
              >
                Inscribir lista
              </Button>
            </div>
          </div>
        )}

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o documento"
            aria-label="Buscar aspirantes"
          />
        </div>

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando aspirantes…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay aspirantes inscritos en esta evaluación.
          </p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-3 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[c.email, c.identifier].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                  </p>
                  <Badge variant={c.status === "submitted" ? "default" : "secondary"}>
                    {CANDIDATE_STATUS_LABELS[c.status]}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyLink(c)}>
                    <ClipboardCopy className="mr-2 h-4 w-4" aria-hidden="true" />
                    Copiar enlace
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={examUrl(c.token)} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                      Abrir examen
                    </a>
                  </Button>
                  {canManage && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateMut.mutate({ id: c.id, reset: true, regenerateToken: true })}
                        disabled={updateMut.isPending}
                        title="Reiniciar intento y generar un enlace nuevo"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                        Reiniciar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => delMut.mutate(c.id)}
                        disabled={delMut.isPending}
                        aria-label={`Dar de baja a ${c.name}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
