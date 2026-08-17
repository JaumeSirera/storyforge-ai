import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAssessmentCollaborators,
  removeAssessmentCollaborator,
  upsertAssessmentCollaborator,
} from "@/lib/assessment-roles.functions";
import {
  COLLABORATOR_ROLES,
  COLLABORATOR_ROLE_LABELS,
  type CollaboratorRole,
} from "@/lib/assessment-roles.server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

/** Gestión de permisos por rol sobre una evaluación (solo la persona propietaria). */
export function AssessmentCollaboratorsCard({
  assessmentId,
  canManage,
}: {
  assessmentId: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listAssessmentCollaborators);
  const upsert = useServerFn(upsertAssessmentCollaborator);
  const remove = useServerFn(removeAssessmentCollaborator);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CollaboratorRole>("corrector");

  const q = useQuery({
    queryKey: ["assessment-collaborators", assessmentId],
    queryFn: () => list({ data: { assessmentId } }),
  });
  const collaborators = q.data?.collaborators ?? [];

  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: ["assessment-collaborators", assessmentId] });

  const add = useMutation({
    mutationFn: () => upsert({ data: { assessmentId, email: email.trim(), role } }),
    onSuccess: () => {
      toast.success("Permiso asignado");
      setEmail("");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo asignar el permiso"),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Permiso retirado");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo retirar el permiso"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Permisos y colaboradores</CardTitle>
        <CardDescription>
          Decide quién puede corregir con IA, editar anotaciones sobre las páginas y aprobar las
          calificaciones de las entregas de esta evaluación.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && (
          <form
            className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (!email.trim()) return;
              add.mutate();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="collab-email">Email de la persona (debe tener cuenta)</Label>
              <Input
                id="collab-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="persona@empresa.com"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="collab-role">Rol</Label>
              <select
                id="collab-role"
                value={role}
                onChange={(e) => setRole(e.target.value as CollaboratorRole)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {COLLABORATOR_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {COLLABORATOR_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Asignar
            </Button>
          </form>
        )}

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando permisos…</p>
        ) : collaborators.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no has compartido esta evaluación. Solo tú puedes corregir, anotar y aprobar.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {collaborators.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.email}</p>
                  <p className="text-xs text-muted-foreground">{COLLABORATOR_ROLE_LABELS[c.role]}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{c.role}</Badge>
                  {canManage && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Retirar permisos a ${c.email}`}
                      onClick={() => del.mutate(c.id)}
                      disabled={del.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
