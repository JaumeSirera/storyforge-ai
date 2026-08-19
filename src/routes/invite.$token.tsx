import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { validateInvitation, startInvitedSession } from "@/lib/invitations.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Play, ShieldCheck, LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [
      { title: "Invitación privada · Xandralyze" },
      { name: "description", content: "Accede a una simulación gamificada por invitación privada." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const validate = useServerFn(validateInvitation);
  const start = useServerFn(startInvitedSession);

  const q = useQuery({
    queryKey: ["invite", token],
    queryFn: () => validate({ data: { token } }),
    retry: false,
  });

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      setAuthed(!!u);
      if (u) {
        setEmail((p) => p || u.email || "");
        setName((p) => p || (u.user_metadata?.full_name as string | undefined) || "");
      }
    })();
  }, []);

  if (q.isLoading || authed === null) {
    return <div className="max-w-lg mx-auto p-8 text-muted-foreground">Cargando invitación…</div>;
  }
  if (q.error) {
    return (
      <div className="max-w-lg mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>Enlace no válido</CardTitle>
            <CardDescription>{(q.error as Error).message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/">Volver al inicio</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sim = (q.data as any).simulation;
  const candidateFields = (sim.candidate_fields ?? []) as {
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
          token,
          candidateName: name.trim(),
          candidateEmail: email.trim(),
          fieldsData: fields,
        },
      });
      navigate({ to: "/app/sessions/$id", params: { id: r.id } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4" /> Acceso por invitación privada
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{sim.title}</CardTitle>
          <CardDescription>{sim.objective}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!authed ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Necesitas una cuenta para jugar y que se guarde tu progreso.
              </p>
              <Button
                onClick={() => {
                  try { sessionStorage.setItem("postAuthRedirect", `/invite/${token}`); } catch {}
                  navigate({ to: "/auth" });
                }}
                className="gap-2"
              >
                <LogIn className="h-4 w-4" /> Iniciar sesión / Crear cuenta
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Nombre</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              {candidateFields.map((f) => (
                <div key={f.key}>
                  <Label>
                    {f.label} {f.required && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    value={fields[f.key] ?? ""}
                    onChange={(e) => setFields((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
              <Button size="lg" onClick={onStart} disabled={busy} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Empezar simulación
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
