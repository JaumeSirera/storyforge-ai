import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listMySimulations, deleteSimulation } from "@/lib/simulations.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Play, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/simulations/")({
  component: SimulationsList,
});

function SimulationsList() {
  const list = useServerFn(listMySimulations);
  const del = useServerFn(deleteSimulation);
  const qc = useQueryClient();
  const sims = useQuery({ queryKey: ["my-simulations"], queryFn: () => list() });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const statuses = useMemo(
    () =>
      Array.from(
        new Set<string>((sims.data ?? []).map((s: any) => String(s.status ?? "")).filter(Boolean)),
      ),
    [sims.data],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (sims.data ?? []).filter((s: any) => {
      if (
        term &&
        !`${s.title ?? ""} ${s.objective ?? ""} ${s.topic ?? ""}`.toLowerCase().includes(term)
      )
        return false;
      if (statusFilter !== "all" && String(s.status ?? "") !== statusFilter) return false;
      return true;
    });
  }, [sims.data, search, statusFilter]);

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

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, objetivo o tema"
            aria-label="Buscar simulaciones"
          />
        </div>
        {statuses.length > 1 && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44" aria-label="Filtrar por estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {statuses.map((st) => (
                <SelectItem key={st} value={st}>
                  {st}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            Ninguna simulación coincide con la búsqueda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s: any) => (
            <Card key={s.id} className="shadow-soft">
              <CardHeader>
                <CardTitle className="text-base line-clamp-2">{s.title}</CardTitle>
                <CardDescription className="line-clamp-3">{s.objective}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1 gap-1">
                  <Link to="/app/simulations/$id" params={{ id: s.id }}>
                    <Play className="h-3.5 w-3.5" /> Abrir
                  </Link>
                </Button>
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
