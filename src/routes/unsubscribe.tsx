import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MailX, CheckCircle2, AlertCircle } from "lucide-react";

type State = "loading" | "confirm" | "already" | "invalid" | "working" | "done" | "error";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [
      { title: "Baja de correos | Xandralyze" },
      {
        name: "description",
        content:
          "Gestiona tu baja de los correos de Xandralyze. Confirma en un clic y dejarás de recibir notificaciones por email.",
      },
      { property: "og:title", content: "Baja de correos | Xandralyze" },
      {
        property: "og:description",
        content: "Confirma tu baja para dejar de recibir correos de Xandralyze.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { token } = Route.useSearch();
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let active = true;
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`);
        const data = (await res.json()) as { valid?: boolean; reason?: string };
        if (!active) return;
        if (!res.ok) setState("invalid");
        else if (data.valid) setState("confirm");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const confirm = async () => {
    setState("working");
    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { success?: boolean; reason?: string };
      if (data.success) setState("done");
      else if (data.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
            {state === "done" || state === "already" ? (
              <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />
            ) : state === "invalid" || state === "error" ? (
              <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
            ) : (
              <MailX className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
          <CardTitle>Baja de correos</CardTitle>
          <CardDescription>
            {state === "loading" && "Comprobando tu enlace…"}
            {state === "confirm" &&
              "Confirma para dejar de recibir correos de Xandralyze en esta dirección."}
            {state === "working" && "Procesando tu baja…"}
            {state === "done" && "Listo: ya no recibirás más correos de Xandralyze."}
            {state === "already" && "Esta dirección ya estaba dada de baja."}
            {state === "invalid" &&
              "El enlace no es válido o ha caducado. Usa el enlace del correo más reciente."}
            {state === "error" && "No hemos podido completar la operación. Inténtalo de nuevo."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" || state === "working" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Un momento…</span>
            </div>
          ) : null}

          {state === "confirm" && (
            <Button onClick={confirm} className="w-full">
              Confirmar baja
            </Button>
          )}

          {state === "error" && (
            <Button onClick={confirm} variant="outline" className="w-full">
              Reintentar
            </Button>
          )}

          <p className="text-sm text-muted-foreground">
            Los correos de acceso y de recuperación de contraseña se seguirán enviando.
          </p>

          <Button asChild variant="ghost" className="w-full">
            <Link to="/">Volver al inicio</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
