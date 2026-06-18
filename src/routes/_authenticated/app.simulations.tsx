import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMySimulations, deleteSimulation } from "@/lib/simulations.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Play } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/simulations")({
  component: SimulationsList,
});

function SimulationsList() {
  const list = useServerFn(listMySimulations);
  const del = useServerFn(deleteSimulation);
  const qc = useQueryClient();
  const sims = useQuery({ queryKey: ["my-simulations"], queryFn: () => list() });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mis simulaciones</h1>
          <p className="text-muted-foreground mt-1">Gestiona, juega y comparte tus simulaciones.</p>
        </div>
        <Link to="/app/new">
          <Button className="gap-2"><Plus className="h-4 w-4" /> Nueva</Button>
        </Link>
      </div>

      {sims.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (sims.data?.length ?? 0) === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">No tienes simulaciones todavía.</p>
            <Link to="/app/new" className="inline-block mt-4">
              <Button><Plus className="h-4 w-4 mr-2" /> Crear la primera</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sims.data!.map((s: any) => (
            <Card key={s.id} className="shadow-soft">
              <CardHeader>
                <CardTitle className="text-base line-clamp-2">{s.title}</CardTitle>
                <CardDescription className="line-clamp-3">{s.objective}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-2">
                <Link to="/app/simulations/$id" params={{ id: s.id }} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full gap-1">
                    <Play className="h-3.5 w-3.5" /> Abrir
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    if (!confirm("¿Eliminar esta simulación?")) return;
                    await del({ data: { id: s.id } });
                    toast.success("Simulación eliminada");
                    qc.invalidateQueries({ queryKey: ["my-simulations"] });
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
