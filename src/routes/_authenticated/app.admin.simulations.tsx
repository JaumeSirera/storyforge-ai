import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminListAllSimulations } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/admin/simulations")({
  component: AdminSimulationsPage,
});

function AdminSimulationsPage() {
  const list = useServerFn(adminListAllSimulations);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-simulations"],
    queryFn: () => list(),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Todas las simulaciones</h2>
      {isLoading ? (
        <div className="text-muted-foreground">Cargando…</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Título</th>
                    <th className="px-3 py-2">Propietario</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Actualizada</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.simulations ?? []).map((s: any) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="font-medium">{s.title}</div>
                        <div className="text-xs text-muted-foreground">{s.topic ?? "—"}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{s.owner?.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{s.owner?.email ?? s.owner_id}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={s.is_public ? "default" : "secondary"}>{s.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(s.updated_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          to="/app/simulations/$id/edit"
                          params={{ id: s.id }}
                          className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                        >
                          <Pencil className="h-4 w-4" /> Editar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
