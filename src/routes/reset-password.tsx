import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { resetAccountPassword } from "@/lib/accounts.functions";
import { storeSession } from "@/lib/auth-session";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Restablecer contraseña — Xandralyze" },
      { name: "description", content: "Elige una nueva contraseña para tu cuenta." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkToken = params.get("token");
    if (linkToken) {
      setToken(linkToken);
      setIsNew(params.get("nuevo") === "1");
      setReady(true);
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const minLength = token ? 8 : 6;

  return (
    <div className="min-h-screen bg-hero grid place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-bold text-lg">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          Xandralyze
        </Link>
        <Card className="shadow-glow">
          <CardHeader>
            <CardTitle>{isNew ? "Crea tu contraseña" : "Nueva contraseña"}</CardTitle>
            <CardDescription>
              {ready
                ? `Escribe tu ${isNew ? "" : "nueva "}contraseña (mínimo ${minLength} caracteres).`
                : "Abre el enlace desde el email de recuperación para continuar."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (password.length < minLength) return toast.error(`Mínimo ${minLength} caracteres`);
                if (password !== confirm) return toast.error("Las contraseñas no coinciden");
                setLoading(true);
                try {
                  if (token) {
                    storeSession(await resetAccountPassword({ data: { token, password } }));
                  } else {
                    const { error } = await supabase.auth.updateUser({ password });
                    if (error) throw error;
                  }
                  toast.success("Contraseña guardada");
                  navigate({ to: "/app/dashboard" });
                } catch (error) {
                  const raw = error instanceof Error ? error.message : String(error);
                  toast.error(
                    /token|expired|caduc/i.test(raw)
                      ? "El enlace ya no es válido. Pide uno nuevo desde «¿Olvidaste tu contraseña?»."
                      : raw,
                  );
                } finally {
                  setLoading(false);
                }
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="np">{isNew ? "Contraseña" : "Nueva contraseña"}</Label>
                <Input
                  id="np"
                  type="password"
                  required
                  minLength={minLength}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!ready}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp">Repite la contraseña</Label>
                <Input
                  id="cp"
                  type="password"
                  required
                  minLength={minLength}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={!ready}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !ready}>
                {loading ? "Guardando..." : "Guardar contraseña"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
