import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

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
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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
            <CardTitle>Nueva contraseña</CardTitle>
            <CardDescription>
              {ready
                ? "Escribe tu nueva contraseña."
                : "Abre el enlace desde el email de recuperación para continuar."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (password.length < 6) return toast.error("Mínimo 6 caracteres");
                if (password !== confirm) return toast.error("Las contraseñas no coinciden");
                setLoading(true);
                const { error } = await supabase.auth.updateUser({ password });
                setLoading(false);
                if (error) return toast.error(error.message);
                toast.success("Contraseña actualizada");
                navigate({ to: "/app/dashboard" });
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="np">Nueva contraseña</Label>
                <Input
                  id="np"
                  type="password"
                  required
                  minLength={6}
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
                  minLength={6}
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
