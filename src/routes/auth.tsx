import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import logoAsset from "@/assets/logo-xandralyze.png.asset.json";
import { useOwnAuth } from "@/lib/auth-context";
import { readSession } from "@/lib/auth-session";
import { requestAccountPasswordReset } from "@/lib/accounts.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceder — Xandralyze" },
      { name: "description", content: "Inicia sesión o crea una cuenta en Xandralyze." },
    ],
  }),
  component: AuthPage,
});

function consumePostAuthRedirect(): string | null {
  try {
    const v = sessionStorage.getItem("postAuthRedirect");
    if (v) sessionStorage.removeItem("postAuthRedirect");
    return v;
  } catch {
    return null;
  }
}

function goAfterAuth(navigate: ReturnType<typeof useNavigate>) {
  const to = consumePostAuthRedirect();
  if (to) window.location.href = to;
  else navigate({ to: "/app/dashboard" });
}

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/invalid_credentials|incorrect/i.test(raw)) return "Email o contraseña incorrectos";
  if (/email_taken|duplicate|ya existe/i.test(raw)) return "Ya existe una cuenta con ese email";
  return raw || "No se ha podido completar la operación";
}

function AuthPage() {
  const navigate = useNavigate();
  const { enabled } = useOwnAuth();

  useEffect(() => {
    if (readSession()) {
      goAfterAuth(navigate);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goAfterAuth(navigate);
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-hero grid place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-bold text-lg" aria-label="Xandralyze — inicio">
          <img
            src={logoAsset.url}
            alt="Logotipo de Xandralyze"
            className="h-8 w-auto"
            width={32}
            height={32}
          />
          Xandralyze
        </Link>
        <Card className="shadow-glow">
          <CardHeader>
            <CardTitle>Bienvenido</CardTitle>
            <CardDescription>Accede para crear y jugar simulaciones.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
              </TabsList>
              <TabsContent value="signin"><SignInForm /></TabsContent>
              <TabsContent value="signup"><SignUpForm /></TabsContent>
            </Tabs>
            {!enabled && (
              <>
                <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border" /> o <div className="h-px flex-1 bg-border" />
                </div>
                <GoogleButton />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GoogleButton() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="outline"
      className="w-full"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        const pending = consumePostAuthRedirect();
        const result = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: window.location.origin + (pending ?? "/app/dashboard"),
        });
        if (result.error) {
          toast.error("No se pudo iniciar sesión con Google");
          setLoading(false);
          return;
        }
        if (result.redirected) return;
        window.location.href = pending ?? "/app/dashboard";
      }}
    >
      Continuar con Google
    </Button>
  );
}

function SignInForm() {
  const navigate = useNavigate();
  const { enabled, signIn } = useOwnAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="space-y-3 pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
          if (enabled) {
            await signIn(email, password);
          } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
          }
          goAfterAuth(navigate);
        } catch (error) {
          toast.error(errorMessage(error));
        } finally {
          setLoading(false);
        }
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Contraseña</Label>
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={async () => {
              if (!email) return toast.error("Escribe tu email para recuperar la contraseña");
              try {
                if (enabled) {
                  await requestAccountPasswordReset({ data: { email } });
                } else {
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + "/reset-password",
                  });
                  if (error) throw error;
                }
                toast.success("Te hemos enviado un email para restablecer la contraseña.");
              } catch (error) {
                toast.error(errorMessage(error));
              }
            }}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
        <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}

function SignUpForm() {
  const navigate = useNavigate();
  const { enabled, signUp } = useOwnAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="space-y-3 pt-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
          if (enabled) {
            await signUp(email, password, name);
          } else {
            const { error } = await supabase.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: window.location.origin + "/app/dashboard",
                data: { full_name: name },
              },
            });
            if (error) throw error;
          }
          toast.success("Cuenta creada.");
          goAfterAuth(navigate);
        } catch (error) {
          toast.error(errorMessage(error));
        } finally {
          setLoading(false);
        }
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-password">Contraseña</Label>
        <Input
          id="su-password"
          type="password"
          required
          minLength={enabled ? 8 : 6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {enabled && (
          <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creando..." : "Crear cuenta"}
      </Button>
    </form>
  );
}
