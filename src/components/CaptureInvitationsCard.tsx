import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCaptureInvitations,
  createCaptureInvitation,
  revokeCaptureInvitation,
  deleteCaptureInvitation,
} from "@/lib/capture-invitations.functions";
import type { CaptureParticipant } from "@/lib/capture.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Link2, Loader2, Trash2, Ban } from "lucide-react";
import { toast } from "sonner";

export function CaptureInvitationsCard({
  captureSessionId,
  participants,
}: {
  captureSessionId: string;
  participants: CaptureParticipant[];
}) {
  const qc = useQueryClient();
  const list = useServerFn(listCaptureInvitations);
  const create = useServerFn(createCaptureInvitation);
  const revoke = useServerFn(revokeCaptureInvitation);
  const remove = useServerFn(deleteCaptureInvitation);

  const [participantId, setParticipantId] = useState<string>("any");
  const [note, setNote] = useState("");
  const [days, setDays] = useState("7");

  const invites = useQuery({
    queryKey: ["capture-invitations", captureSessionId],
    queryFn: () => list({ data: { captureSessionId } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["capture-invitations", captureSessionId] });

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          captureSessionId,
          participantId: participantId === "any" ? null : participantId,
          note: note.trim() || undefined,
          expiresInDays: Number(days) || 7,
        },
      }),
    onSuccess: () => {
      setNote("");
      toast.success("Invitación creada");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message || "No se pudo crear la invitación"),
  });

  function linkFor(token: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/capture/join/${token}`;
  }

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(linkFor(token));
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4" /> Invitaciones de participantes
        </CardTitle>
        <CardDescription>
          Envía un enlace a cada participante. Deberá iniciar sesión con su cuenta, aceptar el
          consentimiento y entonces podrá entrar en el mosaico, grabarse y jugar la simulación a su
          propio ritmo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Asignar a participante</Label>
            <Select value={participantId} onValueChange={setParticipantId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Cualquiera (se crea al unirse)</SelectItem>
                {participants.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-note">Nota</Label>
            <Input
              id="inv-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-days">Caduca (días)</Label>
            <Input
              id="inv-days"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>
        </div>

        <Button onClick={() => createMut.mutate()} disabled={createMut.isPending} className="gap-2">
          {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Crear enlace de invitación
        </Button>

        <div className="space-y-2">
          {invites.isLoading && <p className="text-sm text-muted-foreground">Cargando invitaciones…</p>}
          {invites.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">Todavía no has creado invitaciones.</p>
          )}
          {(invites.data ?? []).map((inv: any) => {
            const expired = inv.expires_at && new Date(inv.expires_at).getTime() < Date.now();
            const assigned = participants.find((p) => p.id === inv.participant_id);
            return (
              <div
                key={inv.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs">{linkFor(inv.token)}</p>
                  <p className="text-xs text-muted-foreground">
                    {assigned ? `Para ${assigned.name}` : "Abierta"}
                    {inv.note ? ` · ${inv.note}` : ""}
                    {inv.expires_at
                      ? ` · caduca ${new Date(inv.expires_at).toLocaleDateString("es-ES")}`
                      : ""}
                    {` · usos: ${inv.uses_count ?? 0}`}
                  </p>
                </div>
                {inv.revoked_at ? (
                  <Badge variant="secondary">Revocada</Badge>
                ) : expired ? (
                  <Badge variant="secondary">Caducada</Badge>
                ) : (
                  <Badge>Activa</Badge>
                )}
                <Button size="sm" variant="outline" className="gap-1" onClick={() => copy(inv.token)}>
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
                {!inv.revoked_at && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={async () => {
                      await revoke({ data: { id: inv.id } });
                      refresh();
                    }}
                  >
                    <Ban className="h-3.5 w-3.5" /> Revocar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await remove({ data: { id: inv.id } });
                    refresh();
                  }}
                  aria-label="Eliminar invitación"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
