import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicSimulation } from "@/lib/public.functions";
import { getSimulation } from "@/lib/simulations.functions";
import { startCandidateSession } from "@/lib/candidate.functions";
import { linkCaptureGameSession } from "@/lib/integrated-report.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Play, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/play/$id")({
  component: PrePlayPage,
});

function PrePlayPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const get = useServerFn(getPublicSimulation);
  const getOwn = useServerFn(getSimulation);
  const start = useServerFn(startCandidateSession);
  const linkCapture = useServerFn(linkCaptureGameSession);
  const sim = useQuery({
    queryKey: ["play-sim", id],
    retry: false,
    queryFn: async () => {
      // La simulación puede no ser pública (borrador o privada): en ese caso
      // intentamos leerla como usuario autenticado (propietario/invitado).
      try {
        return await get({ data: { id } });
      } catch {
        return await getOwn({ data: { id } });
      }
    },
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Pre-fill from the logged-in user's profile.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) return;
      setEmail((prev) => prev || u.email || "");
      setName((prev) => prev || (u.user_metadata?.full_name as string | undefined) || "");
    })();
  }, []);

  if (sim.isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (!sim.data) return <p>Simulación no disponible.</p>;

  const s = sim.data as any;
  const candidateFields = (s.candidate_fields ?? []) as {
    key: string;
    label: string;
    required?: boolean;
  }[];

  async function onStart() {
    if (!name.trim() || !email.trim()) {
      toast.error("Introduce tu nombre y correo");
      return;
    }
    for (const f of candidateFields) {
      if (f.required && !fields[f.key]?.trim()) {
        toast.error(`Completa el campo: ${f.label}`);
        return;
      }
    }
    setBusy(true);
    try {
      const r = await start({
        data: {
          simulationId: id,
          candidateName: name.trim(),
          candidateEmail: email.trim(),
          fieldsData: fields,
        },
      });
      // Si el candidato llegó desde una grabación, vincula ambas para el informe integrado.
      try {
        const pending = localStorage.getItem("pn-pending-capture-link");
        if (pending) {
          localStorage.removeItem("pn-pending-capture-link");
          await linkCapture({ data: { captureSessionId: pending, gameSessionId: r.id } });
        }
      } catch {
        /* el vínculo es opcional: el informe integrado también se infiere por horario */
      }
      navigate({ to: "/app/sessions/$id", params: { id: r.id } });
    } catch (e: any) {
      toast.error(e.message || "No se pudo empezar la simulación");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link to="/explore/$id" params={{ id }} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{s.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">{s.objective}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Antes de empezar</CardTitle>
          <CardDescription>
            El creador de la simulación podrá ver tu resultado y enviarte un feedback personalizado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre completo *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Correo electrónico *</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
          </div>
          {candidateFields.map((f) => (
            <div key={f.key} className="grid gap-2">
              <Label htmlFor={f.key}>
                {f.label} {f.required && "*"}
              </Label>
              <Input
                id={f.key}
                value={fields[f.key] ?? ""}
                maxLength={2000}
                onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="pt-2">
            <Button onClick={onStart} disabled={busy} size="lg" className="gap-2 w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Empezar simulación
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
